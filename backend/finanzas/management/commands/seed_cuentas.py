"""
python manage.py seed_cuentas

Carga el plan de cuentas estándar Bolivia en la base de datos.
Siembra: Balance General (BG), Estado de Resultados (ER), Flujo de Caja (FC).
Es idempotente: si una cuenta ya existe (por codigo) la actualiza sin duplicar.
"""

from django.core.management.base import BaseCommand

from finanzas.cuentas_data import (
    CUENTAS_BALANCE_GENERAL,
    CUENTAS_ESTADO_RESULTADOS,
    CUENTAS_FLUJO_CAJA,
)
from finanzas.models import CuentaContable

PLANES = [
    ('BG', 'Balance General',       CUENTAS_BALANCE_GENERAL),
    ('ER', 'Estado de Resultados',   CUENTAS_ESTADO_RESULTADOS),
    ('FC', 'Flujo de Caja',          CUENTAS_FLUJO_CAJA),
]


def _sembrar_plan(tipo_estado, cuentas, stdout, style):
    """Dos pasadas: crear sin padres, luego asignar padres."""
    codigos = {}

    # Primera pasada — crear/actualizar sin padre
    for datos in cuentas:
        cuenta, creado = CuentaContable.objects.update_or_create(
            codigo=datos['codigo'],
            defaults={
                'nombre':       datos['nombre'],
                'nombre_excel': datos['nombre_excel'],
                'tipo_estado':  tipo_estado,
                'tipo':         datos['tipo'],
                'es_cabecera':  datos['es_cabecera'],
                'es_total':     datos['es_total'],
                'orden':        datos['orden'],
                'activa':       True,
                'padre':        None,
            },
        )
        codigos[datos['codigo']] = cuenta
        verbo = 'Creada' if creado else 'Actualizada'
        stdout.write(f'    {verbo}: {cuenta}')

    # Segunda pasada — asignar padres
    for datos in cuentas:
        if datos['padre']:
            cuenta = codigos[datos['codigo']]
            padre  = codigos.get(datos['padre'])
            if padre and cuenta.padre_id != padre.pk:
                cuenta.padre = padre
                cuenta.save(update_fields=['padre'])

    stdout.write(style.SUCCESS(f'  ✓ {len(cuentas)} cuentas ({tipo_estado})\n'))


class Command(BaseCommand):
    help = 'Carga el plan de cuentas estándar Bolivia (BG + ER + FC).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tipo', choices=['BG', 'ER', 'FC'],
            help='Sembrar solo un tipo (por defecto: todos).',
        )

    def handle(self, *args, **options):
        tipo_filtro = options.get('tipo')

        for tipo_estado, nombre, cuentas in PLANES:
            if tipo_filtro and tipo_estado != tipo_filtro:
                continue
            self.stdout.write(f'\n── {nombre} ──')
            _sembrar_plan(tipo_estado, cuentas, self.stdout, self.style)

        self.stdout.write(self.style.SUCCESS('Catálogo de cuentas actualizado correctamente.'))
