"""
Amplía los choices del campo `tipo` en CuentaContable para soportar
Estado de Resultados (INGRESO, COSTO, GASTO) y Flujo de Caja (FLUJO).
No modifica el esquema de la base de datos (solo metadata de Django).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finanzas', '0002_add_contabilidad'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cuentacontable',
            name='tipo',
            field=models.CharField(
                choices=[
                    ('ACTIVO',     'Activo'),
                    ('PASIVO',     'Pasivo'),
                    ('PATRIMONIO', 'Patrimonio'),
                    ('INGRESO',    'Ingreso'),
                    ('COSTO',      'Costo'),
                    ('GASTO',      'Gasto'),
                    ('FLUJO',      'Flujo'),
                    ('TOTAL',      'Total'),
                ],
                max_length=15,
                verbose_name='tipo',
            ),
        ),
    ]
