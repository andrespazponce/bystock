import django.db.models.deletion
import django.db.models.manager
from django.conf import settings
from django.db import migrations, models

import finanzas.models


class Migration(migrations.Migration):

    dependencies = [
        ('finanzas', '0001_initial'),
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CuentaContable',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=20, unique=True, verbose_name='código')),
                ('nombre', models.CharField(max_length=200, verbose_name='nombre')),
                ('nombre_excel', models.CharField(
                    help_text='Texto exacto de la celda en el archivo (búsqueda case-insensitive).',
                    max_length=200,
                    verbose_name='nombre en Excel',
                )),
                ('tipo_estado', models.CharField(
                    choices=[('BG', 'Balance General'), ('ER', 'Estado de Resultados'), ('FC', 'Flujo de Caja')],
                    default='BG',
                    max_length=2,
                    verbose_name='tipo de estado',
                )),
                ('tipo', models.CharField(
                    choices=[('ACTIVO', 'Activo'), ('PASIVO', 'Pasivo'), ('PATRIMONIO', 'Patrimonio'), ('TOTAL', 'Total')],
                    max_length=15,
                    verbose_name='tipo',
                )),
                ('es_cabecera', models.BooleanField(
                    default=False,
                    help_text='Si True, se muestra en negrita y sin valor propio.',
                    verbose_name='es cabecera',
                )),
                ('es_total', models.BooleanField(
                    default=False,
                    help_text='Si True, es una fila de subtotal o total.',
                    verbose_name='es total',
                )),
                ('orden', models.PositiveSmallIntegerField(verbose_name='orden')),
                ('activa', models.BooleanField(default=True, verbose_name='activa')),
                ('padre', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='hijos',
                    to='finanzas.cuentacontable',
                    verbose_name='cuenta padre',
                )),
            ],
            options={
                'verbose_name': 'cuenta contable',
                'verbose_name_plural': 'cuentas contables',
                'ordering': ['orden'],
            },
        ),
        migrations.CreateModel(
            name='PeriodoImport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('creado_en', models.DateTimeField(auto_now_add=True, verbose_name='creado en')),
                ('modificado_en', models.DateTimeField(auto_now=True, verbose_name='modificado en')),
                ('eliminado', models.BooleanField(default=False, editable=False)),
                ('eliminado_en', models.DateTimeField(blank=True, editable=False, null=True)),
                ('anio', models.PositiveIntegerField(verbose_name='año')),
                ('mes', models.PositiveSmallIntegerField(verbose_name='mes')),
                ('tipo_estado', models.CharField(
                    choices=[('BG', 'Balance General'), ('ER', 'Estado de Resultados'), ('FC', 'Flujo de Caja')],
                    default='BG',
                    max_length=2,
                    verbose_name='tipo de estado',
                )),
                ('archivo', models.FileField(blank=True, upload_to='finanzas/imports/%Y/%m/', verbose_name='archivo original')),
                ('publicado', models.BooleanField(default=True, verbose_name='publicado')),
                ('creado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='%(class)s_creados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='creado por',
                )),
                ('eliminado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='%(class)s_eliminados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='eliminado por',
                )),
                ('empresa', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='periodos_financieros',
                    to='core.empresa',
                    verbose_name='empresa',
                )),
                ('modificado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='%(class)s_modificados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='modificado por',
                )),
            ],
            options={
                'verbose_name': 'período importado',
                'verbose_name_plural': 'períodos importados',
                'ordering': ['-anio', '-mes', 'empresa'],
                'unique_together': {('empresa', 'anio', 'mes', 'tipo_estado')},
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('todos', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='ValorCuenta',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('valor', models.DecimalField(
                    blank=True, decimal_places=2, max_digits=18, null=True, verbose_name='valor (Bs.)',
                )),
                ('cuenta', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='valores',
                    to='finanzas.cuentacontable',
                    verbose_name='cuenta',
                )),
                ('periodo', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='valores',
                    to='finanzas.periodoimport',
                    verbose_name='período',
                )),
            ],
            options={
                'verbose_name': 'valor de cuenta',
                'verbose_name_plural': 'valores de cuenta',
                'default_permissions': (),
                'unique_together': {('periodo', 'cuenta')},
            },
        ),
    ]
