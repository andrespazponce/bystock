"""Migración 0002: Modelos Tag y PuntoTag para el sistema de etiquetas semánticas.

Crea las tablas `reuniones_tag` y `reuniones_puntotag` con todos los campos
del AuditModel (soft delete, auditoría de usuario) más un UniqueConstraint
parcial en PuntoTag(punto, tag) para registros no eliminados.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reuniones', '0008_add_resumen_to_puntoorden'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Tag ──────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('creado_en', models.DateTimeField(auto_now_add=True, verbose_name='creado en')),
                ('modificado_en', models.DateTimeField(auto_now=True, verbose_name='modificado en')),
                ('eliminado', models.BooleanField(default=False, editable=False)),
                ('eliminado_en', models.DateTimeField(blank=True, editable=False, null=True)),
                ('slug', models.CharField(
                    help_text='Identificador único con formato "categoria:nombre", p. ej. "empresa:td".',
                    max_length=100,
                    unique=True,
                )),
                ('categoria', models.CharField(
                    choices=[
                        ('empresa', 'Empresa'),
                        ('tema', 'Tema'),
                        ('estado', 'Estado / Resultado'),
                        ('intensidad', 'Intensidad'),
                        ('persona', 'Persona / Rol'),
                    ],
                    max_length=20,
                )),
                ('nombre_display', models.CharField(
                    help_text='Nombre legible que se muestra en la UI.',
                    max_length=100,
                    verbose_name='nombre',
                )),
                ('descripcion', models.TextField(
                    blank=True,
                    help_text='Para qué se usa este tag.',
                    verbose_name='descripción',
                )),
                ('color', models.CharField(
                    blank=True,
                    help_text='Color hexadecimal (#rrggbb). Si está vacío se usa el color de la categoría.',
                    max_length=7,
                )),
                ('activo', models.BooleanField(default=True)),
                ('creado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='tag_creados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='creado por',
                )),
                ('modificado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='tag_modificados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='modificado por',
                )),
                ('eliminado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='tag_eliminados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='eliminado por',
                )),
            ],
            options={
                'verbose_name': 'tag',
                'verbose_name_plural': 'tags',
                'ordering': ['categoria', 'nombre_display'],
            },
        ),

        # ── PuntoTag ──────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='PuntoTag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('creado_en', models.DateTimeField(auto_now_add=True, verbose_name='creado en')),
                ('modificado_en', models.DateTimeField(auto_now=True, verbose_name='modificado en')),
                ('eliminado', models.BooleanField(default=False, editable=False)),
                ('eliminado_en', models.DateTimeField(blank=True, editable=False, null=True)),
                ('notas', models.TextField(
                    blank=True,
                    help_text='Contexto adicional de por qué se asignó este tag (opcional).',
                )),
                ('origen', models.CharField(
                    choices=[('IA', 'Generado por IA'), ('MANUAL', 'Asignado manualmente')],
                    default='MANUAL',
                    max_length=10,
                )),
                ('punto', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='punto_tags',
                    to='reuniones.puntoorden',
                )),
                ('tag', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='punto_tags',
                    to='reuniones.tag',
                )),
                ('creado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='puntotag_creados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='creado por',
                )),
                ('modificado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='puntotag_modificados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='modificado por',
                )),
                ('eliminado_por', models.ForeignKey(
                    blank=True, editable=False, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='puntotag_eliminados',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='eliminado por',
                )),
            ],
            options={
                'verbose_name': 'punto-tag',
                'verbose_name_plural': 'punto-tags',
                'ordering': ['punto', 'tag'],
            },
        ),

        # ── Constraint único: un tag por punto (entre no eliminados) ──────────
        migrations.AddConstraint(
            model_name='puntotag',
            constraint=models.UniqueConstraint(
                condition=models.Q(eliminado=False),
                fields=['punto', 'tag'],
                name='unique_tag_por_punto',
            ),
        ),
    ]
