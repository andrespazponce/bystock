from datetime import date

import django_filters
from django.db.models import Q

from .models import Compromiso, Documento, Reunion


class ReunionFilter(django_filters.FilterSet):
    """Filtros del list endpoint de reuniones.

    Permite combinar: ?organo=<id>&gestion=<año>&estado=<CONVOCADA|...>&tipo=<...>.
    Todos son opcionales; sin parámetros devuelve todas las reuniones vivas."""

    class Meta:
        model = Reunion
        fields = ['organo', 'gestion', 'estado', 'tipo']


class CompromisoFilter(django_filters.FilterSet):
    """Filtros del tablero de compromisos.

    ?estado=PENDIENTE&responsable=<id>&para_proxima_reunion=true
    ?abierto=true  → los que siguen por resolver (Por hacer o En proceso).
    ?vencido=true  → solo los ABIERTOS cuya fecha límite ya pasó."""

    vencido = django_filters.BooleanFilter(method='filter_vencido')
    abierto = django_filters.BooleanFilter(method='filter_abierto')

    class Meta:
        model = Compromiso
        fields = ['estado', 'responsable', 'para_proxima_reunion']

    def filter_abierto(self, queryset, name, value):
        # "Abierto" = trabajo pendiente: Por hacer o En proceso (no Realizado/Cancelado).
        condicion = Q(estado__in=Compromiso.ESTADOS_ABIERTOS)
        return queryset.filter(condicion) if value else queryset.exclude(condicion)

    def filter_vencido(self, queryset, name, value):
        # "Vencido" = abierto (Por hacer/En proceso) Y con fecha límite anterior a hoy.
        condicion = Q(estado__in=Compromiso.ESTADOS_ABIERTOS, fecha_limite__lt=date.today())
        return queryset.filter(condicion) if value else queryset.exclude(condicion)


class DocumentoFilter(django_filters.FilterSet):
    """Filtros del repositorio de documentos: ?tipo=<...>&empresa=<id>.
    También por contexto: ?acta=<id> (documentos de un acta) y ?punto=<id>
    (documentos de un punto del orden del día).
    La búsqueda por texto (título/descripción) la maneja SearchFilter (?search=)."""

    class Meta:
        model = Documento
        fields = ['tipo', 'empresa', 'acta', 'punto']
