import json
import logging

import anthropic
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import DjangoModelPermissions, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.utils import get_client_ip
from core.api import AuditUserMixin
from .filters import CompromisoFilter, DocumentoFilter, ReunionFilter
from .ia import IA_MODEL_LITE, extraer_acta_completa, extraer_desde_convocatoria, extraer_desde_pdf
from .models import Acta, Asistencia, Compromiso, Documento, PuntoOrden, PuntoTag, RegistroDescarga, Resolucion, Reunion, Tag
from .permissions import PuedeGestionarReuniones

logger = logging.getLogger(__name__)
from .serializers import (
    ActaSerializer,
    ActaWriteSerializer,
    AsistenciaManageSerializer,
    AsistenciaWriteSerializer,
    CompromisoEstadoSerializer,
    CompromisoListSerializer,
    CompromisoManageSerializer,
    CompromisoWriteSerializer,
    DocumentoListSerializer,
    DocumentoWriteSerializer,
    PuntoOrdenManageSerializer,
    PuntoOrdenWriteSerializer,
    PuntoTagCreateSerializer,
    PuntoTagDisplaySerializer,
    ResolucionManageSerializer,
    ResolucionWriteSerializer,
    ReunionDetailSerializer,
    ReunionListSerializer,
    ReunionWriteSerializer,
    TagHistoriaItemSerializer,
    TagSerializer,
)


class ReunionViewSet(AuditUserMixin, ModelViewSet):
    """Reuniones del portal (/api/reuniones/).

    LECTURA (GET lista y detalle): cualquier usuario autenticado. Soporta
    filtros (?organo=&gestion=&estado=&tipo=), búsqueda (?search=), ordenamiento
    (?ordering=fecha) y paginación.

    ESCRITURA (POST crear, PATCH editar la CABECERA, DELETE eliminar): requiere
    el permiso reuniones.add_reunion / change_reunion / delete_reunion (vía
    DjangoModelPermissions), que se otorga por el grupo 'Gestores de reuniones'.
    El DELETE hace soft-delete (AuditModel.delete → eliminado=True): la reunión
    desaparece de todas las listas pero queda en la base de datos. El orden del
    día y las asistencias se gestionan en sus propios endpoints.

    La LISTA usa un serializer liviano; el DETALLE uno completo (con asistentes,
    orden del día, resoluciones, compromisos y acta), precargando relaciones con
    prefetch_related para evitar el problema N+1. La ESCRITURA usa un serializer
    acotado a la cabecera."""

    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ReunionFilter
    search_fields = ['organo__nombre', 'organo__empresa__nombre', 'lugar', 'observaciones']
    ordering_fields = ['gestion', 'numero', 'fecha']
    ordering = ['-gestion', '-numero']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ReunionDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return ReunionWriteSerializer
        return ReunionListSerializer

    @action(
        detail=False,
        methods=['post'],
        url_path='extraer-convocatoria',
        permission_classes=[IsAuthenticated],
    )
    def extraer_convocatoria(self, request):
        """Extrae los datos de una convocatoria o agenda usando IA.

        Cuerpo: multipart/form-data con campo `archivo` (PDF o imagen JPG/PNG/WEBP/GIF).

        Devuelve una propuesta de reunión con sus puntos del orden del día.
        La propuesta NO se guarda automáticamente; el usuario la revisa y confirma
        desde el frontend (POST /api/reuniones/ + POST /api/puntos/).

        Solo exige `IsAuthenticated` (no `add_reunion`) porque no escribe en la BD;
        la confirmación usa los endpoints estándar que sí exigen ese permiso.

        NOTA de rendimiento: puede tardar 20–60 s para imágenes extensas."""
        from gobierno.models import Organo

        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response(
                {'detail': 'Enviá el archivo de la convocatoria (campo "archivo").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nombre = archivo.name.lower()
        if nombre.endswith('.pdf'):
            media_type = 'application/pdf'
        elif nombre.endswith(('.jpg', '.jpeg')):
            media_type = 'image/jpeg'
        elif nombre.endswith('.png'):
            media_type = 'image/png'
        elif nombre.endswith('.webp'):
            media_type = 'image/webp'
        elif nombre.endswith('.gif'):
            media_type = 'image/gif'
        else:
            return Response(
                {'detail': 'Formato no soportado. Usá PDF o imagen (JPG, PNG, WEBP, GIF).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        archivo_bytes = archivo.read()

        # Pasamos los órganos activos para que la IA haga el match
        organos = [
            {
                'id': o['id'],
                'nombre': o['nombre'],
                'tipo': o['tipo'],
                'empresa_nombre': o['empresa__nombre'] or '',
            }
            for o in Organo.objects.filter(activo=True).values(
                'id', 'nombre', 'tipo', 'empresa__nombre',
            )
        ]

        try:
            propuesta = extraer_desde_convocatoria(archivo_bytes, media_type, organos)
        except Exception as exc:
            logger.error('Error en extracción de convocatoria: %s', exc, exc_info=True)
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Validar que organo_id propuesto exista realmente en la BD
        organo_id = propuesta.get('organo_id')
        if organo_id is not None:
            if not Organo.objects.filter(id=organo_id, activo=True).exists():
                propuesta['organo_id'] = None

        return Response(propuesta)

    @action(
        detail=False,
        methods=['post'],
        url_path='extraer-acta-completa',
        permission_classes=[IsAuthenticated],
    )
    def extraer_acta_completa_action(self, request):
        """Extrae TODOS los datos de un acta firmada (PDF o imagen) usando IA.

        Cuerpo: multipart/form-data con campo `archivo` (PDF o imagen).

        Devuelve una propuesta con los metadatos de la reunión Y el contenido
        completo de cada punto (desarrollo, resoluciones, compromisos).
        La propuesta NO se guarda; el usuario la revisa y confirma con
        POST /api/reuniones/crear-desde-acta/.

        NOTA de rendimiento: puede tardar 30–120 s para actas extensas."""
        from gobierno.models import Organo

        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response(
                {'detail': 'Enviá el archivo del acta (campo "archivo").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nombre = archivo.name.lower()
        if nombre.endswith('.pdf'):
            media_type = 'application/pdf'
        elif nombre.endswith(('.jpg', '.jpeg')):
            media_type = 'image/jpeg'
        elif nombre.endswith('.png'):
            media_type = 'image/png'
        elif nombre.endswith('.webp'):
            media_type = 'image/webp'
        elif nombre.endswith('.gif'):
            media_type = 'image/gif'
        else:
            return Response(
                {'detail': 'Formato no soportado. Usá PDF o imagen (JPG, PNG, WEBP, GIF).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        archivo_bytes = archivo.read()

        organos = [
            {
                'id': o['id'],
                'nombre': o['nombre'],
                'tipo': o['tipo'],
                'empresa_nombre': o['empresa__nombre'] or '',
            }
            for o in Organo.objects.filter(activo=True).values(
                'id', 'nombre', 'tipo', 'empresa__nombre',
            )
        ]

        try:
            propuesta = extraer_acta_completa(archivo_bytes, media_type, organos)
        except Exception as exc:
            logger.error('Error en extracción de acta completa: %s', exc, exc_info=True)
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        organo_id = propuesta.get('organo_id')
        if organo_id is not None:
            if not Organo.objects.filter(id=organo_id, activo=True).exists():
                propuesta['organo_id'] = None

        return Response(propuesta)

    @action(
        detail=False,
        methods=['post'],
        url_path='crear-desde-acta',
        permission_classes=[PuedeGestionarReuniones],
    )
    def crear_desde_acta(self, request):
        """Crea una reunión completa desde la propuesta confirmada por el usuario.

        Cuerpo JSON:
        {
          "organo": int,
          "numero": int | null,   ← null = autoasignar max+1
          "gestion": int,
          "fecha": "YYYY-MM-DD",
          "hora_inicio": "HH:MM" | null,
          "hora_fin": "HH:MM" | null,
          "lugar": str,
          "tipo": "ORDINARIA" | "EXTRAORDINARIA",
          "modalidad": "PRESENCIAL" | "VIRTUAL" | "MIXTA",
          "puntos": [
            {
              "titulo": str,
              "desarrollo": str,
              "resoluciones": [{"texto": str, "resultado": str, "por_unanimidad": bool}],
              "compromisos": [
                {"descripcion": str, "responsable": int | null,
                 "fecha_limite": "YYYY-MM-DD" | null, "para_proxima_reunion": bool}
              ]
            }
          ]
        }

        Si viene un campo "archivo" (multipart), se adjunta el PDF como
        Documento(tipo=ACTA_FIRMADA) asociado al acta creada.

        Crea en una sola transacción:
          Reunion → Acta → PuntoOrden[] → Resolucion[] → Compromiso[]
        y opcionalmente: Documento(tipo=ACTA_FIRMADA).

        Devuelve ReunionDetailSerializer de la reunión creada (HTTP 201).
        """
        from gobierno.models import Organo
        from accounts.models import Persona

        data = request.data

        # ── Validaciones básicas ─────────────────────────────────────────────
        try:
            organo = Organo.objects.get(id=data.get('organo'), activo=True)
        except Organo.DoesNotExist:
            return Response({'detail': 'Órgano no encontrado o inactivo.'}, status=status.HTTP_400_BAD_REQUEST)

        fecha = data.get('fecha')
        gestion = data.get('gestion')
        if not fecha:
            return Response({'detail': 'El campo "fecha" es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if not gestion:
            return Response({'detail': 'El campo "gestion" es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        puntos_data = data.get('puntos', [])
        if not isinstance(puntos_data, list):
            return Response({'detail': '"puntos" debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)

        # ── Autoasignar número si no viene ───────────────────────────────────
        numero = data.get('numero')
        if numero is None:
            ultimo = (
                Reunion.objects
                .filter(organo=organo, gestion=gestion)
                .order_by('-numero')
                .values_list('numero', flat=True)
                .first()
            )
            numero = (ultimo or 0) + 1

        # ── Crear todo en una transacción atómica ────────────────────────────
        try:
            with transaction.atomic():

                # 1. Reunion
                reunion = Reunion.objects.create(
                    organo=organo,
                    numero=numero,
                    gestion=int(gestion),
                    fecha=fecha,
                    fecha_fin=data.get('fecha_fin') or None,
                    hora_inicio=data.get('hora_inicio') or None,
                    hora_fin=data.get('hora_fin') or None,
                    lugar=data.get('lugar', ''),
                    tipo=data.get('tipo', 'ORDINARIA'),
                    modalidad=data.get('modalidad', 'PRESENCIAL'),
                    estado='REALIZADA',
                )

                # 2. Acta (borrador)
                acta = Acta.objects.create(reunion=reunion, estado='BORRADOR', contenido='')

                # 3. Puntos, resoluciones y compromisos
                for i, p in enumerate(puntos_data, start=1):
                    titulo = (p.get('titulo') or '').strip()
                    if not titulo:
                        continue
                    punto = PuntoOrden.objects.create(
                        reunion=reunion,
                        orden=i,
                        titulo=titulo,
                        desarrollo=p.get('desarrollo', ''),
                        resumen=p.get('resumen', ''),
                        estado='TRATADO',
                    )
                    for r in (p.get('resoluciones') or []):
                        texto = (r.get('texto') or '').strip()
                        if not texto:
                            continue
                        Resolucion.objects.create(
                            punto=punto,
                            texto=texto,
                            resultado=r.get('resultado', 'APROBADA'),
                            por_unanimidad=bool(r.get('por_unanimidad', True)),
                        )
                    for c in (p.get('compromisos') or []):
                        desc = (c.get('descripcion') or '').strip()
                        resp_id = c.get('responsable')
                        if not desc or not resp_id:
                            continue  # compromiso sin responsable asignado → omitir
                        try:
                            responsable = Persona.objects.get(id=resp_id)
                        except Persona.DoesNotExist:
                            continue
                        Compromiso.objects.create(
                            punto=punto,
                            descripcion=desc,
                            responsable=responsable,
                            fecha_limite=c.get('fecha_limite') or None,
                            para_proxima_reunion=bool(c.get('para_proxima_reunion', False)),
                        )

                # 4. Adjuntar el PDF como Documento si viene en el request
                archivo = request.FILES.get('archivo')
                if archivo:
                    doc = Documento.objects.create(
                        titulo=archivo.name,
                        tipo='ACTA_FIRMADA',
                        archivo=archivo,
                        acta=acta,
                    )
                    try:
                        RegistroDescarga.objects.create(
                            documento=doc,
                            titulo=doc.titulo,
                            accion='SUBIDA',
                            usuario=request.user,
                            ip=get_client_ip(request),
                            user_agent=request.META.get('HTTP_USER_AGENT', ''),
                        )
                    except Exception:
                        pass  # el log nunca debe interrumpir la operación

        except Exception as exc:
            logger.error('Error al crear reunión desde acta: %s', exc, exc_info=True)
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Re-fetch con prefetch para devolver el detalle completo
        reunion = (
            Reunion.objects
            .select_related('organo', 'organo__empresa')
            .prefetch_related(
                'asistencias__persona',
                'puntos__empresa',
                'puntos__resoluciones',
                'puntos__compromisos__responsable',
                'puntos__documentos',
                'puntos__punto_tags__tag',
                'acta__redactada_por',
                'acta__firmada_por',
                'acta__documentos',
            )
            .get(pk=reunion.pk)
        )
        serializer = ReunionDetailSerializer(reunion, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['post'],
        url_path='generar-tags',
        permission_classes=[PuedeGestionarReuniones],
    )
    def generar_tags(self, request, pk=None):
        """Genera tags semánticos para todos los puntos de la reunión usando IA.

        Llama a Haiku con el catálogo de tags y el contenido de cada punto;
        crea los PuntoTag correspondientes (origen=IA). Solo añade tags nuevos,
        nunca quita los existentes.

        Devuelve: {"message": str, "creados": int}
        """
        reunion = self.get_object()
        try:
            from .ia import generar_tags_reunion
            resultado = generar_tags_reunion(reunion)
            return Response(resultado)
        except Exception as exc:
            logger.error(
                'Error en generación de tags IA (reunion_id=%s): %s',
                reunion.pk, exc, exc_info=True,
            )
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_queryset(self):
        qs = Reunion.objects.select_related('organo', 'organo__empresa')
        if self.action == 'retrieve':
            qs = qs.prefetch_related(
                'asistencias__persona',
                'puntos__empresa',
                'puntos__resoluciones',
                'puntos__compromisos__responsable',
                'puntos__documentos',
                'puntos__punto_tags__tag',
                'acta__redactada_por',
                'acta__firmada_por',
                'acta__documentos',
            )
        return qs


class PuntoOrdenViewSet(AuditUserMixin, ModelViewSet):
    """Orden del día de una reunión (/api/puntos/).

    LECTURA (GET): cualquier autenticado. Se filtra por reunión con
    ?reunion=<id>. Incluye `notas_crudas` (insumo de redacción), por eso es un
    endpoint aparte del detalle público de la reunión.

    ESCRITURA (POST crear, PATCH editar, DELETE quitar): requiere
    `reuniones.change_reunion` (permiso PuedeGestionarReuniones). El DELETE es
    borrado lógico (AuditModel). Para REORDENAR hay una acción dedicada
    (POST /api/puntos/reordenar/) que reescribe el campo `orden` de todos los
    puntos de la reunión de una sola vez."""

    queryset = PuntoOrden.objects.select_related('empresa', 'reunion').order_by('reunion', 'orden')
    permission_classes = [PuedeGestionarReuniones]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['reunion']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PuntoOrdenWriteSerializer
        return PuntoOrdenManageSerializer

    @action(detail=False, methods=['post'])
    def reordenar(self, request):
        """Reasigna el `orden` (1..N) de TODOS los puntos de una reunión según
        la lista de ids recibida. Cuerpo: {"reunion": <id>, "orden": [id, ...]}.

        Debe incluir EXACTAMENTE todos los puntos vivos de la reunión (ni más ni
        menos), para no dejar el orden del día inconsistente.

        Se hace en dos fases dentro de una transacción para no chocar con la
        restricción de unicidad (reunion, orden): primero se desplazan todos los
        valores con un offset grande, luego se asignan los definitivos 1..N.
        Usa UPDATE directo (no toca la auditoría: reordenar no es 'editar')."""
        reunion_id = request.data.get('reunion')
        orden_ids = request.data.get('orden')

        if reunion_id is None or not isinstance(orden_ids, list) or not orden_ids:
            return Response(
                {'detail': 'Enviá "reunion" y una lista no vacía "orden" con los ids de los puntos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ids actuales (vivos) de la reunión.
        actuales = set(
            PuntoOrden.objects.filter(reunion_id=reunion_id).values_list('id', flat=True)
        )
        try:
            recibidos = [int(x) for x in orden_ids]
        except (TypeError, ValueError):
            return Response(
                {'detail': 'La lista "orden" debe contener solo ids numéricos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if set(recibidos) != actuales:
            return Response(
                {'detail': 'La lista debe incluir exactamente todos los puntos de la reunión.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        OFFSET = 1_000_000
        with transaction.atomic():
            # Fase 1: corremos todos fuera del rango final para liberar 1..N.
            PuntoOrden.objects.filter(reunion_id=reunion_id).update(orden=F('orden') + OFFSET)
            # Fase 2: asignamos el orden definitivo según la posición en la lista.
            for posicion, pid in enumerate(recibidos, start=1):
                PuntoOrden.objects.filter(pk=pid).update(orden=posicion)

        puntos = (
            PuntoOrden.objects.select_related('empresa')
            .filter(reunion_id=reunion_id)
            .order_by('orden')
        )
        serializer = PuntoOrdenManageSerializer(puntos, many=True, context={'request': request})
        return Response(serializer.data)

    # ── Acciones de tags ────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='tags')
    def tags(self, request, pk=None):
        """Devuelve o agrega tags de un punto del orden del día.

        GET  → lista de PuntoTagDisplaySerializer (incluye tag anidado).
        POST → {"tag_slug": str, "notas": str (opcional)}
               Crea el PuntoTag si no existe; si ya existe (no eliminado) devuelve 200.
               Origen: MANUAL.
        """
        punto = self.get_object()

        if request.method == 'GET':
            punto_tags = (
                PuntoTag.objects.filter(punto=punto)
                .select_related('tag')
                .order_by('tag__categoria', 'tag__nombre_display')
            )
            serializer = PuntoTagDisplaySerializer(punto_tags, many=True)
            return Response(serializer.data)

        # POST
        ser = PuntoTagCreateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        tag_slug = ser.validated_data['tag_slug']
        notas = ser.validated_data.get('notas', '')

        try:
            tag = Tag.objects.get(slug=tag_slug, activo=True)
        except Tag.DoesNotExist:
            return Response(
                {'detail': f'No existe un tag activo con slug "{tag_slug}".'},
                status=status.HTTP_404_NOT_FOUND,
            )

        pt, created = PuntoTag.objects.get_or_create(
            punto=punto,
            tag=tag,
            defaults={'notas': notas, 'origen': PuntoTag.Origen.MANUAL},
        )
        resp_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        serializer = PuntoTagDisplaySerializer(pt)
        return Response(serializer.data, status=resp_status)

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'tags/(?P<ptag_id>[0-9]+)',
    )
    def quitar_tag(self, request, pk=None, ptag_id=None):
        """Quita (soft-delete) un PuntoTag del punto.

        DELETE /api/puntos/<punto_id>/tags/<ptag_id>/

        Devuelve 204 si se eliminó; 404 si no existe o no pertenece al punto.
        """
        punto = self.get_object()
        pt = get_object_or_404(PuntoTag, pk=ptag_id, punto=punto)
        pt.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AsistenciaViewSet(AuditUserMixin, ModelViewSet):
    """Asistencias de una reunión (/api/asistencias/).

    LECTURA (GET): cualquier autenticado. Se filtra por reunión con
    ?reunion=<id>.

    ESCRITURA (POST crear, PATCH editar, DELETE quitar): requiere
    `reuniones.change_reunion` (permiso PuedeGestionarReuniones). El DELETE es
    borrado lógico (AuditModel). Tratamos las asistencias como PARTES de la
    reunión, igual que el orden del día."""

    queryset = Asistencia.objects.select_related('persona', 'reunion').order_by('persona')
    permission_classes = [PuedeGestionarReuniones]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['reunion']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AsistenciaWriteSerializer
        return AsistenciaManageSerializer


class ResolucionViewSet(AuditUserMixin, ModelViewSet):
    """Resoluciones de un punto del orden del día (/api/resoluciones/).

    LECTURA (GET): cualquier autenticado. Se filtra por punto con ?punto=<id>.

    ESCRITURA (POST crear, PATCH editar, DELETE quitar): requiere
    `reuniones.change_reunion` (permiso PuedeGestionarReuniones). El DELETE es
    borrado lógico (AuditModel). Una resolución cuelga de un punto, que es parte
    de la reunión: por eso reusamos el mismo permiso que el orden del día."""

    queryset = Resolucion.objects.select_related('punto').order_by('punto', 'id')
    permission_classes = [PuedeGestionarReuniones]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['punto']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ResolucionWriteSerializer
        return ResolucionManageSerializer


class CompromisoGestionViewSet(AuditUserMixin, ModelViewSet):
    """Gestión completa de compromisos DENTRO de la reunión (/api/compromisos-gestion/).

    LECTURA (GET): cualquier autenticado. Se filtra por punto con ?punto=<id>.

    ESCRITURA (POST crear, PATCH editar, DELETE quitar): requiere
    `reuniones.change_reunion` (permiso PuedeGestionarReuniones). El DELETE es
    borrado lógico (AuditModel).

    OJO: este endpoint es DISTINTO de /api/compromisos/ (el tablero). El tablero
    solo cambia el `estado` y exige `change_compromiso`; aquí se crea/edita/borra
    el compromiso completo como parte de la reunión (`change_reunion`)."""

    queryset = Compromiso.objects.select_related(
        'responsable', 'punto', 'resolucion',
    ).order_by('punto', 'id')
    permission_classes = [PuedeGestionarReuniones]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['punto']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CompromisoWriteSerializer
        return CompromisoManageSerializer


class ActaViewSet(AuditUserMixin, ModelViewSet):
    """Acta de una reunión (/api/actas/).

    LECTURA (GET): cualquier autenticado. Se filtra por reunión con ?reunion=<id>.

    ESCRITURA (POST crear, PATCH editar): requiere `reuniones.change_reunion`
    (permiso PuedeGestionarReuniones). El acta es una PARTE de la reunión
    (OneToOne), por eso reusamos el mismo permiso.

    NO se permite borrar el acta desde el portal (igual que las reuniones, que
    solo se eliminan desde el admin). Motivo técnico además: el OneToOne genera
    un índice único INCONDICIONAL sobre `reunion`; con el soft delete, un acta
    borrada lógicamente seguiría ocupando ese slot y un nuevo POST chocaría con
    la BD. Evitar el DELETE elimina ese caso de raíz.

    `redactada_por` y `firmada_por` se mandan como ids de Persona; la respuesta
    los devuelve anidados (vía ActaSerializer)."""

    queryset = (
        Acta.objects.select_related('reunion', 'redactada_por')
        .prefetch_related('firmada_por', 'documentos')
        .order_by('reunion')
    )
    permission_classes = [PuedeGestionarReuniones]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['reunion']

    def perform_destroy(self, instance):
        """Hard delete para Acta.

        AuditModel.delete() hace soft-delete, pero Acta tiene un OneToOneField
        con unique constraint INCONDICIONAL sobre `reunion`. Si solo marcamos
        eliminado=True, el slot sigue ocupado y un futuro POST crearía un acta
        duplicada violando la constraintería de la BD.

        Solución: usar QuerySet.delete() que va directo a SQL y borra la fila.
        Los Documentos hijos se borran en cascada por la FK de la BD.
        """
        type(instance).todos.filter(pk=instance.pk).delete()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ActaWriteSerializer
        return ActaSerializer

    @action(detail=True, methods=['post'], url_path='extraer')
    def extraer(self, request, pk=None):
        """Extrae el contenido del acta desde un PDF usando IA.

        Cuerpo: {"documento": <id_del_documento_pdf>}

        El documento debe pertenecer a este acta y ser un PDF. Devuelve
        una propuesta de desarrollo por punto con resoluciones y compromisos
        sugeridos. La propuesta NO se guarda automáticamente; el usuario la
        revisa y aplica desde el frontend.

        Requiere: `reuniones.change_reunion` (mismo permiso que el acta).

        NOTA de rendimiento: la llamada a la API de Anthropic puede tardar
        30–120 s para PDFs extensos. En producción, migrar a tarea Celery."""
        acta = self.get_object()

        documento_id = request.data.get('documento')
        if not documento_id:
            return Response(
                {'detail': 'Enviá el id del documento PDF a extraer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            documento = Documento.objects.get(pk=documento_id, acta=acta)
        except Documento.DoesNotExist:
            return Response(
                {'detail': 'El documento no existe o no pertenece a este acta.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not documento.archivo or not documento.archivo.name.lower().endswith('.pdf'):
            return Response(
                {'detail': 'El documento debe ser un PDF (.pdf).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        puntos = acta.reunion.puntos.all().order_by('orden')
        if not puntos.exists():
            return Response(
                {'detail': 'La reunión no tiene puntos en el orden del día.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            propuesta = extraer_desde_pdf(acta, documento, puntos)
        except Exception as exc:
            logger.error(
                'Error en extracción IA (acta_id=%s): %s',
                acta.pk, exc, exc_info=True,
            )
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({'puntos': propuesta})


class CompromisoViewSet(AuditUserMixin, ModelViewSet):
    """Tablero de compromisos / pendientes.

    LECTURA (GET /api/compromisos/): cualquier usuario autenticado.
    ESCRITURA (PATCH /api/compromisos/<id>/): SOLO cambiar el `estado`
    (Cumplido/Cancelado/Pendiente). Requiere el permiso `reuniones.change_compromiso`
    (vía DjangoModelPermissions) — se otorga por GRUPO (ver migración del grupo
    "Gestores de compromisos"). No se permite crear ni borrar desde aquí
    (http_method_names limita a GET/PATCH).

    Filtros: ?estado=&responsable=&para_proxima_reunion=&vencido=&search=.
    Ordena por fecha límite ascendente. select_related anti N+1."""

    queryset = Compromiso.objects.select_related(
        'responsable', 'punto', 'punto__reunion', 'punto__reunion__organo',
    )
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    http_method_names = ['get', 'patch', 'head', 'options']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CompromisoFilter
    search_fields = ['descripcion', 'punto__titulo', 'responsable__nombres', 'responsable__apellidos']
    ordering_fields = ['fecha_limite', 'estado']
    ordering = ['fecha_limite']

    def get_serializer_class(self):
        if self.action == 'partial_update':
            return CompromisoEstadoSerializer
        return CompromisoListSerializer


class DocumentoViewSet(AuditUserMixin, ModelViewSet):
    """Repositorio central de documentos (/api/documentos/).

    LECTURA (GET): cualquier autenticado. Filtros: ?tipo=&empresa=&acta=&punto=.
    Búsqueda por texto en título y descripción: ?search=. Ordena por fecha
    descendente (lo más reciente arriba). select_related trae empresa y la
    reunión de origen (vía acta o punto) sin N+1.

    ESCRITURA (POST subir, DELETE quitar): requiere `reuniones.change_reunion`
    (permiso PuedeGestionarReuniones); los documentos respaldan actas/puntos, que
    son partes de la reunión. La subida es multipart (campo `archivo`); el hash
    SHA-256 lo calcula el modelo al guardar. El DELETE es borrado lógico
    (AuditModel) — el archivo queda en disco pero el registro se oculta. NO se
    permite PATCH (reemplazar un archivo subido es raro; se sube uno nuevo).

    OJO: el detalle/“ver” de un documento es la DESCARGA segura, no el retrieve
    de este endpoint (ver DescargarDocumentoView)."""

    permission_classes = [PuedeGestionarReuniones]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']
    queryset = Documento.objects.select_related(
        'empresa', 'acta__reunion__organo', 'punto__reunion__organo',
    )
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = DocumentoFilter
    search_fields = ['titulo', 'descripcion']
    ordering_fields = ['fecha', 'titulo']
    ordering = ['-fecha']

    def get_serializer_class(self):
        if self.action == 'create':
            return DocumentoWriteSerializer
        return DocumentoListSerializer

    # ── Trazabilidad ────────────────────────────────────────────────────────

    def _registrar(self, request, documento, accion):
        """Inserta un RegistroDescarga sin propagar excepciones.

        El log nunca debe interrumpir la operación principal: si la BD tiene
        un problema transitorio, el usuario igualmente recibe su archivo."""
        try:
            RegistroDescarga.objects.create(
                documento=documento,
                titulo=documento.titulo,
                accion=accion,
                usuario=request.user if request.user.is_authenticated else None,
                ip=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
        except Exception:
            pass  # silencioso — el log no debe cortar la operación

    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._registrar(self.request, serializer.instance, RegistroDescarga.SUBIDA)

    def perform_destroy(self, instance):
        # Registramos ANTES del borrado para tener la FK viva en el momento
        # de la inserción (después quedaría NULL por el SET_NULL).
        self._registrar(self.request, instance, RegistroDescarga.ELIMINACION)
        super().perform_destroy(instance)


class DescargarDocumentoView(APIView):
    """Entrega segura de un documento (GET /api/documentos/<pk>/descargar/).

    NO se sirve la carpeta `media/` por URL pública (sería adivinable). Este es
    el ÚNICO camino para obtener el archivo y exige estar autenticado.

    Acepta DOS formas de autenticación:
    - JWT (Bearer): el portal/SPA descarga vía fetch con el token.
    - Sesión de Django: el link "Ver / descargar" del admin (donde el usuario
      ya tiene cookie de sesión).

    El archivo se ubica por la clave primaria del registro (no por una ruta que
    venga del usuario), así que no hay riesgo de path traversal. Como usamos el
    manager por defecto (`objects`), los documentos con soft delete devuelven
    404 automáticamente.

    Nota: cuando se definan los roles del portal, aquí irá el control de permisos
    fino (p. ej. limitar por empresa o rol). En producción conviene delegar la
    transmisión al servidor web (X-Accel-Redirect en nginx / Traefik).
    """

    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        documento = get_object_or_404(Documento, pk=pk)
        if not documento.archivo:
            raise Http404('El documento no tiene archivo asociado.')

        # Registrar la descarga. try/except para que un fallo del log nunca
        # impida la entrega del archivo al usuario autenticado.
        try:
            RegistroDescarga.objects.create(
                documento=documento,
                titulo=documento.titulo,
                accion=RegistroDescarga.DESCARGA,
                usuario=request.user if request.user.is_authenticated else None,
                ip=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
        except Exception:
            pass

        nombre = documento.archivo.name.rsplit('/', 1)[-1]
        # as_attachment=False permite previsualizar PDF/imágenes en el navegador.
        return FileResponse(documento.archivo.open('rb'), as_attachment=False, filename=nombre)


class AsistenteView(APIView):
    """Asistente IA de la Memoria Corporativa (POST /api/asistente/).

    Acepta una pregunta en lenguaje natural y devuelve una respuesta citando
    los puntos del orden del día que la sustentan.

    Body:
        pregunta  (str)  — la consulta del usuario.
        historial (list) — últimos mensajes [{rol: "user"|"asistente", texto: "..."}]
                           para mantener el hilo de la conversación.

    Response:
        {
          "respuesta":   "Texto explicativo en español...",
          "referencias": [
            {"reunion_id": 5, "punto_id": 23, "etiqueta": "Nº 02/2026",
             "titulo_punto": "Título del punto"}
          ]
        }

    Usa Haiku (IA_MODEL_LITE) con el contexto completo de resúmenes de puntos
    (~75–125 K tokens). Solo usuarios autenticados. Solo lectura: no escribe en BD.
    """

    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    # Prompt del sistema: le pedimos JSON directamente para poder parsear las refs.
    _SYSTEM = (
        'Eres el Asistente de Memoria Corporativa de INCERPAZ / GIPRO Bolivia. '
        'Respondes preguntas de directores y socios sobre el historial de reuniones del Directorio. '
        'Usa un lenguaje claro, sin jerga técnica. '
        'Basate SOLO en el contexto provisto; si no encuentras la información, dilo con honestidad.\n\n'
        'Responde ÚNICAMENTE con JSON válido y sin texto adicional, con exactamente este formato:\n'
        '{\n'
        '  "respuesta": "Tu respuesta clara aquí…",\n'
        '  "referencias": [\n'
        '    {"reunion_id": 5, "punto_id": 23, "etiqueta": "Nº 02/2026", '
        '"titulo_punto": "Título del punto"}\n'
        '  ]\n'
        '}\n'
        'En "referencias" incluí SOLO los puntos que usaste para responder. '
        'Si no hay información relevante, devolvé "referencias" como lista vacía [].'
    )

    def post(self, request):
        pregunta = (request.data.get('pregunta') or '').strip()
        if not pregunta:
            return Response({'error': 'El campo "pregunta" es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        if not settings.ANTHROPIC_API_KEY:
            return Response(
                {'error': 'El asistente IA no está configurado en este servidor.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ── Construir contexto desde la BD ──────────────────────────────────────
        puntos = (
            PuntoOrden.objects
            .select_related('reunion', 'reunion__organo', 'reunion__organo__empresa')
            .prefetch_related(
                'resoluciones',
                'compromisos',
                'compromisos__responsable',
            )
            .order_by('reunion__gestion', 'reunion__numero', 'orden')
        )

        items = []
        for p in puntos:
            r = p.reunion
            # Preferir resumen (breve) generado por IA; si no hay, truncar desarrollo.
            contenido = p.resumen or ''
            if not contenido and p.desarrollo:
                contenido = p.desarrollo[:500] + ('…' if len(p.desarrollo) > 500 else '')
            if not contenido.strip():
                continue  # Punto vacío — no aporta contexto

            resoluciones = [
                {'texto': rv.texto[:300], 'resultado': rv.resultado}
                for rv in p.resoluciones.all()
            ]
            compromisos_pendientes = [
                {
                    'descripcion': c.descripcion[:200],
                    'responsable': str(c.responsable) if c.responsable else None,
                    'estado': c.estado,
                }
                for c in p.compromisos.filter(estado__in=['PENDIENTE', 'EN_PROCESO'])
            ]
            items.append({
                'punto_id':   p.id,
                'reunion_id': r.id,
                'etiqueta':   f'Nº {r.numero:02d}/{r.gestion}',
                'organo':     r.organo.nombre,
                'empresa':    r.organo.empresa.codigo,
                'fecha':      str(r.fecha),
                'titulo':     p.titulo,
                'contenido':  contenido,
                **(({'resoluciones': resoluciones}) if resoluciones else {}),
                **(({'compromisos_pendientes': compromisos_pendientes}) if compromisos_pendientes else {}),
            })

        contexto_json = json.dumps(items, ensure_ascii=False, separators=(',', ':'))

        # ── Armar mensajes (historial + pregunta actual) ────────────────────────
        historial_raw = request.data.get('historial') or []
        mensajes = []
        for h in historial_raw[-8:]:   # Máximo 4 pares de intercambio
            rol = 'user' if h.get('rol') == 'user' else 'assistant'
            texto = (h.get('texto') or '').strip()
            if texto:
                mensajes.append({'role': rol, 'content': texto})

        mensajes.append({
            'role': 'user',
            'content': (
                f'CONTEXTO DE REUNIONES (JSON):\n{contexto_json}\n\n'
                f'PREGUNTA: {pregunta}'
            ),
        })

        # ── Llamar a Claude Haiku ───────────────────────────────────────────────
        raw = ''
        try:
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            msg = client.messages.create(
                model=IA_MODEL_LITE,
                max_tokens=1500,
                system=self._SYSTEM,
                messages=mensajes,
            )
            raw = msg.content[0].text.strip()

            # Limpiar bloque markdown si Claude lo envuelve con ```json … ```
            if raw.startswith('```'):
                raw = raw.split('```', 2)[1]
                if raw.startswith('json'):
                    raw = raw[4:]
                raw = raw.strip()

            parsed = json.loads(raw)
            return Response({
                'respuesta':   parsed.get('respuesta', ''),
                'referencias': parsed.get('referencias', []),
            })

        except json.JSONDecodeError as exc:
            logger.warning(
                'AsistenteView: JSON inválido de Claude (%s). raw=%.300s', exc, raw
            )
            # Devolver el texto tal cual si no pudimos parsear (degradación elegante).
            return Response({'respuesta': raw, 'referencias': []})

        except anthropic.RateLimitError:
            return Response(
                {'error': 'El asistente está recibiendo muchas consultas. Intentá en un momento.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        except Exception as exc:
            logger.error('AsistenteView: error inesperado: %s', exc, exc_info=True)
            return Response(
                {'error': 'Error al consultar la IA. Intentá de nuevo.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class TagViewSet(ReadOnlyModelViewSet):
    """Catálogo de tags semánticos (GET /api/tags/).

    Solo lectura pública (cualquier autenticado). La creación/edición de tags se
    hace desde el admin de Django. Soporta búsqueda libre (?search=) por nombre,
    categoría y descripción.

    Rutas habilitadas:
      GET  /api/tags/                     → lista paginada de tags activos
      GET  /api/tags/<slug>/              → detalle de un tag
      GET  /api/tags/<slug>/historia/     → historial de todos los puntos que lo llevan
    """

    queryset = Tag.objects.filter(activo=True).order_by('categoria', 'nombre_display')
    serializer_class = TagSerializer
    lookup_field = 'slug'
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['nombre_display', 'categoria', 'descripcion']

    @action(detail=True, methods=['get'], url_path='historia')
    def historia(self, request, slug=None):
        """Devuelve el historial de apariciones de este tag en el orden cronológico.

        Respuesta:
        {
          "tag": TagSerializer,
          "total": int,
          "historia": [TagHistoriaItemSerializer, ...]   ← ordenado desc por gestion/numero/orden
        }
        """
        tag = self.get_object()
        punto_tags = (
            PuntoTag.objects.filter(tag=tag)
            .select_related(
                'punto',
                'punto__reunion',
                'punto__reunion__organo',
            )
            .order_by(
                '-punto__reunion__gestion',
                '-punto__reunion__numero',
                'punto__orden',
            )
        )
        historia_data = [
            {
                'id': pt.id,
                'notas': pt.notas,
                'origen': pt.origen,
                'creado_en': pt.creado_en,
                'punto_id': pt.punto.id,
                'punto_titulo': pt.punto.titulo,
                'punto_orden': pt.punto.orden,
                'reunion_id': pt.punto.reunion.id,
                'reunion_fecha': pt.punto.reunion.fecha,
                'reunion_numero': pt.punto.reunion.numero,
                'reunion_gestion': pt.punto.reunion.gestion,
                'organo_nombre': pt.punto.reunion.organo.nombre,
            }
            for pt in punto_tags
        ]
        return Response({
            'tag': TagSerializer(tag).data,
            'total': len(historia_data),
            'historia': TagHistoriaItemSerializer(historia_data, many=True).data,
        })
