import hashlib

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models

from core.models import AuditModel

# ── Constantes compartidas ────────────────────────────────────────────────────

TIPO_ESTADO_CHOICES = [
    ('BG', 'Balance General'),
    ('ER', 'Estado de Resultados'),
    ('FC', 'Flujo de Caja'),
]


def validar_tamanio_archivo(archivo):
    limite_mb = getattr(settings, 'MAX_UPLOAD_SIZE_MB', 20)
    if archivo.size > limite_mb * 1024 * 1024:
        raise ValidationError(f'El archivo supera los {limite_mb} MB permitidos.')


class ReporteFinanciero(AuditModel):
    TIPO_CHOICES = [
        # Estados financieros
        ('ESTADO_RESULTADOS',  'Estado de Resultados'),
        ('BALANCE_GENERAL',    'Balance General'),
        ('FLUJO_EFECTIVO',     'Flujo de Efectivo'),
        ('ESTADO_PATRIMONIO',  'Estado de Cambios en el Patrimonio'),
        # Gestión
        ('MEMORIA_ANUAL',       'Memoria Anual / Informe de Gestión'),
        ('PRESUPUESTO',         'Presupuesto vs. Ejecución'),
        ('INFORME_VENTAS',      'Informe de Ventas'),
        ('CUENTAS_COBRAR_PAGAR','Cuentas por Cobrar y Pagar'),
        # Auditoría
        ('INFORME_AUDITORIA',  'Informe del Auditor Externo'),
        ('INFORME_SINDICO',    'Informe del Síndico'),
        # Tributario Bolivia
        ('DECLARACION_IUE',         'Declaración IUE'),
        ('DECLARACION_IT',          'Declaración IT'),
        ('DECLARACION_IVA',         'Declaración IVA'),
        ('CERTIFICADO_SOLVENCIA',   'Certificado de Solvencia Fiscal'),
        ('OTRO', 'Otro'),
    ]

    PERIODO_TIPO_CHOICES = [
        ('MENSUAL',     'Mensual'),
        ('TRIMESTRAL',  'Trimestral'),
        ('SEMESTRAL',   'Semestral'),
        ('ANUAL',       'Anual'),
    ]

    empresa = models.ForeignKey(
        'core.Empresa',
        on_delete=models.PROTECT,
        related_name='reportes_financieros',
        verbose_name='empresa',
    )
    tipo = models.CharField('tipo de reporte', max_length=30, choices=TIPO_CHOICES)
    periodo_tipo = models.CharField('tipo de período', max_length=15, choices=PERIODO_TIPO_CHOICES)
    anio = models.PositiveIntegerField('año')
    mes = models.PositiveSmallIntegerField(
        'mes', null=True, blank=True,
        help_text='1–12. Solo para período mensual.',
    )
    trimestre = models.PositiveSmallIntegerField(
        'trimestre', null=True, blank=True,
        help_text='1–4. Solo para período trimestral.',
    )
    semestre = models.PositiveSmallIntegerField(
        'semestre', null=True, blank=True,
        help_text='1–2. Solo para período semestral.',
    )
    titulo = models.CharField('título', max_length=255, blank=True)
    descripcion = models.TextField('descripción', blank=True)
    archivo = models.FileField(
        'archivo',
        upload_to='finanzas/%Y/%m/',
        validators=[
            FileExtensionValidator(['pdf', 'xlsx', 'xls', 'doc', 'docx', 'csv', 'jpg', 'jpeg', 'png']),
            validar_tamanio_archivo,
        ],
    )
    sha256 = models.CharField(max_length=64, editable=False, blank=True)
    publicado = models.BooleanField(
        default=True,
        help_text='Los reportes publicados son visibles para todos los usuarios autenticados.',
    )

    class Meta:
        verbose_name = 'reporte financiero'
        verbose_name_plural = 'reportes financieros'
        ordering = ['-anio', '-mes', '-trimestre', '-semestre', 'empresa']

    def save(self, *args, **kwargs):
        if self.archivo and self._state.adding:
            self.sha256 = self._calcular_sha256()
        super().save(*args, **kwargs)

    def _calcular_sha256(self):
        h = hashlib.sha256()
        try:
            for chunk in self.archivo.chunks():
                h.update(chunk)
        except Exception:
            return ''
        return h.hexdigest()

    def periodo_display(self):
        MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        if self.periodo_tipo == 'MENSUAL' and self.mes:
            return f'{MESES[self.mes]} {self.anio}'
        if self.periodo_tipo == 'TRIMESTRAL' and self.trimestre:
            return f'T{self.trimestre} {self.anio}'
        if self.periodo_tipo == 'SEMESTRAL' and self.semestre:
            return f'S{self.semestre} {self.anio}'
        return str(self.anio)

    def __str__(self):
        return f'{self.empresa} — {self.get_tipo_display()} {self.periodo_display()}'


class MensajeConsulta(models.Model):
    """Consulta de un socio sobre un reporte. Admin o contador responde."""

    reporte = models.ForeignKey(
        ReporteFinanciero,
        on_delete=models.CASCADE,
        related_name='consultas',
        verbose_name='reporte',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='consultas_financieras',
        verbose_name='usuario',
    )
    mensaje = models.TextField('mensaje')
    respondido = models.BooleanField('respondido', default=False)
    respuesta = models.TextField('respuesta', blank=True)
    respondido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='respuestas_consultas',
        verbose_name='respondido por',
    )
    fecha_consulta = models.DateTimeField('fecha de consulta', auto_now_add=True)
    fecha_respuesta = models.DateTimeField('fecha de respuesta', null=True, blank=True)

    class Meta:
        verbose_name = 'consulta'
        verbose_name_plural = 'consultas'
        ordering = ['-fecha_consulta']

    def __str__(self):
        return f'Consulta de {self.usuario} — {self.reporte}'


class RegistroDescargaReporte(models.Model):
    """Auditoría inmutable de descargas de reportes financieros."""

    reporte = models.ForeignKey(
        ReporteFinanciero,
        on_delete=models.SET_NULL,
        null=True,
        related_name='descargas',
        verbose_name='reporte',
    )
    titulo_snapshot = models.CharField('título al momento', max_length=255)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='descargas_reportes',
        verbose_name='usuario',
    )
    ip = models.GenericIPAddressField('IP', null=True, blank=True)
    user_agent = models.CharField('user agent', max_length=500, blank=True)
    fecha = models.DateTimeField('fecha', auto_now_add=True)

    class Meta:
        verbose_name = 'registro de descarga'
        verbose_name_plural = 'registros de descarga'
        ordering = ['-fecha']
        default_permissions = ()  # inmutable: sin add/change/delete/view en admin

    def __str__(self):
        return f'{self.usuario} — "{self.titulo_snapshot}" {self.fecha:%Y-%m-%d}'


# ══════════════════════════════════════════════════════════════════════════════
#  SISTEMA DE DATOS FINANCIEROS ESTRUCTURADOS
# ══════════════════════════════════════════════════════════════════════════════

class CuentaContable(models.Model):
    """
    Plan de cuentas para el Balance General (y futuros ER/FC).
    Seeded con `python manage.py seed_cuentas`.
    """

    TIPO_CHOICES = [
        # Balance General
        ('ACTIVO',     'Activo'),
        ('PASIVO',     'Pasivo'),
        ('PATRIMONIO', 'Patrimonio'),
        # Estado de Resultados
        ('INGRESO',    'Ingreso'),
        ('COSTO',      'Costo'),
        ('GASTO',      'Gasto'),
        # Flujo de Caja
        ('FLUJO',      'Flujo'),
        # Compartido
        ('TOTAL',      'Total'),
    ]

    codigo = models.CharField('código', max_length=20, unique=True)
    nombre = models.CharField('nombre', max_length=200)
    nombre_excel = models.CharField(
        'nombre en Excel', max_length=200,
        help_text='Texto exacto de la celda en el archivo (búsqueda case-insensitive).',
    )
    tipo_estado = models.CharField(
        'tipo de estado', max_length=2,
        choices=TIPO_ESTADO_CHOICES, default='BG',
    )
    padre = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='hijos',
        verbose_name='cuenta padre',
    )
    tipo = models.CharField('tipo', max_length=15, choices=TIPO_CHOICES)
    es_cabecera = models.BooleanField(
        'es cabecera', default=False,
        help_text='Si True, se muestra en negrita y sin valor propio.',
    )
    es_total = models.BooleanField(
        'es total', default=False,
        help_text='Si True, es una fila de subtotal o total.',
    )
    orden = models.PositiveSmallIntegerField('orden')
    activa = models.BooleanField('activa', default=True)

    class Meta:
        verbose_name = 'cuenta contable'
        verbose_name_plural = 'cuentas contables'
        ordering = ['orden']

    def __str__(self):
        return f'{self.codigo} — {self.nombre}'


class PeriodoImport(AuditModel):
    """
    Un archivo Excel importado = un período (mes + año) + una empresa.
    Cada subida reemplaza los valores anteriores del mismo período/empresa.
    """

    empresa = models.ForeignKey(
        'core.Empresa',
        on_delete=models.PROTECT,
        related_name='periodos_financieros',
        verbose_name='empresa',
    )
    anio = models.PositiveIntegerField('año')
    mes = models.PositiveSmallIntegerField('mes')  # 1–12
    tipo_estado = models.CharField(
        'tipo de estado', max_length=2,
        choices=TIPO_ESTADO_CHOICES, default='BG',
    )
    archivo = models.FileField(
        'archivo original',
        upload_to='finanzas/imports/%Y/%m/',
        blank=True,
    )
    publicado = models.BooleanField('publicado', default=True)

    class Meta:
        verbose_name = 'período importado'
        verbose_name_plural = 'períodos importados'
        ordering = ['-anio', '-mes', 'empresa']
        unique_together = [['empresa', 'anio', 'mes', 'tipo_estado']]

    MESES_ES = [
        '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ]

    @property
    def periodo_label(self):
        return f'{self.MESES_ES[self.mes]} {self.anio}'

    def __str__(self):
        return f'{self.empresa} — {self.periodo_label} ({self.get_tipo_estado_display()})'


class ValorCuenta(models.Model):
    """Valor de una cuenta para un período/empresa. Null = celda en blanco."""

    periodo = models.ForeignKey(
        PeriodoImport,
        on_delete=models.CASCADE,
        related_name='valores',
        verbose_name='período',
    )
    cuenta = models.ForeignKey(
        CuentaContable,
        on_delete=models.PROTECT,
        related_name='valores',
        verbose_name='cuenta',
    )
    valor = models.DecimalField(
        'valor (Bs.)', max_digits=18, decimal_places=2,
        null=True, blank=True,
    )

    class Meta:
        verbose_name = 'valor de cuenta'
        verbose_name_plural = 'valores de cuenta'
        unique_together = [['periodo', 'cuenta']]
        default_permissions = ()  # solo lectura en admin

    def __str__(self):
        return f'{self.periodo} | {self.cuenta.nombre}: {self.valor}'
