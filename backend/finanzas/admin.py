from django.contrib import admin

from .models import (
    CuentaContable,
    MensajeConsulta,
    PeriodoImport,
    RegistroDescargaReporte,
    ReporteFinanciero,
    ValorCuenta,
)


# ── Contabilidad estructurada ─────────────────────────────────────────────────

@admin.register(CuentaContable)
class CuentaContableAdmin(admin.ModelAdmin):
    list_display  = ['codigo', 'nombre', 'tipo_estado', 'tipo', 'orden', 'es_cabecera', 'es_total', 'activa']
    list_filter   = ['tipo_estado', 'tipo', 'es_cabecera', 'es_total', 'activa']
    search_fields = ['codigo', 'nombre', 'nombre_excel']
    ordering      = ['orden']
    readonly_fields = ['codigo']


class ValorCuentaInline(admin.TabularInline):
    model  = ValorCuenta
    extra  = 0
    fields = ['cuenta', 'valor']
    readonly_fields = ['cuenta']

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PeriodoImport)
class PeriodoImportAdmin(admin.ModelAdmin):
    list_display  = ['empresa', 'anio', 'mes', 'tipo_estado', 'publicado', 'creado_en']
    list_filter   = ['empresa', 'tipo_estado', 'anio', 'publicado']
    search_fields = ['empresa__nombre']
    ordering      = ['-anio', '-mes', 'empresa']
    readonly_fields = ['creado_en', 'modificado_en', 'creado_por', 'modificado_por']
    inlines       = [ValorCuentaInline]


@admin.register(ValorCuenta)
class ValorCuentaAdmin(admin.ModelAdmin):
    list_display  = ['periodo', 'cuenta', 'valor']
    list_filter   = ['periodo__empresa', 'periodo__anio', 'cuenta__tipo_estado']
    search_fields = ['cuenta__nombre', 'periodo__empresa__nombre']
    readonly_fields = ['periodo', 'cuenta']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# ── Reportes documentales (Fase 1) ───────────────────────────────────────────

@admin.register(ReporteFinanciero)
class ReporteFinancieroAdmin(admin.ModelAdmin):
    list_display = ['empresa', 'tipo', 'periodo_tipo', 'anio', 'mes', 'trimestre', 'semestre', 'publicado', 'creado_en']
    list_filter = ['empresa', 'tipo', 'periodo_tipo', 'anio', 'publicado']
    search_fields = ['titulo', 'descripcion', 'empresa__nombre']
    readonly_fields = ['sha256', 'creado_en', 'modificado_en', 'creado_por', 'modificado_por']


@admin.register(MensajeConsulta)
class MensajeConsultaAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'reporte', 'respondido', 'fecha_consulta']
    list_filter = ['respondido']
    search_fields = ['mensaje', 'respuesta', 'usuario__email']
    readonly_fields = ['fecha_consulta', 'fecha_respuesta']


@admin.register(RegistroDescargaReporte)
class RegistroDescargaReporteAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'titulo_snapshot', 'ip', 'fecha']
    search_fields = ['titulo_snapshot', 'usuario__email']
    readonly_fields = ['reporte', 'titulo_snapshot', 'usuario', 'ip', 'user_agent', 'fecha']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
