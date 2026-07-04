from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from core.models import AuditModel


class Persona(AuditModel):
    """Persona real involucrada en el gobierno corporativo.
    Existe tenga o no acceso al sistema. Es el ancla de la identidad:
    - puede ser socio (casilla es_socio)
    - puede ser miembro de órganos (ver gobierno.Miembro)
    - puede tener (o no) una cuenta de acceso (CustomUser.persona)
    """

    nombres = models.CharField(max_length=150)
    apellidos = models.CharField(max_length=150)
    documento_identidad = models.CharField(
        'documento de identidad', max_length=30,
        unique=True, null=True, blank=True,
    )
    telefono = models.CharField('teléfono', max_length=30, blank=True)
    es_socio = models.BooleanField('es socio', default=False)
    fecha_ingreso = models.DateField('fecha de ingreso como socio', null=True, blank=True)

    class Meta:
        verbose_name = 'persona'
        verbose_name_plural = 'personas'
        ordering = ['apellidos', 'nombres']

    def __str__(self):
        return f'{self.nombres} {self.apellidos}'.strip()


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('El email es obligatorio.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if not extra_fields['is_staff']:
            raise ValueError('El superusuario debe tener is_staff=True.')
        if not extra_fields['is_superuser']:
            raise ValueError('El superusuario debe tener is_superuser=True.')
        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    """Cuenta de acceso al sistema (login). Solo la tienen las personas que
    usan el portal. La identidad (nombre, documento...) vive en Persona."""

    email = models.EmailField(unique=True)
    persona = models.OneToOneField(
        'accounts.Persona',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='usuario',
        help_text='Persona a la que pertenece esta cuenta de acceso.',
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = 'usuario'
        verbose_name_plural = 'usuarios'

    def __str__(self):
        return self.email

    def get_full_name(self):
        if self.persona_id:
            return str(self.persona)
        return self.email

    def get_short_name(self):
        if self.persona_id:
            return self.persona.nombres
        return self.email


class RegistroAcceso(models.Model):
    """Bitácora de auditoría de intentos de login (exitosos y fallidos).

    NO hereda de AuditModel: es en sí mismo un registro de auditoría, inmutable;
    no se edita ni se borra (soft delete) — solo se consulta. No guarda la
    contraseña, únicamente el email tecleado. La geolocalización (país/ciudad)
    queda preparada pero se poblará al desplegar en el VPS (en local la IP es
    interna y no aporta ubicación real)."""

    class Via(models.TextChoices):
        PORTAL = 'PORTAL', 'Portal (frontend / API)'
        ADMIN = 'ADMIN', 'Admin de Django'

    email_intentado = models.EmailField('email intentado', max_length=254)
    usuario = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='accesos',
        help_text='Usuario real, si el email corresponde a una cuenta existente.',
    )
    exito = models.BooleanField('éxito', default=False)
    via = models.CharField(max_length=10, choices=Via.choices, default=Via.PORTAL)
    ip = models.GenericIPAddressField('IP', null=True, blank=True)
    user_agent = models.TextField('navegador / dispositivo', blank=True)
    # Geolocalización (se completará en producción con GeoLite2):
    pais = models.CharField('país', max_length=100, blank=True)
    ciudad = models.CharField(max_length=100, blank=True)
    creado_en = models.DateTimeField('fecha y hora', auto_now_add=True)

    class Meta:
        verbose_name = 'registro de acceso'
        verbose_name_plural = 'registros de acceso'
        ordering = ['-creado_en']
        indexes = [
            models.Index(fields=['email_intentado']),
            models.Index(fields=['-creado_en']),
        ]

    def __str__(self):
        estado = 'OK' if self.exito else 'FALLÓ'
        return f'[{estado}] {self.email_intentado} — {self.creado_en:%Y-%m-%d %H:%M}'
