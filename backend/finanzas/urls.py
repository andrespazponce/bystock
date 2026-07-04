from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DescargarReporteView,
    MensajeConsultaViewSet,
    ReporteFinancieroViewSet,
    DashboardFinancieroView,
    ImportarBalanceView,
    PeriodosDisponiblesView,
)

app_name = 'finanzas'

router = DefaultRouter()
router.register(r'reportes-financieros', ReporteFinancieroViewSet, basename='reporte-financiero')
router.register(r'consultas-financieras', MensajeConsultaViewSet, basename='consulta-financiera')

urlpatterns = [
    path(
        'reportes-financieros/<int:pk>/descargar/',
        DescargarReporteView.as_view(),
        name='descargar_reporte',
    ),
    # Dashboard financiero estructurado
    path('finanzas/dashboard/',  DashboardFinancieroView.as_view(), name='dashboard_financiero'),
    path('finanzas/importar/',   ImportarBalanceView.as_view(),     name='importar_balance'),
    path('finanzas/periodos/',   PeriodosDisponiblesView.as_view(), name='periodos_disponibles'),
] + router.urls
