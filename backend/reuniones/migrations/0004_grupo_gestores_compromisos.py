"""Crea el grupo 'Gestores de compromisos' con el permiso para cambiar el
estado de un compromiso (reuniones.change_compromiso).

Es una migración de DATOS: no toca el esquema, solo siembra un grupo de
permisos. Asignar usuarios a este grupo (desde el admin) es lo que habilita
los botones Cumplido/Cancelar/Reabrir en el tablero del portal. Los
superusuarios pasan todos los permisos sin necesidad del grupo.

Usamos get_or_create para que sea idempotente y robusta tanto en una base
existente como en una instalación desde cero (no dependemos del orden de
post_migrate para que el permiso ya exista: lo aseguramos aquí)."""
from django.db import migrations

GRUPO = 'Gestores de compromisos'
PERMISO_CODENAME = 'change_compromiso'


def crear_grupo(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    # Aseguramos el ContentType y el permiso del modelo Compromiso. En una base
    # ya migrada existen; en una recién creada puede que aún no, así que los
    # creamos defensivamente para no fallar.
    ct, _ = ContentType.objects.get_or_create(
        app_label='reuniones', model='compromiso',
    )
    permiso, _ = Permission.objects.get_or_create(
        codename=PERMISO_CODENAME,
        content_type=ct,
        defaults={'name': 'Can change compromiso'},
    )

    grupo, _ = Group.objects.get_or_create(name=GRUPO)
    grupo.permissions.add(permiso)


def borrar_grupo(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name=GRUPO).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('reuniones', '0003_documento'),
        ('auth', '0012_alter_user_first_name_max_length'),
        ('contenttypes', '0002_remove_content_type_name'),
    ]

    operations = [
        migrations.RunPython(crear_grupo, borrar_grupo),
    ]
