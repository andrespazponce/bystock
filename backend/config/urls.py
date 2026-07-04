from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import LoggingTokenObtainPairView
from .views import health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check),
    # Login del portal: emite el JWT y AUDITA el intento (éxito/fallo).
    path('api/token/', LoggingTokenObtainPairView.as_view()),
    path('api/token/refresh/', TokenRefreshView.as_view()),
    # Datos del usuario autenticado.
    path('api/', include('accounts.urls')),
    # Órganos de gobierno (lista para filtros).
    path('api/', include('gobierno.urls')),
    # Reuniones (lista/detalle) + descarga segura de documentos.
    path('api/', include('reuniones.urls')),
    # Activos del grupo corporativo (Paz Holding y otras empresas).
    path('api/', include('activos.urls')),
    # Reportes financieros y consultas de socios.
    path('api/', include('finanzas.urls')),
]
