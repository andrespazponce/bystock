from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MensajeConsulta, RegistroDescargaReporte, ReporteFinanciero
from .permissions import PuedeSubirReportes
from .serializers import (
    MensajeConsultaSerializer,
    ReporteFinancieroSerializer,
    ReporteFinancieroWriteSerializer,
    ResponderConsultaSerializer,
)


def _puede_gestionar(user):
    """True si el usuario puede subir / editar / eliminar reportes."""
    return user.is_staff or user.groups.filter(name='contadores').exists()


class ReporteFinancieroViewSet(viewsets.ModelViewSet):
    """CRUD de reportes financieros (subida multipart)."""

    permission_classes = [PuedeSubirReportes]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['empresa', 'tipo', 'periodo_tipo', 'anio', 'publicado']
    search_fields = ['titulo', 'descripcion', 'empresa__nombre']
    ordering_fields = ['anio', 'mes', 'trimestre', 'semestre', 'creado_en']
    ordering = ['-anio', '-mes']

    def get_queryset(self):
        qs = ReporteFinanciero.objects.select_related('empresa', 'creado_por')
        # Socios (sin permisos de gestión) solo ven publicados
        if not _puede_gestionar(self.request.user):
            qs = qs.filter(publicado=True)
        return qs

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return ReporteFinancieroWriteSerializer
        return ReporteFinancieroSerializer

    def get_parsers(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return [MultiPartParser(), FormParser()]
        return [JSONParser()]


class DescargarReporteView(APIView):
    """Descarga autenticada con auditoría de acceso."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        reporte = get_object_or_404(ReporteFinanciero, pk=pk)

        # Reportes no publicados: solo gestores
        if not reporte.publicado and not _puede_gestionar(request.user):
            return Response({'detail': 'No disponible.'}, status=403)

        # Registro inmutable de descarga
        RegistroDescargaReporte.objects.create(
            reporte=reporte,
            titulo_snapshot=str(reporte),
            usuario=request.user,
            ip=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )

        nombre_archivo = reporte.archivo.name.split('/')[-1]
        ext = nombre_archivo.rsplit('.', 1)[-1].lower() if '.' in nombre_archivo else ''
        MIME = {
            'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'csv': 'text/csv',
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'png': 'image/png',
        }
        content_type = MIME.get(ext, 'application/octet-stream')

        return FileResponse(
            reporte.archivo.open('rb'),
            as_attachment=True,
            filename=nombre_archivo,
            content_type=content_type,
        )


class MensajeConsultaViewSet(viewsets.ModelViewSet):
    """Consultas de socios sobre reportes. Gestores responden."""

    permission_classes = [AllowAny]
    serializer_class = MensajeConsultaSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['reporte', 'respondido']
    ordering = ['-fecha_consulta']

    def get_queryset(self):
        qs = MensajeConsulta.objects.select_related(
            'reporte', 'usuario', 'respondido_por'
        )
        # Socios solo ven sus propias consultas
        if not _puede_gestionar(self.request.user):
            qs = qs.filter(usuario=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['patch'], url_path='responder')
    def responder(self, request, pk=None):
        """Permite al gestor (admin o contador) responder una consulta."""
        if not _puede_gestionar(request.user):
            return Response({'detail': 'No autorizado.'}, status=403)
        consulta = self.get_object()
        ser = ResponderConsultaSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        consulta.respuesta = ser.validated_data['respuesta']
        consulta.respondido = True
        consulta.respondido_por = request.user
        consulta.fecha_respuesta = timezone.now()
        consulta.save()
        return Response(MensajeConsultaSerializer(consulta).data)


# ══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD FINANCIERO
# ══════════════════════════════════════════════════════════════════════════════

# Cuentas clave para el dashboard (codigo → clave interna)
_CLAVES = {
    'BG-1':     'activo_total',
    'BG-1.1':   'activo_corriente',
    'BG-1.1.1': 'disponible',
    'BG-1.1.2': 'exigible',
    'BG-1.1.3': 'realizable',
    'BG-1.2':   'activo_no_corriente',
    'BG-1.2.1': 'bienes_uso',
    'BG-1.2.2': 'activo_intangible',
    'BG-1.2.3': 'activo_diferido',
    'BG-2':     'pasivo_total',
    'BG-2.1':   'pasivo_corriente',
    'BG-2.2':   'pasivo_no_corriente',
    'BG-3':     'patrimonio',
    'BG-3.1':   'capital_social',
    'BG-3.5':   'resultado_gestion',
}


def _calcular_ratios(d):
    def _div(a, b):
        try:
            return round(a / b, 4) if b else None
        except Exception:
            return None

    ac = d.get('activo_corriente', 0) or 0
    pc = d.get('pasivo_corriente', 0) or 0
    at = d.get('activo_total', 0) or 0
    pt = d.get('pasivo_total', 0) or 0
    pat = d.get('patrimonio', 0) or 0
    cs = d.get('capital_social', 0) or 0
    rg = d.get('resultado_gestion', 0) or 0
    real = d.get('realizable', 0) or 0

    return {
        'liquidez_corriente': _div(ac, pc),
        'prueba_acida':       _div(ac - real, pc),
        'endeudamiento':      _div(pt, pat),
        'roa':                _div(rg, at),
        'roe':                _div(rg, cs),
    }


class DashboardFinancieroView(APIView):
    """
    GET /api/finanzas/dashboard/?anio=2025&mes=9
    Devuelve datos consolidados + por empresa para el período indicado.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from .models import PeriodoImport, ValorCuenta, CuentaContable

        anio = request.query_params.get('anio')
        mes  = request.query_params.get('mes')

        # Si no se pasa período, usar el más reciente disponible
        if not anio or not mes:
            ultimo = (
                PeriodoImport.objects
                .filter(tipo_estado='BG', publicado=True)
                .order_by('-anio', '-mes')
                .first()
            )
            if not ultimo:
                return Response({'error': 'No hay datos financieros cargados aún.'}, status=404)
            anio, mes = ultimo.anio, ultimo.mes
        else:
            anio, mes = int(anio), int(mes)

        periodos = PeriodoImport.objects.filter(
            anio=anio, mes=mes, tipo_estado='BG', publicado=True
        ).select_related('empresa')

        if not periodos.exists():
            return Response({'error': f'Sin datos para {mes}/{anio}.'}, status=404)

        # Cargar todos los valores del período
        valores = ValorCuenta.objects.filter(
            periodo__in=periodos
        ).select_related('periodo__empresa', 'cuenta')

        # Construir datos por empresa
        codigo_a_clave = _CLAVES
        empresas_raw = {}
        for v in valores:
            eid = v.periodo.empresa_id
            if eid not in empresas_raw:
                empresas_raw[eid] = {
                    'empresa_id':     eid,
                    'empresa_nombre': v.periodo.empresa.nombre,
                    'empresa_codigo': v.periodo.empresa.codigo,
                }
            clave = codigo_a_clave.get(v.cuenta.codigo)
            if clave and v.valor is not None:
                empresas_raw[eid][clave] = float(v.valor)

        # Ratios por empresa
        empresas = []
        for emp in sorted(empresas_raw.values(), key=lambda e: e['empresa_nombre']):
            emp['ratios'] = _calcular_ratios(emp)
            empresas.append(emp)

        # Consolidado (suma de todas las empresas)
        consolidado = {}
        for clave in _CLAVES.values():
            consolidado[clave] = sum(e.get(clave, 0) or 0 for e in empresas)
        consolidado['ratios'] = _calcular_ratios(consolidado)

        # Períodos disponibles (para el selector de fecha)
        periodos_disponibles = list(
            PeriodoImport.objects
            .filter(tipo_estado='BG', publicado=True)
            .values('anio', 'mes')
            .distinct()
            .order_by('-anio', '-mes')
        )

        return Response({
            'periodo': {'anio': anio, 'mes': mes},
            'empresas': empresas,
            'consolidado': consolidado,
            'periodos_disponibles': periodos_disponibles,
        })


class ImportarBalanceView(APIView):
    """
    POST /api/finanzas/importar/
    Multipart: campo 'archivo' (.xlsx) + campo 'tipo_estado' (BG|ER|FC).
    Solo gestores (is_staff o grupo contadores).
    """
    permission_classes = [AllowAny]
    parser_classes     = [MultiPartParser, FormParser]

    TIPOS_VALIDOS = {'BG', 'ER', 'FC'}
    LABELS = {'BG': 'Balance General', 'ER': 'Estado de Resultados', 'FC': 'Flujo de Caja'}

    def post(self, request):
        if not _puede_gestionar(request.user):
            return Response({'detail': 'No autorizado.'}, status=403)

        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'detail': 'Falta el campo "archivo".'}, status=400)

        ext = archivo.name.rsplit('.', 1)[-1].lower() if '.' in archivo.name else ''
        if ext not in ('xlsx', 'xls'):
            return Response({'detail': 'Solo se aceptan archivos .xlsx o .xls.'}, status=400)

        tipo_estado = request.data.get('tipo_estado', 'BG').upper()
        if tipo_estado not in self.TIPOS_VALIDOS:
            return Response(
                {'detail': f'tipo_estado inválido. Opciones: {", ".join(self.TIPOS_VALIDOS)}'},
                status=400,
            )

        from .importador import importar_balance
        resultado = importar_balance(archivo, tipo_estado=tipo_estado)
        resultado['tipo_estado_label'] = self.LABELS[tipo_estado]

        if resultado['error']:
            return Response({'detail': resultado['error']}, status=422)

        return Response(resultado, status=200)


class PeriodosDisponiblesView(APIView):
    """GET /api/finanzas/periodos/ → lista de períodos con datos."""
    permission_classes = [AllowAny]

    def get(self, request):
        from .models import PeriodoImport
        periodos = (
            PeriodoImport.objects
            .filter(tipo_estado='BG', publicado=True)
            .values('anio', 'mes')
            .distinct()
            .order_by('-anio', '-mes')
        )
        data = []
        meses = PeriodoImport.MESES_ES
        for p in periodos:
            data.append({
                'anio': p['anio'],
                'mes':  p['mes'],
                'label': f"{meses[p['mes']]} {p['anio']}",
            })
        return Response(data)
