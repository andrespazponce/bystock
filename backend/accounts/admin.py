from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _

from .models import CustomUser, Persona, RegistroAcceso

AUDIT_FIELDS = ('creado_por', 'creado_en', 'modificado_por', 'modificado_en')


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'documento_identidad', 'es_socio', 'telefono', 'tiene_cuenta')
    list_filter = ('es_socio',)
    search_fields = ('nombres', 'apellidos', 'documento_identidad')
    readonly_fields = AUDIT_FIELDS

    @admin.display(boolean=True, description='¿Tiene cuenta?')
    def tiene_cuenta(self, obj):
        return hasattr(obj, 'usuario') and obj.usuario is not None


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'persona', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_active', 'is_superuser')
    search_fields = ('email', 'persona__nombres', 'persona__apellidos')
    ordering = ('email',)
    readonly_fields = ('last_login', 'date_joined')
    autocomplete_fields = ('persona',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Persona'), {'fields': ('persona',)}),
        (_('Permisos'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Fechas'), {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'is_staff', 'is_active'),
        }),
    )


@admin.register(RegistroAcceso)
class RegistroAccesoAdmin(admin.ModelAdmin):
    """Bitácora de accesos: solo lectura. No se puede crear, editar ni borrar
    desde el admin para preservar la integridad de la auditoría."""

    list_display = ('creado_en', 'email_intentado', 'exito', 'via', 'ip', 'usuario')
    list_filter = ('exito', 'via', 'creado_en')
    search_fields = ('email_intentado', 'ip', 'user_agent')
    date_hierarchy = 'creado_en'
    readonly_fields = (
        'email_intentado', 'usuario', 'exito', 'via',
        'ip', 'user_agent', 'pais', 'ciudad', 'creado_en',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
