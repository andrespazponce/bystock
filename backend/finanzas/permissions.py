from rest_framework.permissions import BasePermission, SAFE_METHODS


class PuedeSubirReportes(BasePermission):
    """
    - Lectura: cualquier usuario autenticado.
    - Escritura (subir / editar / eliminar): is_staff O en el grupo 'contadores'.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return (
            request.user.is_staff
            or request.user.groups.filter(name='contadores').exists()
        )
