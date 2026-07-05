#!/usr/bin/env python
"""
Script para inicializar la base de datos con estructura y datos de prueba.
Ejecutar desde la carpeta backend:
    python init_db.py
"""

import os
import sys
import django
from datetime import date, datetime, timedelta
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.core.management import call_command
from accounts.models import CustomUser, Socio
from core.models import Empresa, Organo, Persona
from activos.models import Activo, ActivoDocumento
from finanzas.models import ReporteFinanciero, Cuenta, RegistroMovimiento
from reuniones.models import Reunion, PuntoOrden, Grupo, Tag
from django.contrib.auth.models import Group


def crear_grupos():
    """Crea grupos de permisos."""
    print("▸ Creando grupos...")
    Group.objects.get_or_create(name='contadores')
    Group.objects.get_or_create(name='gestores')
    print("✓ Grupos creados")


def crear_usuarios():
    """Crea usuarios admin y de prueba."""
    print("▸ Creando usuarios...")

    # Admin
    admin, created = CustomUser.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@bystock.local',
            'nombre_completo': 'Administrador',
            'is_staff': True,
            'is_superuser': True,
        }
    )
    if created:
        admin.set_password('admin123')
        admin.save()

    # Usuario de prueba
    user, created = CustomUser.objects.get_or_create(
        username='usuario',
        defaults={
            'email': 'usuario@bystock.local',
            'nombre_completo': 'Usuario Prueba',
            'is_staff': False,
        }
    )
    if created:
        user.set_password('usuario123')
        user.save()

    print("✓ Usuarios creados (admin/admin123, usuario/usuario123)")


def crear_empresas():
    """Crea empresas del grupo."""
    print("▸ Creando empresas...")

    empresas_data = [
        {'nombre': 'Bystock Principal', 'alias': 'Bystock', 'tipo': 'HOLDING'},
        {'nombre': 'Bystock Inmuebles', 'alias': 'Inmuebles', 'tipo': 'OPERATIVA'},
        {'nombre': 'Bystock Servicios', 'alias': 'Servicios', 'tipo': 'OPERATIVA'},
    ]

    for data in empresas_data:
        Empresa.objects.get_or_create(
            nombre=data['nombre'],
            defaults={'alias': data['alias'], 'tipo': data['tipo']}
        )

    print("✓ Empresas creadas")


def crear_personas():
    """Crea personas de contacto."""
    print("▸ Creando personas...")

    personas_data = [
        {'nombre': 'Juan Pérez', 'rol': 'Gerente General', 'email': 'juan@bystock.local'},
        {'nombre': 'María García', 'rol': 'Contadora', 'email': 'maria@bystock.local'},
        {'nombre': 'Carlos López', 'rol': 'Directivo', 'email': 'carlos@bystock.local'},
    ]

    for data in personas_data:
        Persona.objects.get_or_create(
            nombre=data['nombre'],
            defaults={'rol': data['rol'], 'email': data['email']}
        )

    print("✓ Personas creadas")


def crear_organos():
    """Crea órganos de gobierno."""
    print("▸ Creando órganos...")

    organos_data = [
        {'nombre': 'Directorio', 'tipo': 'DIRECTORIO', 'descripcion': 'Máximo órgano de decisión'},
        {'nombre': 'Junta de Accionistas', 'tipo': 'ASAMBLEA', 'descripcion': 'Asamblea de accionistas'},
        {'nombre': 'Comité de Auditoría', 'tipo': 'COMITE', 'descripcion': 'Auditoría interna'},
    ]

    for data in organos_data:
        Organo.objects.get_or_create(
            nombre=data['nombre'],
            defaults={
                'tipo': data['tipo'],
                'descripcion': data['descripcion'],
                'activo': True,
            }
        )

    print("✓ Órganos creados")


def crear_activos():
    """Crea activos de prueba."""
    print("▸ Creando activos...")

    empresa = Empresa.objects.first()
    if not empresa:
        return

    activos_data = [
        {
            'nombre': 'Oficina Central',
            'tipo': 'OFICINA',
            'estado': 'ACTIVO',
            'departamento': 'La Paz',
            'ciudad': 'La Paz',
            'direccion': 'Calle Principal 123',
            'valor': '500000.00',
        },
        {
            'nombre': 'Toyota Hilux',
            'tipo': 'CAMION',
            'estado': 'ACTIVO',
            'placa': 'LPZ-123',
            'marca': 'Toyota',
            'modelo_descripcion': 'Hilux 2022',
            'anio': 2022,
            'color': 'Blanco',
            'valor': '45000.00',
        },
        {
            'nombre': 'Casa en Sopocachi',
            'tipo': 'CASA',
            'estado': 'ACTIVO',
            'departamento': 'La Paz',
            'ciudad': 'La Paz',
            'direccion': 'Avenida Arce 456',
            'area_m2': '280.50',
            'valor': '750000.00',
        },
    ]

    for data in activos_data:
        Activo.objects.get_or_create(
            nombre=data['nombre'],
            empresa=empresa,
            tipo=data['tipo'],
            defaults=data
        )

    print("✓ Activos creados")


def crear_reuniones():
    """Crea reuniones de prueba."""
    print("▸ Creando reuniones...")

    organo = Organo.objects.first()
    empresa = Empresa.objects.first()
    if not organo or not empresa:
        return

    ahora = datetime.now()
    reunion, created = Reunion.objects.get_or_create(
        titulo='Sesión Regular - Julio 2026',
        organo=organo,
        empresa=empresa,
        defaults={
            'fecha': ahora.date(),
            'hora_inicio': ahora.time(),
            'lugar': 'Sala de Juntas',
            'estado': 'PROGRAMADA',
            'tipo_reunion': 'ORDINARIA',
        }
    )

    if created:
        # Crear puntos de orden
        PuntoOrden.objects.get_or_create(
            reunion=reunion,
            numero=1,
            defaults={
                'titulo': 'Aprobación de actas anteriores',
                'duracion_estimada': 10,
            }
        )
        PuntoOrden.objects.get_or_create(
            reunion=reunion,
            numero=2,
            defaults={
                'titulo': 'Informe financiero',
                'duracion_estimada': 30,
            }
        )

    print("✓ Reuniones creadas")


def main():
    """Ejecuta el proceso completo de inicialización."""
    print("\n" + "="*60)
    print("Inicializando base de datos para Bystock")
    print("="*60 + "\n")

    # Ejecutar migraciones
    print("▸ Ejecutando migraciones...")
    call_command('migrate', verbosity=0)
    print("✓ Migraciones completadas\n")

    # Crear datos
    crear_grupos()
    crear_usuarios()
    crear_empresas()
    crear_personas()
    crear_organos()
    crear_activos()
    crear_reuniones()

    print("\n" + "="*60)
    print("✓ Base de datos inicializada correctamente")
    print("="*60)
    print("\nCredenciales de prueba:")
    print("  • Admin: admin / admin123")
    print("  • Usuario: usuario / usuario123")
    print("\nPara ejecutar el servidor:")
    print("  python manage.py runserver\n")


if __name__ == '__main__':
    main()
