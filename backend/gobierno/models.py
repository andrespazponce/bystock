from django.db import models

from core.models import AuditModel


class Organo(AuditModel):
    """Órgano de gobierno: un consejo o un comité. Pertenece a una empresa."""

    class Tipo(models.TextChoices):
        DIRECTORIO = 'DIRECTORIO', 'Directorio'
        COMITE = 'COMITE', 'Comité'

    empresa = models.ForeignKey(
        'core.Empresa',
        on_delete=models.PROTECT,
        related_name='organos',
    )
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    descripcion = models.TextField('descripción', blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'órgano'
        verbose_name_plural = 'órganos'
        ordering = ['empresa', 'nombre']

    def __str__(self):
        return f'{self.get_tipo_display()}: {self.nombre} ({self.empresa.codigo})'


class Miembro(AuditModel):
    """Pertenencia de una persona a un órgano, con su rol dentro de él.
    El miembro NO tiene por qué ser socio ni tener cuenta de acceso
    (p. ej. un consejero externo que asiste pero no usa el sistema).
    Una persona puede tener distintos roles en distintos órganos."""

    class Rol(models.TextChoices):
        PRESIDENTE = 'PRESIDENTE', 'Presidente'
        VICEPRESIDENTE = 'VICEPRESIDENTE', 'Vicepresidente'
        SECRETARIO = 'SECRETARIO', 'Secretario'
        VOCAL = 'VOCAL', 'Vocal'
        MIEMBRO = 'MIEMBRO', 'Miembro'

    organo = models.ForeignKey(
        'gobierno.Organo',
        on_delete=models.CASCADE,
        related_name='miembros',
    )
    persona = models.ForeignKey(
        'accounts.Persona',
        on_delete=models.PROTECT,
        related_name='membresias',
    )
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.MIEMBRO)
    fecha_inicio = models.DateField('fecha de inicio', null=True, blank=True)
    fecha_fin = models.DateField('fecha de fin', null=True, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'miembro'
        verbose_name_plural = 'miembros'
        ordering = ['organo', 'rol']
        constraints = [
            # Una persona no puede estar dos veces en el mismo órgano (entre los no eliminados)
            models.UniqueConstraint(
                fields=['organo', 'persona'],
                condition=models.Q(eliminado=False),
                name='unique_persona_por_organo_activo',
            ),
        ]

    def __str__(self):
        return f'{self.persona} — {self.get_rol_display()} en {self.organo.nombre}'
