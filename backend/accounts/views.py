from axes.handlers.proxy import AxesProxyHandler
from django.contrib.auth.models import Group
from rest_framework import permissions, status
from rest_framework.filters import SearchFilter
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework_simplejwt.views import TokenObtainPairView

from core.api import AuditUserMixin
from .models import CustomUser, Persona, RegistroAcceso
from rest_framework.decorators import action

from .serializers import (
    CambiarPasswordSerializer,
    GrupoDetalleSerializer,
    GrupoSerializer,
    MeSerializer,
    PersonaLiteSerializer,
    PersonaSerializer,
    PersonaWriteSerializer,
    UsuarioCreateSerializer,
    UsuarioSerializer,
    UsuarioUpdateSerializer,
)
from .utils import get_client_ip


class LoggingTokenObtainPairView(TokenObtainPairView):
    """Login del portal (JWT) que además audita el intento en RegistroAcceso.

    Registra TANTO los logins exitosos como los fallidos (estos últimos son la
    señal más útil para detectar ataques de fuerza bruta). Nunca guarda la
    contraseña, solo el email tecleado, la IP y el user-agent."""

    def post(self, request, *args, **kwargs):
        # Si la combinación email+IP está bloqueada por demasiados fallos,
        # respondemos con un mensaje claro (403) en vez del 401 genérico.
        credentials = {'email': request.data.get('email', '')}
        if not AxesProxyHandler.is_allowed(request, credentials):
            return Response(
                {'detail': 'Cuenta bloqueada temporalmente por demasiados intentos '
                           'fallidos. Probá de nuevo más tarde.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Si las credenciales son inválidas, super().post() lanza y la respuesta
        # nunca llega aquí: ese FALLO lo captura la señal user_login_failed
        # (la dispara authenticate() para cualquier origen). Por eso aquí
        # registramos SOLO el éxito, evitando el doble registro.
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            email = request.data.get('email', '')
            RegistroAcceso.objects.create(
                email_intentado=email,
                usuario=CustomUser.objects.filter(email__iexact=email).first(),
                exito=True,
                via=RegistroAcceso.Via.PORTAL,
                ip=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
        return response


class PersonaViewSet(AuditUserMixin, ModelViewSet):
    """Personas del sistema.

    - GET autenticado: lista para selectores (PersonaLiteSerializer, sin paginación).
      Si is_staff: datos completos (PersonaSerializer) para la vista de Ajustes.
    - POST / PATCH: solo is_staff (módulo Ajustes).
    - DELETE: deshabilitado — las personas están referenciadas en muchos registros.
    Soporta búsqueda por nombre/apellido con ?search=.
    """

    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    filter_backends = [SearchFilter]
    search_fields = ['nombres', 'apellidos']
    queryset = Persona.objects.all()

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PersonaWriteSerializer
        if self.request.user.is_staff:
            return PersonaSerializer
        return PersonaLiteSerializer


class GrupoViewSet(ReadOnlyModelViewSet):
    """Grupos de permisos disponibles. Solo is_staff.

    - GET list: lista ligera (GrupoSerializer) para selectores de usuario.
    - GET retrieve: detalle con usuarios anidados (GrupoDetalleSerializer).
    - POST <id>/agregar-usuario/: agrega un usuario al grupo.
    - POST <id>/quitar-usuario/: quita un usuario del grupo.
    """

    pagination_class = None
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        acciones_detalle = {'retrieve', 'agregar_usuario', 'quitar_usuario'}
        if self.action in acciones_detalle:
            return (
                Group.objects
                .prefetch_related('user_set', 'user_set__persona', 'user_set__groups')
                .order_by('name')
            )
        return Group.objects.all().order_by('name')

    def get_serializer_class(self):
        if self.action in ('retrieve', 'agregar_usuario', 'quitar_usuario'):
            return GrupoDetalleSerializer
        return GrupoSerializer

    def _get_usuario_o_error(self, user_id):
        """Valida y devuelve el usuario; o lanza Response de error."""
        if not user_id:
            return None, Response(
                {'detail': 'El campo "usuario" es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return None, Response(
                {'detail': 'Usuario no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.is_superuser:
            return None, Response(
                {'detail': 'Los superusuarios no se gestionan desde aquí.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return user, None

    def _detalle_grupo(self, grupo):
        """Devuelve el grupo re-consultado con prefetch fresco."""
        grupo = (
            Group.objects
            .prefetch_related('user_set', 'user_set__persona', 'user_set__groups')
            .get(pk=grupo.pk)
        )
        return Response(GrupoDetalleSerializer(grupo).data)

    @action(detail=True, methods=['post'], url_path='agregar-usuario')
    def agregar_usuario(self, request, pk=None):
        """Agrega un usuario al grupo. Body: {"usuario": <id>}."""
        grupo = self.get_object()
        user, error = self._get_usuario_o_error(request.data.get('usuario'))
        if error:
            return error
        grupo.user_set.add(user)
        return self._detalle_grupo(grupo)

    @action(detail=True, methods=['post'], url_path='quitar-usuario')
    def quitar_usuario(self, request, pk=None):
        """Quita un usuario del grupo. Body: {"usuario": <id>}."""
        grupo = self.get_object()
        user, error = self._get_usuario_o_error(request.data.get('usuario'))
        if error:
            return error
        grupo.user_set.remove(user)
        return self._detalle_grupo(grupo)


class UsuarioViewSet(ModelViewSet):
    """Gestión de cuentas de usuario del portal. Solo is_staff.

    - GET: lista todos los usuarios (activos e inactivos).
    - POST: crea un usuario con contraseña inicial.
    - PATCH: edita persona, grupos, is_active, is_staff; opcionalmente resetea la
      contraseña. Los superusuarios quedan protegidos y no se pueden editar desde
      aquí (usar Django admin para esos casos extremos).
    - DELETE: deshabilitado — usar is_active=False para revocar acceso.
    """

    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return (
            CustomUser.objects
            .select_related('persona')
            .prefetch_related('groups')
            .order_by('email')
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return UsuarioCreateSerializer
        if self.action == 'partial_update':
            return UsuarioUpdateSerializer
        return UsuarioSerializer

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_superuser:
            return Response(
                {'detail': 'Los superusuarios no se pueden editar desde el portal.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)


class MeView(RetrieveAPIView):
    """Devuelve los datos del usuario autenticado (GET /api/auth/me/).

    El frontend lo usa al iniciar para saber quién entró y mostrar su nombre.
    Requiere un JWT válido en el header Authorization: Bearer <token>."""

    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class CambiarPasswordView(APIView):
    """Cambio de contraseña del propio usuario (POST /api/auth/cambiar-password/).

    Exige la contraseña actual y valida la nueva con los validadores de Django.
    Nota: con SimpleJWT los tokens ya emitidos siguen siendo válidos hasta que
    expiran; invalidarlos al cambiar la contraseña queda para la fase de VPS
    (junto con httpOnly cookie, 2FA y reset por email)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CambiarPasswordSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Contraseña actualizada correctamente.'})
