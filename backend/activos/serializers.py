from rest_framework import serializers

from .models import Activo, ActivoDocumento


class ActivoListSerializer(serializers.ModelSerializer):
    """Versión compacta para listado y mapa (sin todos los campos opcionales)."""

    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    tiene_ubicacion = serializers.SerializerMethodField()

    class Meta:
        model = Activo
        fields = [
            'id', 'nombre', 'empresa', 'empresa_nombre',
            'categoria', 'categoria_display', 'tipo', 'tipo_display',
            'estado', 'estado_display',
            'departamento', 'ciudad', 'direccion',
            'latitud', 'longitud',
            'tiene_ubicacion',
            'valor', 'fecha_adquisicion',
        ]

    def get_tiene_ubicacion(self, obj):
        return obj.latitud is not None and obj.longitud is not None


class ActivoSerializer(serializers.ModelSerializer):
    """Serializer completo para detalle, creación y edición."""

    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    estado_inmueble_display = serializers.CharField(
        source='get_estado_inmueble_display', read_only=True
    )

    class Meta:
        model = Activo
        fields = [
            'id',
            # Comunes
            'nombre', 'empresa', 'empresa_nombre',
            'categoria', 'categoria_display', 'tipo', 'tipo_display',
            'estado', 'estado_display',
            'valor', 'fecha_adquisicion', 'notas',
            # Ubicación
            'departamento', 'ciudad', 'direccion',
            'latitud', 'longitud',
            # Inmueble
            'estado_inmueble', 'estado_inmueble_display',
            'area_m2', 'nro_catastral', 'nro_habitaciones',
            # Vehículo / Maquinaria
            'placa', 'marca', 'modelo_descripcion', 'anio', 'nro_serie', 'color',
            # Auditoría (solo lectura)
            'creado_en', 'modificado_en',
        ]
        read_only_fields = ['categoria', 'creado_en', 'modificado_en']


class ActivoDocumentoSerializer(serializers.ModelSerializer):
    """Serializer para documentos adjuntos a un activo."""

    nombre_archivo = serializers.ReadOnlyField()
    extension = serializers.ReadOnlyField()
    url_archivo = serializers.SerializerMethodField()

    class Meta:
        model = ActivoDocumento
        fields = [
            'id', 'activo', 'titulo', 'archivo',
            'nombre_archivo', 'extension', 'url_archivo',
            'creado_en',
        ]
        read_only_fields = ['creado_en']
        extra_kwargs = {
            'archivo': {'write_only': False},
            'activo': {'required': False},
        }

    def get_url_archivo(self, obj):
        request = self.context.get('request')
        if obj.archivo and request:
            return request.build_absolute_uri(obj.archivo.url)
        return None
