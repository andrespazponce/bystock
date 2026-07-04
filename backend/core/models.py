from django.conf import settings
from django.db import models
from django.utils import timezone

from .middleware import get_current_user


class SoftDeleteManager(models.Manager):
    """Manager por defecto: solo devuelve registros NO eliminados."""

    def get_queryset(self):
        return super().get_queryset().filter(eliminado=False)


class AuditModel(models.Model):
    """Modelo base abstracto. Todas las tablas del dominio heredan de aquí
    para tener auditoría completa y borrado lógico (soft delete)."""

    creado_en = models.DateTimeField('creado en', auto_now_add=True)
    modificado_en = models.DateTimeField('modificado en', auto_now=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True, editable=False,
        related_name='%(class)s_creados',
        verbose_name='creado por',
    )
    modificado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True, editable=False,
        related_name='%(class)s_modificados',
        verbose_name='modificado por',
    )
    eliminado = models.BooleanField(default=False, editable=False)
    eliminado_en = models.DateTimeField(null=True, blank=True, editable=False)
    eliminado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True, editable=False,
        related_name='%(class)s_eliminados',
        verbose_name='eliminado por',
    )

    objects = SoftDeleteManager()  # uso normal: solo registros vivos
    todos = models.Manager()       # acceso a todo, incluso eliminados

    class Meta:
        abstract = True
        base_manager_name = 'todos'

    def save(self, *args, **kwargs):
        user = get_current_user()
        if user is not None and user.is_authenticated:
            if self._state.adding:
                self.creado_por = user
            self.modificado_por = user
        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        """Borrado lógico: marca el registro como eliminado, no lo borra."""
        user = get_current_user()
        self.eliminado = True
        self.eliminado_en = timezone.now()
        if user is not None and user.is_authenticated:
            self.eliminado_por = user
        self.save(using=using)

    def eliminar_definitivo(self, using=None, keep_parents=False):
        """Borrado físico real. Usar con cuidado."""
        super().delete(using=using, keep_parents=keep_parents)

    def restaurar(self):
        """Revierte un soft delete."""
        self.eliminado = False
        self.eliminado_en = None
        self.eliminado_por = None
        self.save()


class Empresa(AuditModel):
    """Empresa del grupo corporativo (GIPRO, INCERPAZ, TERRAMIA, HORMIPAZ).
    Funciona como etiqueta que identifica el origen de cada información."""

    nombre = models.CharField(max_length=150, unique=True)
    codigo = models.CharField('código', max_length=20, unique=True)
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'empresa'
        verbose_name_plural = 'empresas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre
