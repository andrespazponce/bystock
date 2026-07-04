from django.contrib import admin

from .models import Activo


@admin.register(Activo)
class ActivoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'empresa', 'tipo', 'estado', 'valor', 'fecha_adquisicion']
    list_filter = ['empresa', 'categoria', 'estado']
    search_fields = ['nombre', 'placa', 'nro_serie', 'nro_catastral', 'direccion']
    readonly_fields = ['categoria', 'creado_en', 'modificado_en', 'creado_por', 'modificado_por']
