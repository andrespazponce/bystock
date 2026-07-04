"""Utilidades compartidas para la API (DRF)."""
from core.middleware import set_current_user


class AuditUserMixin:
    """Mixin para viewsets de ESCRITURA autenticados con JWT.

    `CurrentUserMiddleware` captura `request.user` al inicio de la petición,
    pero DRF autentica el Bearer token MÁS TARDE (dentro de la vista). Sin esto,
    una escritura por el portal vería al usuario como Anónimo y AuditModel no
    registraría `creado_por` / `modificado_por`.

    Sobrescribimos `initial()` (que corre después de autenticar y antes del
    handler) para re-sellar el thread-local con el usuario ya autenticado."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        set_current_user(request.user)
