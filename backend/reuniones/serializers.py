from datetime import date

from django.urls import reverse
from rest_framework import serializers

from accounts.serializers import PersonaLiteSerializer
from gobierno.serializers import EmpresaLiteSerializer, OrganoSerializer
from .models import Acta, Asistencia, Compromiso, Documento, PuntoOrden, PuntoTag, Resolucion, Reunion, Tag


# ── Tags ──────────────────────────────────────────────────────────────────────

class TagSerializer(serializers.ModelSerializer):
    """Tag del catálogo corporativo (sólo lectura desde el portal)."""

    puntos_count = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = ['id', 'slug', 'categoria', 'nombre_display', 'descripcion', 'color', 'activo', 'puntos_count']

    def get_puntos_count(self, obj):
        return obj.punto_tags.count()


class PuntoTagDisplaySerializer(serializers.ModelSerializer):
    """PuntoTag para LECTURA anidada (tag completo + metadatos de la asignación)."""

    tag = TagSerializer(read_only=True)

    class Meta:
        model = PuntoTag
        fields = ['id', 'tag', 'notas', 'origen', 'creado_en']


class PuntoTagCreateSerializer(serializers.Serializer):
    """Datos para AÑADIR un tag a un punto (POST /api/puntos/{id}/tags/)."""

    tag_slug = serializers.CharField(max_length=100)
    notas = serializers.CharField(required=False, allow_blank=True, default='')


class TagHistoriaItemSerializer(serializers.Serializer):
    """Ítem de la línea de tiempo de un tag (acción GET /api/tags/{slug}/historia/)."""

    id = serializers.IntegerField()
    notas = serializers.CharField(allow_blank=True)
    origen = serializers.CharField()
    creado_en = serializers.DateTimeField()
    punto_id = serializers.IntegerField()
    punto_titulo = serializers.CharField()
    punto_orden = serializers.IntegerField()
    reunion_id = serializers.IntegerField()
    reunion_fecha = serializers.DateField()
    reunion_numero = serializers.IntegerField()
    reunion_gestion = serializers.IntegerField()
    organo_nombre = serializers.CharField()


# ── Reuniones ─────────────────────────────────────────────────────────────────

class ReunionListSerializer(serializers.ModelSerializer):
    """Representa una reunión para la pantalla de LISTA del portal.

    Incluye el órgano anidado (con su empresa) y las etiquetas legibles de los
    choices (tipo/modalidad/estado), para que el frontend no tenga que mapear
    códigos a texto. Es de solo lectura."""

    organo = OrganoSerializer(read_only=True)
    etiqueta = serializers.SerializerMethodField()
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    modalidad_display = serializers.CharField(source='get_modalidad_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Reunion
        fields = [
            'id',
            'numero', 'gestion', 'etiqueta',
            'fecha', 'fecha_fin', 'hora_inicio', 'hora_fin', 'lugar',
            'tipo', 'tipo_display',
            'modalidad', 'modalidad_display',
            'estado', 'estado_display',
            'organo',
        ]

    def get_etiqueta(self, obj):
        """Correlativo formateado, p. ej. 'Nº 04/2026'."""
        return f'Nº {obj.numero:02d}/{obj.gestion}'


# --- Serializers anidados para el DETALLE de una reunión ---

class DocumentoLiteSerializer(serializers.ModelSerializer):
    """Documento adjunto, con la URL de la descarga segura (no la ruta del
    archivo en disco). El frontend descarga por esa URL autenticada."""

    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    url_descarga = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = ['id', 'titulo', 'tipo', 'tipo_display', 'fecha', 'url_descarga']

    def get_url_descarga(self, obj):
        return reverse('reuniones:descargar_documento', args=[obj.pk])


class ResolucionSerializer(serializers.ModelSerializer):
    resultado_display = serializers.CharField(source='get_resultado_display', read_only=True)

    class Meta:
        model = Resolucion
        fields = ['id', 'texto', 'resultado', 'resultado_display', 'por_unanimidad']


class CompromisoSerializer(serializers.ModelSerializer):
    responsable = PersonaLiteSerializer(read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Compromiso
        fields = [
            'id', 'descripcion', 'responsable',
            'fecha_limite', 'para_proxima_reunion',
            'estado', 'estado_display',
        ]


class PuntoOrdenSerializer(serializers.ModelSerializer):
    empresa = EmpresaLiteSerializer(read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    resoluciones = ResolucionSerializer(many=True, read_only=True)
    compromisos = CompromisoSerializer(many=True, read_only=True)
    documentos = DocumentoLiteSerializer(many=True, read_only=True)
    punto_tags = PuntoTagDisplaySerializer(many=True, read_only=True)

    class Meta:
        model = PuntoOrden
        fields = [
            'id', 'orden', 'titulo', 'desarrollo', 'resumen',
            'estado', 'estado_display', 'empresa',
            'resoluciones', 'compromisos', 'documentos',
            'punto_tags',
        ]


class AsistenciaSerializer(serializers.ModelSerializer):
    persona = PersonaLiteSerializer(read_only=True)
    calidad_display = serializers.CharField(source='get_calidad_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Asistencia
        fields = ['id', 'persona', 'calidad', 'calidad_display', 'estado', 'estado_display']


class ActaSerializer(serializers.ModelSerializer):
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    redactada_por = PersonaLiteSerializer(read_only=True)
    firmada_por = PersonaLiteSerializer(many=True, read_only=True)
    documentos = DocumentoLiteSerializer(many=True, read_only=True)

    class Meta:
        model = Acta
        fields = [
            'id', 'contenido', 'estado', 'estado_display',
            'redactada_por', 'fecha_aprobacion', 'firmada_por', 'documentos',
        ]


class ActaWriteSerializer(serializers.ModelSerializer):
    """Escritura del acta (crear/editar). `redactada_por` y `firmada_por` se
    envían como ids de Persona. Una reunión tiene UNA sola acta (OneToOne); al
    crear se valida que no exista ya, para devolver un error claro en vez de un
    500 por la restricción de unicidad."""

    class Meta:
        model = Acta
        fields = [
            'id', 'reunion', 'contenido', 'estado',
            'redactada_por', 'fecha_aprobacion', 'firmada_por',
        ]

    def validate(self, attrs):
        # Solo al CREAR: que la reunión no tenga ya un acta viva.
        if self.instance is None:
            reunion = attrs.get('reunion')
            if reunion is not None and Acta.objects.filter(reunion=reunion).exists():
                raise serializers.ValidationError(
                    {'reunion': 'Esta reunión ya tiene un acta.'})
        return attrs

    def to_representation(self, instance):
        return ActaSerializer(instance, context=self.context).data


class ReunionDetailSerializer(ReunionListSerializer):
    """Reunión completa para la pantalla de DETALLE: suma asistentes, orden del
    día (con sus resoluciones, compromisos y documentos) y el acta."""

    asistencias = AsistenciaSerializer(many=True, read_only=True)
    puntos = PuntoOrdenSerializer(many=True, read_only=True)
    acta = serializers.SerializerMethodField()

    class Meta(ReunionListSerializer.Meta):
        fields = ReunionListSerializer.Meta.fields + [
            'observaciones', 'asistencias', 'puntos', 'acta',
        ]

    def get_acta(self, obj):
        # La relación es OneToOne y puede no existir: lo manejamos sin reventar.
        try:
            acta = obj.acta
        except Acta.DoesNotExist:
            return None
        return ActaSerializer(acta, context=self.context).data


class ReunionWriteSerializer(serializers.ModelSerializer):
    """Serializer de ESCRITURA para crear/editar la CABECERA de una reunión
    desde el portal (órgano, correlativo, fechas, tipo/modalidad/estado, lugar y
    observaciones). El orden del día y las asistencias se cargan aparte (tienen
    sus propias sub-rebanadas). El órgano se recibe por id.

    Requiere el permiso reuniones.add_reunion (crear) o change_reunion (editar),
    que se otorga por el grupo 'Gestores de reuniones'."""

    class Meta:
        model = Reunion
        fields = [
            'id', 'organo',
            'numero', 'gestion',
            'fecha', 'fecha_fin', 'hora_inicio', 'hora_fin',
            'lugar', 'tipo', 'modalidad', 'estado', 'observaciones',
        ]

    def validate(self, attrs):
        # Para PATCH (partial) algunos campos pueden no venir: tomamos el valor
        # entrante o, si falta, el que ya tiene la instancia.
        def val(campo):
            return attrs.get(campo, getattr(self.instance, campo, None))

        organo, gestion, numero = val('organo'), val('gestion'), val('numero')

        # Correlativo único (organo, gestión, número) entre reuniones VIVAS.
        # El UniqueConstraint del modelo es CONDICIONAL (eliminado=False), así
        # que DRF no lo aplica automáticamente: lo validamos a mano.
        if organo and gestion and numero:
            qs = Reunion.objects.filter(organo=organo, gestion=gestion, numero=numero)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {'numero': f'Ya existe la reunión Nº {numero:02d}/{gestion} para ese órgano.'},
                )

        # Coherencia de fechas: el fin no puede ser anterior al inicio.
        fecha, fecha_fin = val('fecha'), val('fecha_fin')
        if fecha and fecha_fin and fecha_fin < fecha:
            raise serializers.ValidationError(
                {'fecha_fin': 'La fecha de fin no puede ser anterior a la de inicio.'},
            )
        return attrs

    def to_representation(self, instance):
        # Respondemos con la forma de LISTA (órgano anidado, etiqueta, labels)
        # para que el frontend tenga datos ricos sin volver a consultar.
        return ReunionListSerializer(instance, context=self.context).data


class PuntoOrdenManageSerializer(serializers.ModelSerializer):
    """Punto del orden del día para la pantalla de GESTIÓN (crear/editar).

    A diferencia del serializer de DETALLE (PuntoOrdenSerializer), incluye
    `notas_crudas` (insumo interno para redactar el desarrollo) para que el
    formulario de edición pueda precargarlo, y NO trae resoluciones/compromisos/
    documentos (la gestión de esos cuelga de sus propios endpoints)."""

    empresa = EmpresaLiteSerializer(read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = PuntoOrden
        fields = [
            'id', 'reunion', 'orden', 'titulo',
            'desarrollo', 'resumen', 'notas_crudas',
            'estado', 'estado_display', 'empresa',
        ]


class PuntoOrdenWriteSerializer(serializers.ModelSerializer):
    """Serializer de ESCRITURA de un punto del orden del día.

    El `orden` es opcional al crear: si no viene, se asigna el siguiente
    disponible en la reunión. La empresa es opcional (id, puede ser null).
    El campo `viene_de` (seguimiento de una resolución anterior) queda fuera por
    ahora; se sumará cuando haya un selector de resoluciones."""

    class Meta:
        model = PuntoOrden
        fields = [
            'id', 'reunion', 'orden', 'titulo',
            'desarrollo', 'resumen', 'notas_crudas', 'empresa', 'estado',
        ]
        extra_kwargs = {'orden': {'required': False}}

    def validate(self, attrs):
        # En PATCH parcial algunos campos pueden faltar: tomamos el entrante o el
        # de la instancia.
        def val(campo):
            return attrs.get(campo, getattr(self.instance, campo, None))

        reunion, orden = val('reunion'), val('orden')
        # Orden único dentro de la reunión (entre puntos vivos). El
        # UniqueConstraint del modelo es condicional (eliminado=False), así que
        # lo validamos a mano para dar un error claro en vez de un 500.
        if reunion is not None and orden is not None:
            qs = PuntoOrden.objects.filter(reunion=reunion, orden=orden)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {'orden': f'Ya existe un punto con el orden {orden} en esta reunión.'},
                )
        return attrs

    def create(self, validated_data):
        # Si no se especificó el orden, lo ponemos al final del orden del día.
        if not validated_data.get('orden'):
            ultimo = (
                PuntoOrden.objects.filter(reunion=validated_data['reunion'])
                .order_by('-orden')
                .first()
            )
            validated_data['orden'] = (ultimo.orden + 1) if ultimo else 1
        return super().create(validated_data)

    def to_representation(self, instance):
        # Respondemos con la forma de gestión (incluye orden/estado_display/empresa).
        return PuntoOrdenManageSerializer(instance, context=self.context).data


class AsistenciaManageSerializer(serializers.ModelSerializer):
    """Asistencia para la pantalla de GESTIÓN (lista de la reunión).

    Igual que AsistenciaSerializer (persona anidada + labels) pero incluye el id
    de la reunión, útil al refrescar la lista tras crear/editar."""

    persona = PersonaLiteSerializer(read_only=True)
    calidad_display = serializers.CharField(source='get_calidad_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Asistencia
        fields = [
            'id', 'reunion', 'persona',
            'calidad', 'calidad_display',
            'estado', 'estado_display',
        ]


class AsistenciaWriteSerializer(serializers.ModelSerializer):
    """Serializer de ESCRITURA de una asistencia (registrar quién asistió y en
    qué calidad/estado). La persona se recibe por id.

    Requiere reuniones.change_reunion (las asistencias son parte de la reunión).
    """

    class Meta:
        model = Asistencia
        fields = ['id', 'reunion', 'persona', 'calidad', 'estado']

    def validate(self, attrs):
        # En PATCH parcial algunos campos pueden faltar: tomamos el entrante o el
        # de la instancia.
        def val(campo):
            return attrs.get(campo, getattr(self.instance, campo, None))

        reunion, persona = val('reunion'), val('persona')
        # Una persona no puede figurar dos veces en la misma reunión. El
        # UniqueConstraint del modelo es condicional (eliminado=False), así que
        # lo validamos a mano para dar un error claro en vez de un 500.
        if reunion is not None and persona is not None:
            qs = Asistencia.objects.filter(reunion=reunion, persona=persona)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {'persona': 'Esa persona ya está registrada en esta reunión.'},
                )
        return attrs

    def to_representation(self, instance):
        # Respondemos con la forma de gestión (persona anidada + labels).
        return AsistenciaManageSerializer(instance, context=self.context).data


class CompromisoListSerializer(serializers.ModelSerializer):
    """Compromiso para el TABLERO de pendientes. Incluye el responsable y el
    origen (reunión + punto) para poder navegar, y un flag `vencido` calculado
    (pendiente con fecha límite ya pasada)."""

    responsable = PersonaLiteSerializer(read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    vencido = serializers.SerializerMethodField()
    reunion_id = serializers.IntegerField(source='punto.reunion.id', read_only=True)
    reunion_etiqueta = serializers.SerializerMethodField()
    organo = serializers.CharField(source='punto.reunion.organo.nombre', read_only=True)
    punto_titulo = serializers.CharField(source='punto.titulo', read_only=True)

    class Meta:
        model = Compromiso
        fields = [
            'id', 'descripcion', 'responsable',
            'fecha_limite', 'para_proxima_reunion',
            'estado', 'estado_display', 'vencido',
            'reunion_id', 'reunion_etiqueta', 'organo', 'punto_titulo',
        ]

    def get_vencido(self, obj):
        return bool(
            obj.fecha_limite
            and obj.estado in Compromiso.ESTADOS_ABIERTOS
            and obj.fecha_limite < date.today()
        )

    def get_reunion_etiqueta(self, obj):
        r = obj.punto.reunion
        return f'Nº {r.numero:02d}/{r.gestion}'


class CompromisoEstadoSerializer(serializers.ModelSerializer):
    """Serializer de ESCRITURA acotado: solo permite cambiar el `estado` de un
    compromiso (PENDIENTE/CUMPLIDO/CANCELADO). Todo lo demás es de solo lectura.
    Se usa en el PATCH del tablero de compromisos."""

    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Compromiso
        fields = ['id', 'estado', 'estado_display']
        read_only_fields = ['id']


# --- ESCRITURA: resoluciones y compromisos de un punto del orden del día ---

class ResolucionManageSerializer(serializers.ModelSerializer):
    """Resolución para la pantalla de GESTIÓN de un punto (lectura)."""

    resultado_display = serializers.CharField(source='get_resultado_display', read_only=True)

    class Meta:
        model = Resolucion
        fields = ['id', 'punto', 'texto', 'resultado', 'resultado_display', 'por_unanimidad']


class ResolucionWriteSerializer(serializers.ModelSerializer):
    """Serializer de ESCRITURA de una resolución (decisión tomada en un punto).

    Requiere reuniones.change_reunion (la resolución es parte de la reunión)."""

    class Meta:
        model = Resolucion
        fields = ['id', 'punto', 'texto', 'resultado', 'por_unanimidad']

    def to_representation(self, instance):
        return ResolucionManageSerializer(instance, context=self.context).data


class CompromisoManageSerializer(serializers.ModelSerializer):
    """Compromiso para la pantalla de GESTIÓN de un punto (lectura).

    A diferencia de CompromisoListSerializer (tablero, con origen/vencido para
    navegar), expone los campos editables del compromiso: responsable anidado,
    resolución de la que nace (id), plazo, bandera y estado."""

    responsable = PersonaLiteSerializer(read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Compromiso
        fields = [
            'id', 'punto', 'resolucion', 'descripcion', 'responsable',
            'fecha_limite', 'para_proxima_reunion', 'estado', 'estado_display',
        ]


class CompromisoWriteSerializer(serializers.ModelSerializer):
    """Serializer de ESCRITURA de un compromiso desde la gestión de la reunión
    (crear/editar/quitar). El responsable y la resolución se reciben por id.

    Requiere reuniones.change_reunion (el compromiso es parte de la reunión).
    NOTA: el tablero general usa otro endpoint (CompromisoViewSet) acotado a
    cambiar el estado, con el permiso change_compromiso."""

    class Meta:
        model = Compromiso
        fields = [
            'id', 'punto', 'resolucion', 'descripcion', 'responsable',
            'fecha_limite', 'para_proxima_reunion', 'estado',
        ]

    def validate(self, attrs):
        # En PATCH parcial algunos campos pueden faltar: tomamos el entrante o el
        # de la instancia.
        def val(campo):
            return attrs.get(campo, getattr(self.instance, campo, None))

        punto, resolucion = val('punto'), val('resolucion')
        # Si se enlaza una resolución, debe ser del MISMO punto (no tendría
        # sentido un compromiso que nace de una resolución de otro punto).
        if resolucion is not None and punto is not None and resolucion.punto_id != punto.id:
            raise serializers.ValidationError(
                {'resolucion': 'La resolución debe pertenecer al mismo punto.'},
            )
        return attrs

    def to_representation(self, instance):
        return CompromisoManageSerializer(instance, context=self.context).data


class DocumentoListSerializer(serializers.ModelSerializer):
    """Documento para el REPOSITORIO central. Incluye la empresa, la URL de la
    descarga segura y —si corresponde— la reunión de origen (derivada del acta
    o del punto al que está vinculado)."""

    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    empresa = EmpresaLiteSerializer(read_only=True)
    url_descarga = serializers.SerializerMethodField()
    reunion = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = [
            'id', 'titulo', 'descripcion', 'tipo', 'tipo_display',
            'fecha', 'empresa', 'url_descarga', 'reunion',
        ]

    def get_url_descarga(self, obj):
        return reverse('reuniones:descargar_documento', args=[obj.pk])

    def get_reunion(self, obj):
        # El documento puede colgar de un acta, de un punto, o de ninguno.
        reunion = None
        if obj.acta_id:
            reunion = obj.acta.reunion
        elif obj.punto_id:
            reunion = obj.punto.reunion
        if reunion is None:
            return None
        return {
            'id': reunion.id,
            'etiqueta': f'Nº {reunion.numero:02d}/{reunion.gestion}',
            'organo': reunion.organo.nombre,
        }


class DocumentoWriteSerializer(serializers.ModelSerializer):
    """Subida de un documento (multipart). `archivo` es obligatorio; el hash
    SHA-256 lo calcula el modelo al guardar. Se puede vincular —opcionalmente— a
    una `empresa`, a un `acta` o a un `punto` (todos por id). La respuesta usa
    DocumentoListSerializer (tipo_display, empresa anidada, url_descarga, origen)."""

    class Meta:
        model = Documento
        fields = [
            'id', 'titulo', 'descripcion', 'tipo', 'archivo',
            'fecha', 'empresa', 'acta', 'punto',
        ]

    def to_representation(self, instance):
        return DocumentoListSerializer(instance, context=self.context).data
