import hashlib

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models

from core.models import AuditModel


def validar_tamano_archivo(archivo):
    """Rechaza archivos que superen MAX_UPLOAD_SIZE_MB."""
    limite_mb = getattr(settings, 'MAX_UPLOAD_SIZE_MB', 20)
    if archivo.size > limite_mb * 1024 * 1024:
        raise ValidationError(f'El archivo supera el tamaño máximo de {limite_mb} MB.')


def documento_upload_to(instance, filename):
    """Ruta de guardado: documentos/<gestion>/<archivo>."""
    import datetime
    anio = (instance.fecha or datetime.date.today()).year
    return f'documentos/{anio}/{filename}'


class PuntoRecurrente(AuditModel):
    """Punto fijo del orden del día de un órgano (p. ej. 'Control de Asistencia',
    'Informe ICPs', 'Informe GDIs'). Funciona como MOLDE: al generar el orden del
    día de una reunión, estos puntos se COPIAN a PuntoOrden (no se enlazan), para
    que cada acta quede congelada con su propio contenido."""

    organo = models.ForeignKey(
        'gobierno.Organo',
        on_delete=models.CASCADE,
        related_name='puntos_recurrentes',
    )
    orden = models.PositiveIntegerField(help_text='Posición sugerida en el orden del día.')
    titulo = models.CharField('título', max_length=255)
    descripcion = models.TextField('descripción', blank=True, help_text='Nota guía de qué trata el punto (opcional).')
    activo = models.BooleanField(default=True, help_text='Desmarcá para excluirlo sin borrarlo.')

    class Meta:
        verbose_name = 'punto recurrente'
        verbose_name_plural = 'puntos recurrentes (plantilla)'
        ordering = ['organo', 'orden']
        constraints = [
            models.UniqueConstraint(
                fields=['organo', 'orden'],
                condition=models.Q(eliminado=False),
                name='unique_orden_recurrente_por_organo',
            ),
        ]

    def __str__(self):
        return f'{self.orden}. {self.titulo} ({self.organo.nombre})'


class Reunion(AuditModel):
    """Una sesión concreta de un órgano de gobierno (p. ej. la Reunión de
    Directorio Nº 04/2026). Puede abarcar más de un día (cuarto intermedio)."""

    class Tipo(models.TextChoices):
        ORDINARIA = 'ORDINARIA', 'Ordinaria'
        EXTRAORDINARIA = 'EXTRAORDINARIA', 'Extraordinaria'

    class Modalidad(models.TextChoices):
        PRESENCIAL = 'PRESENCIAL', 'Presencial'
        VIRTUAL = 'VIRTUAL', 'Virtual'
        MIXTA = 'MIXTA', 'Mixta'

    class Estado(models.TextChoices):
        CONVOCADA = 'CONVOCADA', 'Convocada'
        REALIZADA = 'REALIZADA', 'Realizada'
        CANCELADA = 'CANCELADA', 'Cancelada'

    organo = models.ForeignKey(
        'gobierno.Organo',
        on_delete=models.PROTECT,
        related_name='reuniones',
    )
    numero = models.PositiveIntegerField('número', help_text='Correlativo dentro de la gestión (ej. 4 para "Nº 04/2026").')
    gestion = models.PositiveIntegerField('gestión', help_text='Año de la gestión (ej. 2026).')

    fecha = models.DateField('fecha de inicio')
    fecha_fin = models.DateField(
        'fecha de fin', null=True, blank=True,
        help_text='Solo si la reunión abarcó más de un día (cuarto intermedio).',
    )
    hora_inicio = models.TimeField('hora de inicio', null=True, blank=True)
    hora_fin = models.TimeField('hora de fin', null=True, blank=True)

    lugar = models.CharField(max_length=255, blank=True)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.ORDINARIA)
    modalidad = models.CharField(max_length=20, choices=Modalidad.choices, default=Modalidad.PRESENCIAL)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.CONVOCADA)
    observaciones = models.TextField(blank=True)

    class Meta:
        verbose_name = 'reunión'
        verbose_name_plural = 'reuniones'
        ordering = ['-gestion', '-numero']
        constraints = [
            # No repetir el mismo número de reunión por órgano y gestión (entre los no eliminados)
            models.UniqueConstraint(
                fields=['organo', 'gestion', 'numero'],
                condition=models.Q(eliminado=False),
                name='unique_numero_reunion_por_organo_gestion',
            ),
        ]

    def __str__(self):
        return f'{self.organo.nombre} — Nº {self.numero:02d}/{self.gestion}'


class Asistencia(AuditModel):
    """Registro de quién asistió a una reunión y en qué calidad.
    Apunta a Persona (no a Miembro): puede asistir un socio invitado o un
    externo que no es miembro del órgano (p. ej. el secretario de actas)."""

    class Calidad(models.TextChoices):
        MIEMBRO = 'MIEMBRO', 'Miembro del órgano'
        SOCIO = 'SOCIO', 'Socio invitado'
        SECRETARIO = 'SECRETARIO', 'Secretario de actas'
        INVITADO = 'INVITADO', 'Invitado externo'

    class Estado(models.TextChoices):
        PRESENTE = 'PRESENTE', 'Presente'
        AUSENTE = 'AUSENTE', 'Ausente'
        EXCUSA = 'EXCUSA', 'Con excusa'
        DELEGO = 'DELEGO', 'Delegó'

    reunion = models.ForeignKey(
        'reuniones.Reunion',
        on_delete=models.CASCADE,
        related_name='asistencias',
    )
    persona = models.ForeignKey(
        'accounts.Persona',
        on_delete=models.PROTECT,
        related_name='asistencias',
    )
    calidad = models.CharField(max_length=20, choices=Calidad.choices, default=Calidad.MIEMBRO)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PRESENTE)

    class Meta:
        verbose_name = 'asistencia'
        verbose_name_plural = 'asistencias'
        ordering = ['reunion', 'persona']
        constraints = [
            models.UniqueConstraint(
                fields=['reunion', 'persona'],
                condition=models.Q(eliminado=False),
                name='unique_persona_por_reunion',
            ),
        ]

    def __str__(self):
        return f'{self.persona} — {self.get_estado_display()} ({self.get_calidad_display()})'


class PuntoOrden(AuditModel):
    """Un punto del orden del día de una reunión (Punto Uno, Punto Dos...).
    Aquí se registra qué se habló (`desarrollo`) y de él cuelgan las
    resoluciones y los compromisos. Puede dar seguimiento a una resolución
    anterior (`viene_de`) y referirse a una empresa concreta."""

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        TRATADO = 'TRATADO', 'Tratado'
        POSPUESTO = 'POSPUESTO', 'Pospuesto'
        INFORMATIVO = 'INFORMATIVO', 'Informativo'

    reunion = models.ForeignKey(
        'reuniones.Reunion',
        on_delete=models.CASCADE,
        related_name='puntos',
    )
    orden = models.PositiveIntegerField(help_text='Posición en el orden del día (1, 2, 3...).')
    titulo = models.CharField('título', max_length=255)
    desarrollo = models.TextField(
        blank=True,
        help_text='Texto del acta para este punto, limpiado ortográficamente pero sin resumir. Puede generarse/asistirse con IA.',
    )
    resumen = models.TextField(
        'resumen',
        blank=True,
        help_text='Síntesis concisa de los aspectos más relevantes tratados. Generado/asistido por IA.',
    )
    notas_crudas = models.TextField(
        'notas crudas', blank=True,
        help_text='Material en bruto (apuntes, transcripción) como insumo para redactar el desarrollo.',
    )
    empresa = models.ForeignKey(
        'core.Empresa',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='puntos_tratados',
        help_text='Empresa sobre la que trata el punto (opcional).',
    )
    viene_de = models.ForeignKey(
        'reuniones.Resolucion',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='puntos_seguimiento',
        help_text='Resolución anterior a la que este punto da seguimiento (opcional).',
    )
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)

    class Meta:
        verbose_name = 'punto del orden del día'
        verbose_name_plural = 'puntos del orden del día'
        ordering = ['reunion', 'orden']
        constraints = [
            models.UniqueConstraint(
                fields=['reunion', 'orden'],
                condition=models.Q(eliminado=False),
                name='unique_orden_por_reunion',
            ),
        ]

    def __str__(self):
        return f'Punto {self.orden}: {self.titulo}'


class Resolucion(AuditModel):
    """Decisión o acuerdo concreto tomado en un punto del orden del día.
    Un punto puede tener 0, 1 o varias resoluciones."""

    class Resultado(models.TextChoices):
        APROBADA = 'APROBADA', 'Aprobada'
        RECHAZADA = 'RECHAZADA', 'Rechazada'
        POSPUESTA = 'POSPUESTA', 'Pospuesta'

    punto = models.ForeignKey(
        'reuniones.PuntoOrden',
        on_delete=models.CASCADE,
        related_name='resoluciones',
    )
    texto = models.TextField(help_text='El acuerdo tal como queda en el acta.')
    resultado = models.CharField(max_length=20, choices=Resultado.choices, default=Resultado.APROBADA)
    por_unanimidad = models.BooleanField('por unanimidad', default=True)

    class Meta:
        verbose_name = 'resolución'
        verbose_name_plural = 'resoluciones'
        ordering = ['punto', 'id']

    def __str__(self):
        return f'{self.get_resultado_display()}: {self.texto[:60]}'


class Compromiso(AuditModel):
    """Tarea o encargo asumido en la reunión, con responsable y plazo
    (p. ej. "el Lic. Hugo Paz presentará el POA en la próxima reunión").
    Es la base del seguimiento de pendientes entre reuniones."""

    class Estado(models.TextChoices):
        # Los CÓDIGOS se conservan (los datos existentes siguen válidos); cambian
        # las etiquetas y se suma EN_PROCESO para reflejar un flujo de trabajo real.
        PENDIENTE = 'PENDIENTE', 'Por hacer'
        EN_PROCESO = 'EN_PROCESO', 'En proceso'
        CUMPLIDO = 'CUMPLIDO', 'Realizado'
        CANCELADO = 'CANCELADO', 'Cancelado'

    # Estados "abiertos" (trabajo aún por resolver): excluye Realizado y Cancelado.
    ESTADOS_ABIERTOS = (Estado.PENDIENTE, Estado.EN_PROCESO)

    punto = models.ForeignKey(
        'reuniones.PuntoOrden',
        on_delete=models.CASCADE,
        related_name='compromisos',
    )
    resolucion = models.ForeignKey(
        'reuniones.Resolucion',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='compromisos',
        help_text='Resolución de la que nace el compromiso (opcional).',
    )
    descripcion = models.TextField('descripción')
    responsable = models.ForeignKey(
        'accounts.Persona',
        on_delete=models.PROTECT,
        related_name='compromisos',
    )
    fecha_limite = models.DateField('fecha límite', null=True, blank=True)
    para_proxima_reunion = models.BooleanField('para la próxima reunión', default=False)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)

    class Meta:
        verbose_name = 'compromiso'
        verbose_name_plural = 'compromisos'
        ordering = ['estado', 'fecha_limite']

    def __str__(self):
        return f'{self.descripcion[:60]} — {self.responsable} ({self.get_estado_display()})'


class Acta(AuditModel):
    """Documento que formaliza una reunión. Una reunión, un acta.
    Recorre los estados borrador → aprobada → firmada."""

    class Estado(models.TextChoices):
        BORRADOR = 'BORRADOR', 'Borrador'
        APROBADA = 'APROBADA', 'Aprobada'
        FIRMADA = 'FIRMADA', 'Firmada'

    reunion = models.OneToOneField(
        'reuniones.Reunion',
        on_delete=models.CASCADE,
        related_name='acta',
    )
    contenido = models.TextField(
        blank=True,
        help_text='Texto completo del acta. Puede generarse/asistirse con IA.',
    )
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.BORRADOR)
    redactada_por = models.ForeignKey(
        'accounts.Persona',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='actas_redactadas',
        help_text='Secretario que redacta el acta.',
    )
    fecha_aprobacion = models.DateField('fecha de aprobación', null=True, blank=True)
    firmada_por = models.ManyToManyField(
        'accounts.Persona',
        blank=True,
        related_name='actas_firmadas',
        help_text='Personas que suscribieron el acta.',
    )

    class Meta:
        verbose_name = 'acta'
        verbose_name_plural = 'actas'
        ordering = ['-reunion__gestion', '-reunion__numero']

    def __str__(self):
        return f'Acta de {self.reunion}'


class Documento(AuditModel):
    """Archivo respaldatorio del gobierno corporativo (acta firmada en PDF,
    informe, contrato, testimonio, estado financiero...). Se vincula —de forma
    opcional— a un Acta o a un Punto del orden del día. El archivo se guarda en
    una carpeta NO pública; la descarga segura (autenticada) se hará más adelante."""

    class Tipo(models.TextChoices):
        ACTA_FIRMADA = 'ACTA_FIRMADA', 'Acta firmada'
        INFORME = 'INFORME', 'Informe'
        CONTRATO = 'CONTRATO', 'Contrato'
        TESTIMONIO = 'TESTIMONIO', 'Testimonio / escritura'
        ESTADO_FINANCIERO = 'ESTADO_FINANCIERO', 'Estado financiero'
        OTRO = 'OTRO', 'Otro'

    titulo = models.CharField('título', max_length=255)
    descripcion = models.TextField('descripción', blank=True)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.OTRO)
    archivo = models.FileField(
        upload_to=documento_upload_to,
        validators=[
            FileExtensionValidator(
                allowed_extensions=settings.DOCUMENTO_EXTENSIONES_PERMITIDAS,
            ),
            validar_tamano_archivo,
        ],
        help_text='Archivo respaldatorio (PDF, Word, Excel o imagen).',
    )
    hash_sha256 = models.CharField(
        'hash SHA-256', max_length=64, blank=True, editable=False,
        help_text='Huella de integridad calculada automáticamente al subir el archivo.',
    )
    fecha = models.DateField('fecha del documento', null=True, blank=True)
    empresa = models.ForeignKey(
        'core.Empresa',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documentos',
        help_text='Empresa a la que pertenece el documento (opcional).',
    )
    acta = models.ForeignKey(
        'reuniones.Acta',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documentos',
        help_text='Acta a la que respalda este documento (opcional).',
    )
    punto = models.ForeignKey(
        'reuniones.PuntoOrden',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documentos',
        help_text='Punto del orden del día al que pertenece (opcional).',
    )

    class Meta:
        verbose_name = 'documento'
        verbose_name_plural = 'documentos'
        ordering = ['-fecha', '-creado_en']

    def __str__(self):
        return f'{self.get_tipo_display()}: {self.titulo}'

    def _calcular_hash(self):
        """Devuelve el SHA-256 del contenido del archivo (lee en bloques)."""
        sha = hashlib.sha256()
        self.archivo.open('rb')
        try:
            for bloque in iter(lambda: self.archivo.read(8192), b''):
                sha.update(bloque)
        finally:
            self.archivo.close()
        return sha.hexdigest()

    def save(self, *args, **kwargs):
        # ¿Hay un archivo recién subido que todavía no se persistió en disco?
        archivo_nuevo = bool(self.archivo) and not self.archivo._committed
        super().save(*args, **kwargs)  # persiste el archivo y la fila
        if self.archivo and (archivo_nuevo or not self.hash_sha256):
            nuevo_hash = self._calcular_hash()
            if nuevo_hash != self.hash_sha256:
                self.hash_sha256 = nuevo_hash
                super().save(update_fields=['hash_sha256'])


class RegistroDescarga(models.Model):
    """Bitácora INMUTABLE de accesos a documentos.

    Registra cada subida, descarga y eliminación: quién, cuándo y desde qué IP.
    NO hereda AuditModel (ella misma ES la auditoría; auditarse a sí misma sería
    circular). Solo lectura desde el admin; no se puede crear, editar ni borrar
    manualmente para preservar la integridad de la trazabilidad.

    Si el Documento es borrado del sistema, la FK queda NULL pero el snapshot
    del título conserva el rastro histórico.
    """

    SUBIDA = 'SUBIDA'
    DESCARGA = 'DESCARGA'
    ELIMINACION = 'ELIMINACION'
    ACCIONES = [
        (SUBIDA, 'Subida'),
        (DESCARGA, 'Descarga'),
        (ELIMINACION, 'Eliminación'),
    ]

    documento = models.ForeignKey(
        Documento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registros',
        verbose_name='documento',
        help_text='Puede quedar nulo si el documento es borrado físicamente del sistema.',
    )
    titulo = models.CharField(
        'título',
        max_length=255,
        help_text='Snapshot del título en el momento del acceso; '
                  'persiste aunque el documento se elimine.',
    )
    accion = models.CharField('acción', max_length=12, choices=ACCIONES)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='usuario',
        related_name='registros_documentos',
    )
    ip = models.GenericIPAddressField('dirección IP', null=True, blank=True)
    user_agent = models.TextField('user agent', blank=True)
    fecha = models.DateTimeField('fecha', auto_now_add=True)

    class Meta:
        verbose_name = 'registro de acceso a documento'
        verbose_name_plural = 'registros de acceso a documentos'
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.get_accion_display()} — {self.titulo} ({self.fecha:%Y-%m-%d %H:%M})'


# ── Sistema de Tags semánticos ────────────────────────────────────────────────

class Tag(AuditModel):
    """Etiqueta semántica del catálogo corporativo.

    Identifica temas, empresas, estados, intensidades y personas recurrentes
    en los puntos del orden del día. El `slug` tiene el formato `"categoria:nombre"`
    (ej. `"empresa:td"`, `"tema:intercambios"`) para garantizar unicidad y
    facilitar el filtrado por categoría sin consultar la BD.

    Los tags se crean a través del fixture inicial y se pueden añadir más desde
    el admin; no se crean desde el portal (para evitar proliferación)."""

    class Categoria(models.TextChoices):
        EMPRESA    = 'empresa',    'Empresa'
        TEMA       = 'tema',       'Tema'
        ESTADO     = 'estado',     'Estado / Resultado'
        INTENSIDAD = 'intensidad', 'Intensidad'
        PERSONA    = 'persona',    'Persona / Rol'

    # Colores por defecto según categoría (en caso de que color esté vacío)
    COLOR_CATEGORIA = {
        'empresa':    '#4a7fc1',
        'tema':       '#c9a84c',
        'estado':     '#4caf7c',
        'intensidad': '#c94c4c',
        'persona':    '#9c6abf',
    }

    slug = models.CharField(
        max_length=100, unique=True,
        help_text='Identificador único con formato "categoria:nombre", p. ej. "empresa:td".',
    )
    categoria = models.CharField(max_length=20, choices=Categoria.choices)
    nombre_display = models.CharField('nombre', max_length=100, help_text='Nombre legible que se muestra en la UI.')
    descripcion = models.TextField('descripción', blank=True, help_text='Para qué se usa este tag.')
    color = models.CharField(
        max_length=7, blank=True,
        help_text='Color hexadecimal (#rrggbb). Si está vacío se usa el color de la categoría.',
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'tag'
        verbose_name_plural = 'tags'
        ordering = ['categoria', 'nombre_display']

    def __str__(self):
        return f'{self.nombre_display} [{self.categoria}]'

    @property
    def color_efectivo(self):
        return self.color or self.COLOR_CATEGORIA.get(self.categoria, '#888888')


class PuntoTag(AuditModel):
    """Asignación de un tag a un punto del orden del día.

    Tabla de relación M2M enriquecida: guarda el origen (IA vs. manual) y
    las notas contextuales de por qué se asignó ese tag a ese punto.

    Un mismo punto puede tener múltiples tags; un mismo tag puede aparecer en
    múltiples puntos a lo largo de distintas reuniones (línea de tiempo)."""

    class Origen(models.TextChoices):
        IA     = 'IA',     'Generado por IA'
        MANUAL = 'MANUAL', 'Asignado manualmente'

    punto = models.ForeignKey(
        'reuniones.PuntoOrden',
        on_delete=models.CASCADE,
        related_name='punto_tags',
    )
    tag = models.ForeignKey(
        'reuniones.Tag',
        on_delete=models.CASCADE,
        related_name='punto_tags',
    )
    notas = models.TextField(
        blank=True,
        help_text='Contexto adicional de por qué se asignó este tag (opcional).',
    )
    origen = models.CharField(max_length=10, choices=Origen.choices, default=Origen.MANUAL)

    class Meta:
        verbose_name = 'punto-tag'
        verbose_name_plural = 'punto-tags'
        ordering = ['punto', 'tag']
        constraints = [
            models.UniqueConstraint(
                fields=['punto', 'tag'],
                condition=models.Q(eliminado=False),
                name='unique_tag_por_punto',
            ),
        ]

    def __str__(self):
        return f'{self.tag.nombre_display} → {self.punto}'
