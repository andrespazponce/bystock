from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Activo, ActivoDocumento
from .serializers import ActivoDocumentoSerializer, ActivoListSerializer, ActivoSerializer


class ActivoViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de activos.
    Filtra por empresa, categoría, tipo y estado.
    La acción /mapa/ devuelve solo los activos con coordenadas.
    Acceso anónimo para lectura, autenticado para escritura/eliminación.
    """

    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['empresa', 'categoria', 'tipo', 'estado']
    search_fields = ['nombre', 'direccion', 'placa', 'nro_serie', 'nro_catastral', 'ciudad', 'departamento']
    ordering_fields = ['nombre', 'fecha_adquisicion', 'valor', 'creado_en']
    ordering = ['empresa', 'categoria', 'nombre']

    def get_queryset(self):
        return Activo.objects.select_related('empresa').all()

    def get_serializer_class(self):
        if self.action == 'list':
            return ActivoListSerializer
        return ActivoSerializer

    @action(detail=False, methods=['get'], url_path='mapa')
    def mapa(self, request):
        """Devuelve solo los activos que tienen lat/lng para el mapa."""
        qs = self.get_queryset().exclude(latitud=None).exclude(longitud=None)

        # Filtros opcionales por empresa/categoría/estado
        empresa = request.query_params.get('empresa')
        categoria = request.query_params.get('categoria')
        estado = request.query_params.get('estado')

        if empresa:
            qs = qs.filter(empresa=empresa)
        if categoria:
            qs = qs.filter(categoria=categoria)
        if estado:
            qs = qs.filter(estado=estado)

        serializer = ActivoListSerializer(qs, many=True)
        return Response(serializer.data)


class ActivoDocumentoViewSet(viewsets.ModelViewSet):
    """
    CRUD de documentos asociados a un activo.
    GET    /api/activos-documentos/?activo=<id>  → lista docs del activo
    POST   /api/activos-documentos/              → subir doc (multipart)
    DELETE /api/activos-documentos/<id>/         → eliminar doc
    Acceso anónimo permitido.
    """

    permission_classes = [AllowAny]
    serializer_class = ActivoDocumentoSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = ActivoDocumento.objects.select_related('activo')
        activo_id = self.request.query_params.get('activo')
        if activo_id:
            qs = qs.filter(activo_id=activo_id)
        return qs

    def perform_create(self, serializer):
        activo_id = self.request.data.get('activo')
        activo = get_object_or_404(Activo, pk=activo_id)
        serializer.save(activo=activo)
