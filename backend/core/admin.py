from django.contrib import admin

from .models import Empresa

AUDIT_FIELDS = ('creado_por', 'creado_en', 'modificado_por', 'modificado_en')


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'codigo', 'activa', 'creado_en')
    search_fields = ('nombre', 'codigo')
    list_filter = ('activa',)
    readonly_fields = AUDIT_FIELDS
