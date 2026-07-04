from rest_framework.routers import DefaultRouter

from .views import ActivoDocumentoViewSet, ActivoViewSet

router = DefaultRouter()
router.register(r'activos', ActivoViewSet, basename='activo')
router.register(r'activos-documentos', ActivoDocumentoViewSet, basename='activo-documento')

urlpatterns = router.urls
