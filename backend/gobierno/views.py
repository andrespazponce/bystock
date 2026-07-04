from rest_framework import permissions
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from core.api import AuditUserMixin
from core.models import Empresa
from .models import Miembro, Organo
from .serializers import (
    EmpresaLiteSerializer,
    EmpresaSerializer,
    EmpresaWriteSerializer,
    MiembroManageSerializer,
    MiembroWriteSerializer,
    OrganoSerializer,
    OrganoWriteSerializer,
)


class OrganoViewSet(AuditUserMixin, ModelViewSet):
    """Órganos del grupo corporativo.

    - GET autenticado: lista órganos activos (para selectores en el portal).
      Si is_staff: lista TODOS (activos e inactivos) para la vista de Ajustes.
    - POST / PATCH: solo is_staff (módulo Ajustes).
    - DELETE: deshabilitado — solo desde el admin de Django.
    """

    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        qs = Organo.objects.select_related('empresa')
        if self.request.user.is_staff:
            return qs.all()
        return qs.filter(activo=True)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return OrganoWriteSerializer
        return OrganoSerializer


class MiembroViewSet(AuditUserMixin, ModelViewSet):
    """Miembros de órganos (solo is_staff).

    Filtrar por órgano: GET /api/miembros/?organo=<id>
    El DELETE usa soft delete (AuditModel).
    """

    permission_classes = [permissions.IsAdminUser]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filterset_fields = ['organo']

    def get_queryset(self):
        return Miembro.objects.select_related('persona', 'organo').all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return MiembroWriteSerializer
        return MiembroManageSerializer


class EmpresaViewSet(AuditUserMixin, ModelViewSet):
    """Empresas del grupo corporativo.

    - GET autenticado: lista empresas activas (para selectores en el portal).
      Si is_staff: lista TODAS (activas e inactivas) para la vista de Ajustes.
    - POST / PATCH: solo is_staff (módulo Ajustes).
    - DELETE: deshabilitado — solo desde el admin de Django.
    """

    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Empresa.objects.all().order_by('nombre')
        return Empresa.objects.filter(activa=True).order_by('nombre')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return EmpresaWriteSerializer
        if self.request.user.is_staff:
            return EmpresaSerializer
        return EmpresaLiteSerializer
