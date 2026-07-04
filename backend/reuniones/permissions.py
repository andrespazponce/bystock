from rest_framework.permissions import SAFE_METHODS, BasePermission


class PuedeGestionarReuniones(BasePermission):
    """Permiso para las PARTES de una reunión (orden del día, asistencias).

    - LECTURA (GET/HEAD/OPTIONS): cualquier usuario autenticado.
    - ESCRITURA (POST/PATCH/DELETE): requiere `reuniones.change_reunion`, que se
      otorga por el grupo 'Gestores de reuniones' (o a superusuarios).

    Tratamos los puntos y asistencias como partes de la reunión: quien puede
    gestionar reuniones puede gestionar su contenido. Así no hace falta sembrar
    permisos separados por cada submodelo."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.has_perm('reuniones.change_reunion')
