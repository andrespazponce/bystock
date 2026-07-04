from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers

from .models import MensajeConsulta, ReporteFinanciero


class ReporteFinancieroSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source='empresa.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    periodo_tipo_display = serializers.CharField(source='get_periodo_tipo_display', read_only=True)
    periodo_label = serializers.SerializerMethodField()
    subido_por = serializers.SerializerMethodField()
    url_descarga = serializers.SerializerMethodField()
    total_consultas = serializers.SerializerMethodField()

    class Meta:
        model = ReporteFinanciero
        fields = [
            'id',
            'empresa', 'empresa_nombre',
            'tipo', 'tipo_display',
            'periodo_tipo', 'periodo_tipo_display', 'periodo_label',
            'anio', 'mes', 'trimestre', 'semestre',
            'titulo', 'descripcion', 'publicado',
            'sha256',
            'url_descarga',
            'subido_por',
            'total_consultas',
            'creado_en',
        ]
        read_only_fields = ['sha256', 'creado_en']

    def get_periodo_label(self, obj):
        return obj.periodo_display()

    def get_subido_por(self, obj):
        if obj.creado_por:
            nombre = obj.creado_por.get_full_name()
            return nombre if nombre.strip() else obj.creado_por.email
        return ''

    def get_url_descarga(self, obj):
        request = self.context.get('request')
        url = reverse('finanzas:descargar_reporte', args=[obj.pk])
        return request.build_absolute_uri(url) if request else url

    def get_total_consultas(self, obj):
        return obj.consultas.count()


class ReporteFinancieroWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReporteFinanciero
        fields = [
            'empresa', 'tipo', 'periodo_tipo',
            'anio', 'mes', 'trimestre', 'semestre',
            'titulo', 'descripcion', 'archivo', 'publicado',
        ]

    def to_representation(self, instance):
        return ReporteFinancieroSerializer(instance, context=self.context).data


class MensajeConsultaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()
    respondido_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MensajeConsulta
        fields = [
            'id', 'reporte',
            'usuario', 'usuario_nombre',
            'mensaje',
            'respondido', 'respuesta',
            'respondido_por', 'respondido_por_nombre',
            'fecha_consulta', 'fecha_respuesta',
        ]
        read_only_fields = [
            'usuario', 'respondido', 'respondido_por',
            'fecha_consulta', 'fecha_respuesta',
        ]

    def get_usuario_nombre(self, obj):
        if obj.usuario:
            nombre = obj.usuario.get_full_name()
            return nombre.strip() if nombre.strip() else obj.usuario.email
        return ''

    def get_respondido_por_nombre(self, obj):
        if obj.respondido_por:
            nombre = obj.respondido_por.get_full_name()
            return nombre.strip() if nombre.strip() else obj.respondido_por.email
        return None


class ResponderConsultaSerializer(serializers.Serializer):
    respuesta = serializers.CharField(min_length=1)
