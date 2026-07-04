from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import CustomUser, Persona


class PersonaLiteSerializer(serializers.ModelSerializer):
    """Datos mínimos de una persona para anidar en otras respuestas
    (asistentes, responsables de compromisos, firmantes de actas...)."""

    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = Persona
        fields = ['id', 'nombre_completo', 'es_socio']

    def get_nombre_completo(self, obj):
        return str(obj)


class PersonaSerializer(serializers.ModelSerializer):
    """Datos completos de persona para la vista de Ajustes (is_staff)."""

    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = Persona
        fields = [
            'id', 'nombres', 'apellidos', 'nombre_completo',
            'documento_identidad', 'telefono', 'es_socio', 'fecha_ingreso',
        ]

    def get_nombre_completo(self, obj):
        return str(obj)


class PersonaWriteSerializer(serializers.ModelSerializer):
    """Serializer de escritura para Persona (solo is_staff)."""

    class Meta:
        model = Persona
        fields = ['nombres', 'apellidos', 'documento_identidad', 'telefono', 'es_socio', 'fecha_ingreso']

    def to_representation(self, instance):
        return PersonaSerializer(instance).data


class MeSerializer(serializers.ModelSerializer):
    """Datos del usuario autenticado para el frontend.

    La identidad (nombre) vive en Persona, así que la exponemos derivada;
    si la cuenta no tiene Persona asociada, caemos al email."""

    nombre_completo = serializers.SerializerMethodField()
    persona_id = serializers.IntegerField(read_only=True)
    es_socio = serializers.SerializerMethodField()
    puede_gestionar_compromisos = serializers.SerializerMethodField()
    puede_gestionar_reuniones = serializers.SerializerMethodField()
    grupos = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id',
            'email',
            'nombre_completo',
            'persona_id',
            'es_socio',
            'is_staff',
            'is_superuser',
            'puede_gestionar_compromisos',
            'puede_gestionar_reuniones',
            'grupos',
        )

    def get_nombre_completo(self, obj):
        return obj.get_full_name()

    def get_es_socio(self, obj):
        return bool(obj.persona_id and obj.persona.es_socio)

    def get_puede_gestionar_compromisos(self, obj):
        """Refleja el permiso de cambiar el estado de compromisos.

        El frontend lo usa para mostrar/ocultar los botones de acción. Se otorga
        por GRUPO ('Gestores de compromisos') o a superusuarios (que pasan todo)."""
        return obj.has_perm('reuniones.change_compromiso')

    def get_puede_gestionar_reuniones(self, obj):
        """Refleja el permiso de crear/editar reuniones desde el portal.

        El frontend lo usa para mostrar/ocultar los botones 'Nueva reunión' y
        'Editar'. Se otorga por GRUPO ('Gestores de reuniones') o a superusuarios."""
        return obj.has_perm('reuniones.change_reunion')

    def get_grupos(self, obj):
        """Nombres de los grupos (perfiles) a los que pertenece el usuario."""
        return list(obj.groups.values_list('name', flat=True))


# ── Grupo ────────────────────────────────────────────────────────────────────

class GrupoSerializer(serializers.ModelSerializer):
    """Grupo de permisos (Gestores de reuniones, Gestores de compromisos…)."""

    class Meta:
        model = Group
        fields = ['id', 'name']


# ── Usuario (gestión admin) ──────────────────────────────────────────────────

class UsuarioSerializer(serializers.ModelSerializer):
    """Datos completos de usuario para la vista de Ajustes (is_staff)."""

    nombre_completo = serializers.SerializerMethodField()
    persona_nombre = serializers.SerializerMethodField()
    grupos = GrupoSerializer(source='groups', many=True, read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'nombre_completo',
            'persona', 'persona_nombre',
            'is_active', 'is_staff', 'is_superuser',
            'grupos', 'date_joined',
        ]

    def get_nombre_completo(self, obj):
        return obj.get_full_name()

    def get_persona_nombre(self, obj):
        return str(obj.persona) if obj.persona_id else None


class UsuarioCreateSerializer(serializers.ModelSerializer):
    """Serializer de creación de usuario (solo is_staff).

    Exige email + contraseña inicial y acepta opcionalmente la persona
    vinculada, is_staff y la lista de grupos (IDs)."""

    password = serializers.CharField(write_only=True, min_length=8)
    grupos = serializers.PrimaryKeyRelatedField(
        source='groups',
        queryset=Group.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = CustomUser
        fields = ['email', 'password', 'persona', 'is_staff', 'grupos']

    def create(self, validated_data):
        grupos = validated_data.pop('groups', [])
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        user.groups.set(grupos)
        return user

    def to_representation(self, instance):
        return UsuarioSerializer(instance, context=self.context).data


class UsuarioUpdateSerializer(serializers.ModelSerializer):
    """Serializer de edición de usuario (solo is_staff).

    Acepta cualquier subconjunto de campos: persona, is_active, is_staff,
    grupos y una contraseña opcional (para el reset admin)."""

    grupos = serializers.PrimaryKeyRelatedField(
        source='groups',
        queryset=Group.objects.all(),
        many=True,
        required=False,
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        min_length=8,
    )

    class Meta:
        model = CustomUser
        fields = ['persona', 'is_active', 'is_staff', 'grupos', 'password']

    def validate_password(self, value):
        """Ignorar cadena vacía; si se provee, Django la valida."""
        if not value:
            return value
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def update(self, instance, validated_data):
        grupos = validated_data.pop('groups', None)   # None → no tocar
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if grupos is not None:
            instance.groups.set(grupos)
        return instance

    def to_representation(self, instance):
        return UsuarioSerializer(instance, context=self.context).data


class GrupoDetalleSerializer(serializers.ModelSerializer):
    """Grupo con la lista completa de usuarios miembros.

    Devuelve cada usuario anidado como UsuarioSerializer (datos completos).
    Solo se usa en el retrieve y en las acciones agregar/quitar del
    GrupoViewSet (is_staff)."""

    usuarios = UsuarioSerializer(source='user_set', many=True, read_only=True)
    descripcion = serializers.SerializerMethodField()

    # Descripciones fijas de los grupos conocidos del sistema.
    DESCRIPCIONES: dict[str, str] = {
        'Gestores de reuniones': (
            'Pueden crear y editar reuniones, gestionar el orden del día, '
            'registrar asistentes, redactar actas y adjuntar documentos.'
        ),
        'Gestores de compromisos': (
            'Pueden cambiar el estado de los compromisos '
            '(Por hacer → En proceso → Realizado / Cancelado).'
        ),
    }

    class Meta:
        model = Group
        fields = ['id', 'name', 'descripcion', 'usuarios']

    def get_descripcion(self, obj: Group) -> str:
        return self.DESCRIPCIONES.get(obj.name, '')


class CambiarPasswordSerializer(serializers.Serializer):
    """Cambio de contraseña del propio usuario autenticado.

    Exige la contraseña ACTUAL (para que un token robado no baste para
    secuestrar la cuenta) y valida la NUEVA con los validadores de Django
    (longitud mínima, no demasiado común, no solo numérica, etc.)."""

    password_actual = serializers.CharField(write_only=True, style={'input_type': 'password'})
    password_nueva = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate_password_actual(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual no es correcta.')
        return value

    def validate_password_nueva(self, value):
        user = self.context['request'].user
        try:
            validate_password(value, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate(self, attrs):
        if attrs['password_actual'] == attrs['password_nueva']:
            raise serializers.ValidationError(
                {'password_nueva': 'La nueva contraseña no puede ser igual a la actual.'},
            )
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['password_nueva'])
        user.save(update_fields=['password'])
        return user
