import threading

_thread_locals = threading.local()


def get_current_user():
    """Devuelve el usuario de la petición en curso, o None fuera de una petición."""
    return getattr(_thread_locals, 'user', None)


def set_current_user(user):
    """Re-asigna el usuario de la petición en curso.

    Lo usa la API con JWT: este middleware corre ANTES de que DRF autentique,
    así que para una petición con Bearer el request.user inicial es Anónimo.
    Tras autenticar, el viewset vuelve a sellar aquí el usuario real para que
    AuditModel registre correctamente quién creó/modificó."""
    _thread_locals.user = user


class CurrentUserMiddleware:
    """Guarda el usuario autenticado en un thread-local para que AuditModel
    pueda registrar automáticamente quién crea/modifica/elimina cada registro."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.user = getattr(request, 'user', None)
        try:
            return self.get_response(request)
        finally:
            _thread_locals.user = None
