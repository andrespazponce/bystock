from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'reuniones'

router = DefaultRouter()
router.register('reuniones', views.ReunionViewSet, basename='reunion')
router.register('puntos', views.PuntoOrdenViewSet, basename='punto')
router.register('asistencias', views.AsistenciaViewSet, basename='asistencia')
router.register('actas', views.ActaViewSet, basename='acta')
router.register('resoluciones', views.ResolucionViewSet, basename='resolucion')
router.register('compromisos-gestion', views.CompromisoGestionViewSet, basename='compromiso-gestion')
router.register('compromisos', views.CompromisoViewSet, basename='compromiso')
router.register('documentos', views.DocumentoViewSet, basename='documento')
router.register('tags', views.TagViewSet, basename='tag')

urlpatterns = [
    path('documentos/<int:pk>/descargar/', views.DescargarDocumentoView.as_view(), name='descargar_documento'),
    path('asistente/', views.AsistenteView.as_view(), name='asistente'),
] + router.urls
