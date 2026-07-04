from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
    verbose_name = 'Cuentas'

    def ready(self):
        # Conecta los receptores de señales de login (admin de Django).
        from . import signals  # noqa: F401
