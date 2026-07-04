from rest_framework import serializers

from accounts.serializers import PersonaLiteSerializer
from core.models import Empresa
from .models import Miembro, Organo


class EmpresaLiteSerializer(serializers.ModelSerializer):
    """Datos mínimos de la empresa para anidar en otras respuestas."""

    class Meta:
        model = Empresa
        fields = ['id', 'nombre', 'codigo']


class EmpresaSerializer(serializers.ModelSerializer):
    """Datos completos de empresa (incluye activa/inactiva). Usado en Ajustes."""

    class Meta:
        model = Empresa
        fields = ['id', 'nombre', 'codigo', 'activa']


class EmpresaWriteSerializer(serializers.ModelSerializer):
    """Serializer de escritura para Empresa (solo is_staff)."""

    class Meta:
        model = Empresa
        fields = ['nombre', 'codigo', 'activa']

    def to_representation(self, instance):
        return EmpresaSerializer(instance).data


# ── Órgano ───────────────────────────────────────────────────────────────────

class OrganoSerializer(serializers.ModelSerializer):
    """Órgano con empresa anidada. Usado en selectores y en el portal."""

    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    empresa = EmpresaLiteSerializer(read_only=True)

    class Meta:
        model = Organo
        fields = ['id', 'nombre', 'tipo', 'tipo_display', 'empresa', 'activo', 'descripcion']


class OrganoWriteSerializer(serializers.ModelSerializer):
    """Serializer de escritura para Organo (solo is_staff)."""

    class Meta:
        model = Organo
        fields = ['empresa', 'nombre', 'tipo', 'descripcion', 'activo']

    def to_representation(self, instance):
        return OrganoSerializer(instance).data


# ── Miembro ──────────────────────────────────────────────────────────────────

class MiembroManageSerializer(serializers.ModelSerializer):
    """Lectura de miembro para la gestión en Ajustes."""

    persona = PersonaLiteSerializer(read_only=True)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)

    class Meta:
        model = Miembro
        fields = [
            'id', 'organo', 'persona', 'rol', 'rol_display',
            'fecha_inicio', 'fecha_fin', 'activo',
        ]


class MiembroWriteSerializer(serializers.ModelSerializer):
    """Serializer de escritura para Miembro (solo is_staff).

    Valida manualmente la unicidad (organo, persona) porque el UniqueConstraint
    del modelo es CONDICIONAL (eliminado=False) y DRF no lo aplica solo.
    """

    class Meta:
        model = Miembro
        fields = ['organo', 'persona', 'rol', 'fecha_inicio', 'fecha_fin', 'activo']

    def validate(self, data):
        organo = data.get('organo', getattr(self.instance, 'organo', None))
        persona = data.get('persona', getattr(self.instance, 'persona', None))
        qs = Miembro.objects.filter(organo=organo, persona=persona)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'persona': 'Esta persona ya es miembro de este órgano.'}
            )
        return data

    def to_representation(self, instance):
        return MiembroManageSerializer(instance).data
