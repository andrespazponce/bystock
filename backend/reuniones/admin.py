from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    Acta,
    Asistencia,
    Compromiso,
    Documento,
    PuntoOrden,
    PuntoRecurrente,
    RegistroDescarga,
    Reunion,
    Resolucion,
)

AUDIT_FIELDS = ('creado_por', 'creado_en', 'modificado_por', 'modificado_en')


class DocumentoInline(admin.TabularInline):
    model = Documento
    extra = 0
    fields = ('titulo', 'tipo', 'archivo', 'empresa', 'fecha')
    autocomplete_fields = ('empresa',)
    show_change_link = True


class AsistenciaInline(admin.TabularInline):
    model = Asistencia
    extra = 0
    fields = ('persona', 'calidad', 'estado')
    autocomplete_fields = ('persona',)


class PuntoOrdenInline(admin.TabularInline):
    model = PuntoOrden
    extra = 0
    fields = ('orden', 'titulo', 'empresa', 'estado')
    autocomplete_fields = ('empresa',)
    ordering = ('orden',)
    show_change_link = True


class ResolucionInline(admin.TabularInline):
    model = Resolucion
    extra = 0
    fields = ('texto', 'resultado', 'por_unanimidad')


class CompromisoInline(admin.TabularInline):
    model = Compromiso
    extra = 0
    fields = ('descripcion', 'responsable', 'fecha_limite', 'para_proxima_reunion', 'estado')
    autocomplete_fields = ('responsable',)


@admin.register(Reunion)
class ReunionAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'organo', 'fecha', 'tipo', 'estado')
    list_filter = ('estado', 'tipo', 'modalidad', 'organo__tipo', 'gestion')
    search_fields = ('numero', 'gestion', 'organo__nombre', 'lugar')
    autocomplete_fields = ('organo',)
    readonly_fields = AUDIT_FIELDS
    date_hierarchy = 'fecha'
    inlines = [AsistenciaInline, PuntoOrdenInline]
    actions = ['generar_orden_del_dia']

    @admin.action(description='Generar orden del día desde la plantilla del órgano')
    def generar_orden_del_dia(self, request, queryset):
        creados_total = 0
        for reunion in queryset:
            recurrentes = PuntoRecurrente.objects.filter(
                organo=reunion.organo, activo=True,
            ).order_by('orden')
            # Evitamos duplicar: si ya existe un punto con ese orden o ese título, se omite.
            ordenes = set(reunion.puntos.values_list('orden', flat=True))
            titulos = set(reunion.puntos.values_list('titulo', flat=True))
            for rec in recurrentes:
                if rec.orden in ordenes or rec.titulo in titulos:
                    continue
                PuntoOrden.objects.create(
                    reunion=reunion,
                    orden=rec.orden,
                    titulo=rec.titulo,
                )
                ordenes.add(rec.orden)
                titulos.add(rec.titulo)
                creados_total += 1
        self.message_user(
            request,
            f'{creados_total} punto(s) recurrente(s) agregado(s) a la(s) reunión(es) seleccionada(s).',
            messages.SUCCESS,
        )


@admin.register(PuntoOrden)
class PuntoOrdenAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'reunion', 'empresa', 'estado')
    list_filter = ('estado', 'empresa')
    search_fields = ('titulo', 'desarrollo', 'reunion__numero')
    autocomplete_fields = ('reunion', 'empresa', 'viene_de')
    readonly_fields = AUDIT_FIELDS
    inlines = [ResolucionInline, CompromisoInline, DocumentoInline]


@admin.register(Resolucion)
class ResolucionAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'punto', 'resultado', 'por_unanimidad')
    list_filter = ('resultado', 'por_unanimidad')
    search_fields = ('texto', 'punto__titulo')
    autocomplete_fields = ('punto',)
    readonly_fields = AUDIT_FIELDS


@admin.register(Compromiso)
class CompromisoAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'responsable', 'fecha_limite', 'estado')
    list_filter = ('estado', 'para_proxima_reunion')
    search_fields = ('descripcion', 'responsable__nombres', 'responsable__apellidos')
    autocomplete_fields = ('punto', 'resolucion', 'responsable')
    readonly_fields = AUDIT_FIELDS


@admin.register(Acta)
class ActaAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'estado', 'redactada_por', 'fecha_aprobacion')
    list_filter = ('estado',)
    search_fields = ('reunion__numero', 'contenido')
    autocomplete_fields = ('reunion', 'redactada_por')
    filter_horizontal = ('firmada_por',)
    readonly_fields = AUDIT_FIELDS
    inlines = [DocumentoInline]


@admin.register(RegistroDescarga)
class RegistroDescargaAdmin(admin.ModelAdmin):
    """Bitácora de accesos a documentos: solo lectura.

    No se puede crear, editar ni borrar desde el admin para preservar la
    integridad de la trazabilidad. Los registros los crea el sistema
    automáticamente en cada subida, descarga y eliminación."""

    list_display = ('fecha', 'accion', 'titulo', 'usuario', 'ip')
    list_filter = ('accion', 'fecha')
    search_fields = ('titulo', 'ip', 'usuario__email', 'user_agent')
    date_hierarchy = 'fecha'
    readonly_fields = ('documento', 'titulo', 'accion', 'usuario', 'ip', 'user_agent', 'fecha')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'tipo', 'empresa', 'fecha', 'acta', 'punto', 'descargar')
    list_filter = ('tipo', 'empresa')
    search_fields = ('titulo', 'descripcion', 'hash_sha256')
    autocomplete_fields = ('empresa', 'acta', 'punto')
    readonly_fields = AUDIT_FIELDS + ('hash_sha256', 'descargar')
    date_hierarchy = 'fecha'

    @admin.display(description='Descargar')
    def descargar(self, obj):
        """Enlace a la vista de descarga SEGURA (no a la URL /media/ pública)."""
        if obj.pk and obj.archivo:
            url = reverse('reuniones:descargar_documento', args=[obj.pk])
            return format_html('<a href="{}" target="_blank" rel="noopener">Ver / descargar</a>', url)
        return '—'
