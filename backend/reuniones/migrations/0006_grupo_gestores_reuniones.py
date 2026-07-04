"""Crea el grupo 'Gestores de reuniones' con los permisos para crear y editar
reuniones desde el portal (reuniones.add_reunion y reuniones.change_reunion).

Es una migración de DATOS: no toca el esquema, solo siembra un grupo de
permisos. Asignar usuarios a este grupo (desde el admin) es lo que habilita los
botones 'Nueva reunión' y 'Editar' del portal. Los superusuarios pasan todos
los permisos sin necesidad del grupo.

No se incluye delete_reunion a propósito: el portal no permite borrar reuniones
(eso queda en el admin, con cuidado). Mismo patrón idempotente que el grupo
'Gestores de compromisos' (0004)."""
from django.db import migrations

GRUPO = 'Gestores de reuniones'
PERMISOS = [
    ('add_reunion', 'Can add reunión'),
    ('change_reunion', 'Can change reunión'),
]


def crear_grupo(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    ct, _ = ContentType.objects.get_or_create(
        app_label='reuniones', model='reunion',
    )
    grupo, _ = Group.objects.get_or_create(name=GRUPO)
    for codename, name in PERMISOS:
        permiso, _ = Permission.objects.get_or_create(
            codename=codename,
            content_type=ct,
            defaults={'name': name},
        )
        grupo.permissions.add(permiso)


def borrar_grupo(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name=GRUPO).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('reuniones', '0005_alter_compromiso_estado'),
        ('auth', '0012_alter_user_first_name_max_length'),
        ('contenttypes', '0002_remove_content_type_name'),
    ]

    operations = [
        migrations.RunPython(crear_grupo, borrar_grupo),
    ]
