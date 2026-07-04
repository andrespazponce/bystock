from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CambiarPasswordView, GrupoViewSet, MeView, PersonaViewSet, UsuarioViewSet

app_name = 'accounts'

router = DefaultRouter()
router.register('personas', PersonaViewSet, basename='persona')
router.register('usuarios', UsuarioViewSet, basename='usuario')
router.register('grupos', GrupoViewSet, basename='grupo')

urlpatterns = [
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/cambiar-password/', CambiarPasswordView.as_view(), name='cambiar_password'),
] + router.urls
