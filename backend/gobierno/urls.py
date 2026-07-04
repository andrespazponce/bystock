from rest_framework.routers import DefaultRouter

from .views import EmpresaViewSet, MiembroViewSet, OrganoViewSet

app_name = 'gobierno'

router = DefaultRouter()
router.register('organos', OrganoViewSet, basename='organo')
router.register('empresas', EmpresaViewSet, basename='empresa')
router.register('miembros', MiembroViewSet, basename='miembro')

urlpatterns = router.urls
