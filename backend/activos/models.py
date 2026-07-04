import os

from django.db import models

from core.models import AuditModel


def activo_documento_upload_to(instance, filename):
    """Ruta de guardado: activos/<activo_id>/<nombre_archivo>."""
    return f'activos/{instance.activo_id}/{filename}'


class Activo(AuditModel):
    """Activo de cualquier empresa del grupo corporativo.
    Un solo modelo con campos opcionales agrupados por categoría,
    ya que todos comparten ubicación, estado y datos de adquisición."""

    # ── Categorías ──────────────────────────────────────────────────────────
    CATEGORIA_INMUEBLE = 'INMUEBLE'
    CATEGORIA_VEHICULO = 'VEHICULO'
    CATEGORIA_MAQUINARIA = 'MAQUINARIA'

    CATEGORIA_CHOICES = [
        (CATEGORIA_INMUEBLE, 'Inmueble'),
        (CATEGORIA_VEHICULO, 'Vehículo'),
        (CATEGORIA_MAQUINARIA, 'Maquinaria / Equipo'),
    ]

    # ── Tipos ───────────────────────────────────────────────────────────────
    # Inmuebles
    TIPO_LOTE = 'LOTE'
    TIPO_CASA = 'CASA'
    TIPO_DEPARTAMENTO = 'DEPARTAMENTO'
    TIPO_LOCAL = 'LOCAL'
    TIPO_OFICINA = 'OFICINA'
    TIPO_TERRENO = 'TERRENO'
    # Vehículos
    TIPO_AUTO = 'AUTO'
    TIPO_MOTO = 'MOTO'
    TIPO_CAMION = 'CAMION'
    TIPO_MINIBUS = 'MINIBUS'
    # Maquinaria
    TIPO_MAQUINARIA_PESADA = 'MAQUINARIA_PESADA'
    TIPO_EQUIPO = 'EQUIPO'

    TIPO_CHOICES = [
        (TIPO_LOTE, 'Lote'),
        (TIPO_CASA, 'Casa'),
        (TIPO_DEPARTAMENTO, 'Departamento'),
        (TIPO_LOCAL, 'Local comercial'),
        (TIPO_OFICINA, 'Oficina'),
        (TIPO_TERRENO, 'Terreno'),
        (TIPO_AUTO, 'Automóvil'),
        (TIPO_MOTO, 'Motocicleta'),
        (TIPO_CAMION, 'Camión / Furgoneta'),
        (TIPO_MINIBUS, 'Minibús'),
        (TIPO_MAQUINARIA_PESADA, 'Maquinaria pesada'),
        (TIPO_EQUIPO, 'Equipo / Herramienta'),
    ]

    # Mapeo tipo → categoría (se asigna automáticamente al guardar)
    TIPO_A_CATEGORIA = {
        TIPO_LOTE: CATEGORIA_INMUEBLE,
        TIPO_CASA: CATEGORIA_INMUEBLE,
        TIPO_DEPARTAMENTO: CATEGORIA_INMUEBLE,
        TIPO_LOCAL: CATEGORIA_INMUEBLE,
        TIPO_OFICINA: CATEGORIA_INMUEBLE,
        TIPO_TERRENO: CATEGORIA_INMUEBLE,
        TIPO_AUTO: CATEGORIA_VEHICULO,
        TIPO_MOTO: CATEGORIA_VEHICULO,
        TIPO_CAMION: CATEGORIA_VEHICULO,
        TIPO_MINIBUS: CATEGORIA_VEHICULO,
        TIPO_MAQUINARIA_PESADA: CATEGORIA_MAQUINARIA,
        TIPO_EQUIPO: CATEGORIA_MAQUINARIA,
    }

    # ── Estados generales ───────────────────────────────────────────────────
    ESTADO_ACTIVO = 'ACTIVO'
    ESTADO_MANTENIMIENTO = 'EN_MANTENIMIENTO'
    ESTADO_VENDIDO = 'VENDIDO'
    ESTADO_BAJA = 'BAJA'

    ESTADO_CHOICES = [
        (ESTADO_ACTIVO, 'Activo'),
        (ESTADO_MANTENIMIENTO, 'En mantenimiento'),
        (ESTADO_VENDIDO, 'Vendido'),
        (ESTADO_BAJA, 'Baja'),
    ]

    # ── Estados exclusivos INMUEBLE ─────────────────────────────────────────
    ESTADO_INMUEBLE_SIN_PROYECTO = 'SIN_PROYECTO'
    ESTADO_INMUEBLE_POR_REGULARIZAR = 'POR_REGULARIZAR'
    ESTADO_INMUEBLE_EN_PROYECTO = 'EN_PROYECTO'
    ESTADO_INMUEBLE_PROYECTO_TERMINADO = 'PROYECTO_TERMINADO'

    ESTADO_INMUEBLE_CHOICES = [
        (ESTADO_INMUEBLE_SIN_PROYECTO, 'Sin proyecto'),
        (ESTADO_INMUEBLE_POR_REGULARIZAR, 'Por regularizar'),
        (ESTADO_INMUEBLE_EN_PROYECTO, 'En proyecto'),
        (ESTADO_INMUEBLE_PROYECTO_TERMINADO, 'Proyecto terminado'),
    ]

    # ── Campos comunes ──────────────────────────────────────────────────────
    nombre = models.CharField('nombre', max_length=200)
    empresa = models.ForeignKey(
        'core.Empresa',
        on_delete=models.PROTECT,
        related_name='activos',
        verbose_name='empresa',
    )
    categoria = models.CharField('categoría', max_length=20, choices=CATEGORIA_CHOICES)
    tipo = models.CharField('tipo', max_length=20, choices=TIPO_CHOICES)
    estado = models.CharField(
        'estado', max_length=20, choices=ESTADO_CHOICES, default=ESTADO_ACTIVO
    )
    valor = models.DecimalField(
        'valor (USD)', max_digits=14, decimal_places=2, null=True, blank=True
    )
    fecha_adquisicion = models.DateField('fecha de adquisición', null=True, blank=True)
    notas = models.TextField('notas', blank=True)

    # ── Ubicación ────────────────────────────────────────────────────────────
    departamento = models.CharField('departamento', max_length=100, blank=True)
    ciudad = models.CharField('ciudad', max_length=100, blank=True)
    direccion = models.CharField('dirección', max_length=300, blank=True)
    latitud = models.DecimalField(
        'latitud', max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitud = models.DecimalField(
        'longitud', max_digits=9, decimal_places=6, null=True, blank=True
    )

    # ── Campos exclusivos INMUEBLE ───────────────────────────────────────────
    estado_inmueble = models.CharField(
        'estado del inmueble',
        max_length=25,
        choices=ESTADO_INMUEBLE_CHOICES,
        default=ESTADO_INMUEBLE_SIN_PROYECTO,
        blank=True,
    )
    area_m2 = models.DecimalField(
        'área (m²)', max_digits=12, decimal_places=2, null=True, blank=True
    )
    nro_catastral = models.CharField('N° catastral', max_length=100, blank=True)
    nro_habitaciones = models.PositiveSmallIntegerField(
        'N° habitaciones', null=True, blank=True
    )

    # ── Campos exclusivos VEHÍCULO / MAQUINARIA ─────────────────────────────
    placa = models.CharField('placa / matrícula', max_length=20, blank=True)
    marca = models.CharField('marca', max_length=100, blank=True)
    modelo_descripcion = models.CharField('modelo', max_length=100, blank=True)
    anio = models.PositiveSmallIntegerField('año', null=True, blank=True)
    nro_serie = models.CharField('N° de serie / chasis', max_length=100, blank=True)
    color = models.CharField('color', max_length=50, blank=True)

    class Meta:
        verbose_name = 'activo'
        verbose_name_plural = 'activos'
        ordering = ['empresa', 'categoria', 'nombre']

    def __str__(self):
        return f'{self.nombre} ({self.get_tipo_display()}) — {self.empresa}'

    def save(self, *args, **kwargs):
        # Auto-asigna categoría según el tipo seleccionado
        if self.tipo:
            self.categoria = self.TIPO_A_CATEGORIA.get(self.tipo, self.categoria)
        super().save(*args, **kwargs)


class ActivoDocumento(AuditModel):
    """Documento asociado a un activo (escritura, plano, foto, póliza, etc.)."""

    activo = models.ForeignKey(
        Activo,
        on_delete=models.CASCADE,
        related_name='documentos',
        verbose_name='activo',
    )
    titulo = models.CharField(
        'título / descripción', max_length=200, blank=True,
        help_text='Descripción breve del documento (opcional).',
    )
    archivo = models.FileField(
        'archivo',
        upload_to=activo_documento_upload_to,
        max_length=300,
        help_text='PDF, imagen u otro formato. Máx. 30 MB.',
    )

    class Meta:
        verbose_name = 'documento de activo'
        verbose_name_plural = 'documentos de activos'
        ordering = ['-creado_en']

    def __str__(self):
        return f'{self.titulo or self.nombre_archivo} — {self.activo}'

    @property
    def nombre_archivo(self):
        return os.path.basename(self.archivo.name) if self.archivo else ''

    @property
    def extension(self):
        _, ext = os.path.splitext(self.nombre_archivo)
        return ext.lower().lstrip('.')
