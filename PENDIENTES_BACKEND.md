# Pendientes de Backend — Para el desarrollador

> Estos cambios son **solo de backend/Django**. No requieren tocar el frontend,
> que ya está preparado para recibirlos.

---

## 1. Exponer `resoluciones_count` en el endpoint de lista de reuniones

**Endpoint afectado:** `GET /api/reuniones/` (lista paginada)

**Problema:** El serializer de lista (`ReunionListSerializer` o equivalente) no incluye
el conteo de resoluciones de la reunión. El frontend quiere mostrar ese número en
las tarjetas del menú de reuniones, pero no puede sin hacer una petición por cada
reunión (ineficiente).

**Solución:** Agregar una anotación en el queryset del ViewSet y un campo en el serializer:

```python
# En ReunionViewSet.get_queryset()
from django.db.models import Count

queryset = Reunion.objects.annotate(
    resoluciones_count=Count('puntos__resoluciones', distinct=True)
)

# En ReunionListSerializer (o el que se use para la lista)
resoluciones_count = serializers.IntegerField(read_only=True)
```

**Impacto:** Bajo. Solo lectura, sin cambios de modelo. Requiere migración: NO.

---

## 2. Exponer el campo `resumen` en `PuntoOrdenSerializer`

**Endpoint afectado:** `GET /api/reuniones/{id}/` → campo `puntos[].resumen`

**Problema:** La IA genera un campo `resumen` (síntesis de 3–5 oraciones) cuando
se extrae el acta desde PDF, pero el `PuntoOrdenSerializer` que se usa en el detalle
de la reunión no incluye ese campo. El frontend ya tiene la UI lista para mostrarlo
(aparece en un box dorado antes de la transcripción completa).

**Verificar primero:** Si el modelo `PuntoOrden` (o `Punto`) ya tiene el campo
`resumen` en la base de datos. Revisar `reuniones/models.py`.

**Caso A — El modelo ya tiene el campo:**
Simplemente agregar al serializer:
```python
class PuntoOrdenSerializer(serializers.ModelSerializer):
    class Meta:
        fields = [..., 'resumen']  # agregar 'resumen' a la lista
```

**Caso B — El modelo NO tiene el campo:**
```python
# En reuniones/models.py, en el modelo Punto o PuntoOrden:
resumen = models.TextField(blank=True, default='')

# Luego: python manage.py makemigrations && python manage.py migrate
```
Y también exponer en el serializer y en el endpoint de creación (`crear-desde-acta`)
para que cuando se crea el punto se guarde el resumen.

**Impacto:** Bajo-medio. Si requiere migración es Caso B; si solo es serializer es Caso A.

---

## Notas generales

- El frontend ya tiene `resumen?: string` como campo opcional en la interfaz
  `PuntoOrden` (TypeScript). Cuando el backend lo devuelva, aparece automáticamente.
- El frontend ya tiene `resoluciones_count` pendiente de agregar a la interfaz
  `Reunion` una vez que el backend lo devuelva.
- Ninguno de estos cambios rompe lo que ya funciona — son campos nuevos opcionales.
