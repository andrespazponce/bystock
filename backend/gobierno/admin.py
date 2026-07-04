from django.contrib import admin

from reuniones.models import PuntoRecurrente

from .models import Miembro, Organo

AUDIT_FIELDS = ('creado_por', 'creado_en', 'modificado_por', 'modificado_en')


class MiembroInline(admin.TabularInline):
    model = Miembro
    extra = 0
    fields = ('persona', 'rol', 'fecha_inicio', 'fecha_fin', 'activo')
    autocomplete_fields = ('persona',)


class PuntoRecurrenteInline(admin.TabularInline):
    model = PuntoRecurrente
    extra = 0
    fields = ('orden', 'titulo', 'descripcion', 'activo')
    ordering = ('orden',)


@admin.register(Organo)
class OrganoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo', 'empresa', 'activo')
    list_filter = ('tipo', 'empresa', 'activo')
    search_fields = ('nombre',)
    readonly_fields = AUDIT_FIELDS
    inlines = [MiembroInline, PuntoRecurrenteInline]


@admin.register(Miembro)
class MiembroAdmin(admin.ModelAdmin):
    list_display = ('persona', 'organo', 'rol', 'activo')
    list_filter = ('rol', 'activo', 'organo__tipo')
    search_fields = ('persona__nombres', 'persona__apellidos', 'organo__nombre')
    autocomplete_fields = ('persona', 'organo')
    readonly_fields = AUDIT_FIELDS
