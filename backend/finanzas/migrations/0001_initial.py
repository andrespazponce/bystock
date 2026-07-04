import django.core.validators
import django.db.models.deletion
import django.db.models.manager
from django.conf import settings
from django.db import migrations, models

import finanzas.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ReporteFinanciero',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('creado_en', models.DateTimeField(auto_now_add=True, verbose_name='creado en')),
                ('modificado_en', models.DateTimeField(auto_now=True, verbose_name='modificado en')),
                ('eliminado', models.BooleanField(default=False, editable=False)),
                ('eliminado_en', models.DateTimeField(blank=True, editable=False, null=True)),
                ('tipo', models.CharField(
                    choices=[
                        ('ESTADO_RESULTADOS', 'Estado de Resultados'),
                        ('BALANCE_GENERAL', 'Balance General'),
                        ('FLUJO_EFECTIVO', 'Flujo de Efectivo'),
                        ('ESTADO_PATRIMONIO', 'Estado de Cambios en el Patrimonio'),
                        ('MEMORIA_ANUAL', 'Memoria Anual / Informe de Gestión'),
                        ('PRESUPUESTO', 'Presupuesto vs. Ejecución'),
                        ('INFORME_VENTAS', 'Informe de Ventas'),
                        ('CUENTAS_COBRAR_PAGAR', 'Cuentas por Cobrar y Pagar'),
                        ('INFORME_AUDITORIA', 'Informe del Auditor Externo'),
                        ('INFORME_SINDICO', 'Informe del Síndico'),
                        ('DECLARACION_IUE', 'Declaración IUE'),
                        ('DECLARACION_IT', 'Declaración IT'),
                        ('DECLARACION_IVA', 'Declaración IVA'),
                        ('CERTIFICADO_SOLVENCIA', 'Certificado de Solvencia Fiscal'),
                        ('OTRO', 'Otro'),
                    ],
                    max_length=30,
                    verbose_name='tipo de reporte',
                )),
                ('periodo_tipo', models.CharField(
                    choices=[
                        ('MENSUAL', 'Mensual'),
                        ('TRIMESTRAL', 'Trimestral'),
                        ('SEMESTRAL', 'Semestral'),
                        ('ANUAL', 'Anual'),
                    ],
                    max_length=15,
                    verbose_name='tipo de período',
                )),
                ('anio', models.PositiveIntegerField(verbose_name='año')),
                ('mes', models.PositiveSmallIntegerField(blank=True, help_text='1–12. Solo para período mensual.', null=True, verbose_name='mes')),
                ('trimestre', models.PositiveSmallIntegerField(blank=True, help_text='1–4. Solo para período trimestral.', null=True, verbose_name='trimestre')),
                ('semestre', models.PositiveSmallIntegerField(blank=True, help_text='1–2. Solo para período semestral.', null=True, verbose_name='semestre')),
                ('titulo', models.CharField(blank=True, max_length=255, verbose_name='título')),
                ('descripcion', models.TextField(blank=True, verbose_name='descripción')),
                ('archivo', models.FileField(
                    upload_to='finanzas/%Y/%m/',
                    validators=[
                        django.core.validators.FileExtensionValidator(['pdf', 'xlsx', 'xls', 'doc', 'docx', 'csv', 'jpg', 'jpeg', 'png']),
                        finanzas.models.validar_tamanio_archivo,
                    ],
                    verbose_name='archivo',
                )),
                ('sha256', models.CharField(blank=True, editable=False, max_length=64)),
                ('publicado', models.BooleanField(
                    default=True,
                    help_text='Los reportes publicados son visibles para todos los usuarios autenticados.',
                )),
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
                    related_name='reportes_financieros',
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
                'verbose_name': 'reporte financiero',
                'verbose_name_plural': 'reportes financieros',
                'ordering': ['-anio', '-mes', '-trimestre', '-semestre', 'empresa'],
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('todos', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='MensajeConsulta',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mensaje', models.TextField(verbose_name='mensaje')),
                ('respondido', models.BooleanField(default=False, verbose_name='respondido')),
                ('respuesta', models.TextField(blank=True, verbose_name='respuesta')),
                ('fecha_consulta', models.DateTimeField(auto_now_add=True, verbose_name='fecha de consulta')),
                ('fecha_respuesta', models.DateTimeField(blank=True, null=True, verbose_name='fecha de respuesta')),
                ('reporte', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='consultas',
                    to='finanzas.reportefinanciero',
                    verbose_name='reporte',
                )),
                ('respondido_por', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='respuestas_consultas',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='respondido por',
                )),
                ('usuario', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='consultas_financieras',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='usuario',
                )),
            ],
            options={
                'verbose_name': 'consulta',
                'verbose_name_plural': 'consultas',
                'ordering': ['-fecha_consulta'],
            },
        ),
        migrations.CreateModel(
            name='RegistroDescargaReporte',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo_snapshot', models.CharField(max_length=255, verbose_name='título al momento')),
                ('ip', models.GenericIPAddressField(blank=True, null=True, verbose_name='IP')),
                ('user_agent', models.CharField(blank=True, max_length=500, verbose_name='user agent')),
                ('fecha', models.DateTimeField(auto_now_add=True, verbose_name='fecha')),
                ('reporte', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='descargas',
                    to='finanzas.reportefinanciero',
                    verbose_name='reporte',
                )),
                ('usuario', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='descargas_reportes',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='usuario',
                )),
            ],
            options={
                'verbose_name': 'registro de descarga',
                'verbose_name_plural': 'registros de descarga',
                'ordering': ['-fecha'],
                'default_permissions': (),
            },
        ),
    ]
