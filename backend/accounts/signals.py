from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver

from .models import RegistroAcceso
from .utils import get_client_ip


def _via_desde_request(request):
    """Distingue el origen del intento por la ruta: /api/ = portal; resto = admin."""
    if request is not None and request.path.startswith('/api/'):
        return RegistroAcceso.Via.PORTAL
    return RegistroAcceso.Via.ADMIN


@receiver(user_logged_in)
def registrar_login_exitoso(sender, request, user, **kwargs):
    # El éxito del portal (JWT) lo registra LoggingTokenObtainPairView, porque
    # SimpleJWT no llama a login() y esta señal no se dispara. Aquí cubrimos el
    # login por sesión (admin). Saltamos rutas /api/ por las dudas, para no
    # duplicar si en el futuro el portal usara sesiones.
    if request is not None and request.path.startswith('/api/'):
        return
    RegistroAcceso.objects.create(
        email_intentado=getattr(user, 'email', '') or '',
        usuario=user,
        exito=True,
        via=RegistroAcceso.Via.ADMIN,
        ip=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '') if request else '',
    )


@receiver(user_login_failed)
def registrar_login_fallido(sender, credentials, request=None, **kwargs):
    # authenticate() dispara esta señal para TODOS los orígenes (portal y admin),
    # así que es el único lugar donde registramos los fallos. `credentials` ya
    # viene con la contraseña enmascarada por Django.
    email = credentials.get('username') or credentials.get('email') or ''
    RegistroAcceso.objects.create(
        email_intentado=email,
        exito=False,
        via=_via_desde_request(request),
        ip=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '') if request else '',
    )
