"""Módulo de IA: extracción de contenido de actas desde PDF.

Usa dos modelos según la complejidad de la tarea:

  IA_MODEL_LITE  (Haiku)  — extracción de convocatorias y relleno de puntos
                            individuales. Salida pequeña/moderada, muy barato.

  IA_MODEL_FULL  (Sonnet) — extracción completa de actas (verbatim + resumen
                            por punto). La salida puede superar 8 192 tokens
                            (límite duro de Haiku), por lo que se necesita
                            Sonnet que soporta hasta 64 000 tokens de salida.

Ninguno de los dos usa extended thinking (se omite el parámetro `thinking`).
La propuesta NO se aplica automáticamente; el usuario la revisa y confirma
desde el frontend.

Prompt caching: el PDF se envía con cache_control="ephemeral" para que
Anthropic lo cachee y el segundo análisis del mismo documento sea más
rápido y más barato.

NOTA de producción: este módulo hace llamadas HTTP síncronas que pueden
tardar 30–120 s. En producción reemplazar con tareas Celery + WebSocket.
"""
import base64
import json
import logging
import re
import time

import anthropic
from django.conf import settings

try:
    from json_repair import repair_json as _repair_json
    _HAS_JSON_REPAIR = True
except ImportError:
    _HAS_JSON_REPAIR = False


def _parse_json_robust(texto: str, contexto: str = '') -> dict:
    """Intenta parsear JSON; si falla usa json_repair como fallback.

    Contexto se incluye en los logs para facilitar el diagnóstico.
    """
    try:
        return json.loads(texto)
    except json.JSONDecodeError as exc_original:
        if _HAS_JSON_REPAIR:
            try:
                reparado = _repair_json(texto, return_objects=True)
                if isinstance(reparado, (dict, list)):
                    logger.warning(
                        'JSON reparado automáticamente %s (error original: %s)',
                        contexto, exc_original,
                    )
                    return reparado
            except Exception as exc_repair:
                logger.error(
                    'json_repair también falló %s: %s', contexto, exc_repair,
                )
        # Si no hay librería o la reparación falló, relanzamos el error original
        raise ValueError(f'La IA devolvió JSON inválido: {exc_original}') from exc_original

logger = logging.getLogger(__name__)


def _llamar_con_retry(client, model, max_tokens, system, messages, max_reintentos=2, espera_base=65):
    """Llama a client.messages.stream con reintentos automáticos en caso de RateLimitError (429).

    La ventana de rate limit de Anthropic es de 60 segundos (tokens/minuto).
    Esperamos `espera_base` segundos (por defecto 65) para asegurarnos de que
    el contador se resetee antes de reintentar.

    No consume créditos extra — es la misma llamada, no un modelo diferente.

    Parámetros
    ----------
    max_reintentos  : cuántas veces reintentar tras el primer 429 (default 2)
    espera_base     : segundos a esperar en el primer reintento; duplica en cada intento
    """
    ultimo_error = None
    for intento in range(max_reintentos + 1):
        try:
            with client.messages.stream(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            ) as stream:
                return stream.get_final_message()
        except anthropic.RateLimitError as exc:
            ultimo_error = exc
            if intento < max_reintentos:
                espera = espera_base * (2 ** intento)  # 65 s → 130 s → …
                logger.warning(
                    'Rate limit alcanzado (429) en intento %d/%d. '
                    'Esperando %d s antes de reintentar…',
                    intento + 1, max_reintentos + 1, espera,
                )
                time.sleep(espera)
            else:
                logger.error('Rate limit persistente tras %d reintentos.', max_reintentos + 1)
                raise
    raise ultimo_error  # nunca debería llegar aquí, pero cierra el flujo


# ── Modelos de IA por tarea ──────────────────────────────────────────────────
# Haiku: convocatorias y relleno de puntos individuales (salida ≤ 8 192 tok).
IA_MODEL_LITE = 'claude-haiku-4-5-20251001'
IA_MAX_TOKENS_LITE = 8192

# Sonnet: extracción completa de actas con verbatim + resumen por punto.
# Una acta de varias páginas puede generar >8 192 tokens de salida JSON,
# lo que truncaría la respuesta en Haiku y produciría JSON inválido.
IA_MODEL_FULL = 'claude-sonnet-4-6'
IA_MAX_TOKENS_FULL = 32000


def extraer_desde_pdf(acta, documento, puntos):
    """Lee el PDF `documento` y devuelve una propuesta de contenido por punto.

    Parámetros
    ----------
    acta      : instancia de reuniones.Acta
    documento : instancia de reuniones.Documento (debe ser un PDF)
    puntos    : queryset / lista de reuniones.PuntoOrden ordenados por `orden`

    Retorna
    -------
    list[dict]  — una entrada por punto:
    [
      {
        "punto_id": int,
        "orden": int,
        "titulo": str,
        "desarrollo": str,
        "resoluciones": [
          {"texto": str, "resultado": "APROBADA"|"RECHAZADA"|"POSPUESTA",
           "por_unanimidad": bool}
        ],
        "compromisos": [
          {"descripcion": str, "responsable_nombre": str,
           "fecha_limite": str|null, "para_proxima_reunion": bool}
        ]
      }
    ]

    Lanza cualquier excepción ante error; el llamador (la view) la captura.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError(
            'ANTHROPIC_API_KEY no está configurada. '
            'Agregala a tu .env: ANTHROPIC_API_KEY=sk-ant-...'
        )

    puntos_list = list(puntos)  # materializar el queryset una sola vez

    # ── 1. Leer y codificar el PDF en base64 ────────────────────────────────
    with documento.archivo.open('rb') as f:
        pdf_bytes = f.read()
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode('utf-8')

    # ── 2. Construir los prompts ─────────────────────────────────────────────
    reunion = acta.reunion
    ref_puntos = '\n'.join(
        f'  - id={p.id}, orden={p.orden}, título="{p.titulo}"'
        for p in puntos_list
    )

    system_prompt = (
        'Sos un asistente especializado en gobierno corporativo. '
        'Leés actas de reuniones y extraés su contenido en JSON estructurado. '
        'Respondés ÚNICAMENTE con JSON válido y bien formado, '
        'sin bloques de código markdown, sin texto introductorio ni explicaciones.'
    )

    user_prompt = (
        f'El PDF adjunto es el acta de la reunión "{reunion}" '
        f'({reunion.organo.nombre}, gestión {reunion.gestion}).\n\n'
        f'La reunión tuvo los siguientes puntos del orden del día:\n{ref_puntos}\n\n'
        'Para CADA punto, extraé del PDF:\n'
        '1. **desarrollo**: texto narrativo de lo que se trató y discutió (2–5 párrafos)\n'
        '2. **resoluciones**: decisiones formales adoptadas (lista vacía [] si no hay)\n'
        '3. **compromisos**: tareas o encargos asumidos (lista vacía [] si no hay)\n\n'
        'Devolvé EXACTAMENTE este JSON (sin envolver en bloques ```json```):\n'
        '{\n'
        '  "puntos": [\n'
        '    {\n'
        '      "punto_id": <id entero del punto>,\n'
        '      "orden": <número de orden>,\n'
        '      "titulo": "<título>",\n'
        '      "desarrollo": "<texto narrativo en prosa>",\n'
        '      "resoluciones": [\n'
        '        {\n'
        '          "texto": "<texto de la resolución>",\n'
        '          "resultado": "APROBADA",\n'
        '          "por_unanimidad": true\n'
        '        }\n'
        '      ],\n'
        '      "compromisos": [\n'
        '        {\n'
        '          "descripcion": "<descripción>",\n'
        '          "responsable_nombre": "<nombre completo>",\n'
        '          "fecha_limite": null,\n'
        '          "para_proxima_reunion": false\n'
        '        }\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        'Valores válidos para `resultado`: APROBADA, RECHAZADA, POSPUESTA.\n'
        'Usá los `punto_id` exactos de la lista de referencia.\n'
        'Si un punto no aparece claramente en el PDF, incluilo igual '
        'con `desarrollo` vacío y listas vacías.'
    )

    # ── 3. Llamar a la API de Anthropic ─────────────────────────────────────
    # Haiku no soporta thinking, se omite ese parámetro.
    # _llamar_con_retry maneja RateLimitError (429) con backoff de 65 s.
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    message = _llamar_con_retry(
        client=client,
        model=IA_MODEL_LITE,
        max_tokens=IA_MAX_TOKENS_LITE,
        system=system_prompt,
        messages=[
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'document',
                        'source': {
                            'type': 'base64',
                            'media_type': 'application/pdf',
                            'data': pdf_b64,
                        },
                        # Prompt caching: reutiliza la lectura del PDF si
                        # se vuelve a procesar el mismo documento.
                        'cache_control': {'type': 'ephemeral'},
                    },
                    {
                        'type': 'text',
                        'text': user_prompt,
                    },
                ],
            }
        ],
    )

    # ── 4. Extraer el bloque de texto ────────────────────────────────────────
    texto = next(
        (block.text for block in message.content if block.type == 'text'),
        '',
    )

    if not texto.strip():
        raise ValueError('La IA no devolvió contenido de texto en la respuesta.')

    # ── 5. Limpiar markdown si Claude los envolvió igual ────────────────────
    texto = re.sub(r'^```(?:json)?\s*', '', texto.strip())
    texto = re.sub(r'\s*```$', '', texto)

    # ── 6. Parsear y validar el JSON ─────────────────────────────────────────
    try:
        datos = _parse_json_robust(texto, contexto=f'(acta_id={acta.pk})')
    except ValueError as exc:
        logger.error(
            'JSON inválido en respuesta de IA (acta_id=%s):\nTexto (500 chars): %.500s',
            acta.pk, texto,
        )
        raise

    puntos_propuesta = datos.get('puntos', [])
    if not isinstance(puntos_propuesta, list):
        raise ValueError(
            f'La respuesta de la IA no tiene el formato esperado '
            f'(se esperaba lista en "puntos", se obtuvo {type(puntos_propuesta).__name__}).'
        )

    logger.info(
        'Extracción IA completada (acta_id=%s): %d puntos procesados, '
        'tokens entrada=%s salida=%s',
        acta.pk,
        len(puntos_propuesta),
        getattr(message.usage, 'input_tokens', '?'),
        getattr(message.usage, 'output_tokens', '?'),
    )

    return puntos_propuesta


# ── Tipos de archivo soportados para convocatorias ──────────────────────────
MEDIA_TYPES_SOPORTADOS = frozenset({
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
})


def extraer_desde_convocatoria(archivo_bytes, media_type, organos_disponibles):
    """Lee una convocatoria o agenda (PDF o imagen) y extrae los datos de la reunión.

    Parámetros
    ----------
    archivo_bytes      : bytes del archivo (PDF o imagen)
    media_type         : str, p.ej. 'application/pdf', 'image/jpeg'
    organos_disponibles: list de dicts [{id, nombre, tipo, empresa_nombre}]
                         para que la IA pueda hacer el match del órgano.

    Retorna
    -------
    dict:
    {
      "organo_id"               : int | null  — id del órgano más probable
      "organo_nombre_detectado" : str         — nombre tal como aparece en el doc
      "numero"                  : int | null  — correlativo si se menciona
      "gestion"                 : int | null  — año de la gestión
      "fecha"                   : str | null  — "YYYY-MM-DD"
      "hora_inicio"             : str | null  — "HH:MM" 24 h
      "hora_fin"                : str | null  — "HH:MM" 24 h
      "lugar"                   : str
      "tipo"                    : "ORDINARIA" | "EXTRAORDINARIA"
      "modalidad"               : "PRESENCIAL" | "VIRTUAL" | "MIXTA"
      "puntos"                  : [{"orden": int, "titulo": str}]
    }

    Lanza ValueError si el tipo de archivo no está soportado, si falta la API key,
    o si la IA devuelve JSON inválido.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError(
            'ANTHROPIC_API_KEY no está configurada. '
            'Agregala a tu .env: ANTHROPIC_API_KEY=sk-ant-...'
        )

    if media_type not in MEDIA_TYPES_SOPORTADOS:
        raise ValueError(
            f'Tipo de archivo no soportado: {media_type}. '
            'Usá PDF, JPG, PNG, WEBP o GIF.'
        )

    # ── 1. Codificar el archivo en base64 ────────────────────────────────────
    b64_data = base64.standard_b64encode(archivo_bytes).decode('utf-8')

    # ── 2. Construir el bloque de contenido según el tipo ────────────────────
    if media_type.startswith('image/'):
        content_block = {
            'type': 'image',
            'source': {
                'type': 'base64',
                'media_type': media_type,
                'data': b64_data,
            },
            'cache_control': {'type': 'ephemeral'},
        }
    else:  # PDF
        content_block = {
            'type': 'document',
            'source': {
                'type': 'base64',
                'media_type': media_type,
                'data': b64_data,
            },
            'cache_control': {'type': 'ephemeral'},
        }

    # ── 3. Construir los prompts ─────────────────────────────────────────────
    ref_organos = '\n'.join(
        f'  - id={o["id"]}, nombre="{o["nombre"]}", '
        f'tipo={o["tipo"]}, empresa="{o["empresa_nombre"]}"'
        for o in organos_disponibles
    ) or '  (ningún órgano registrado aún)'

    system_prompt = (
        'Sos un asistente especializado en gobierno corporativo boliviano. '
        'Analizás convocatorias y agendas de reuniones y extraés sus datos '
        'en JSON estructurado. '
        'Respondés ÚNICAMENTE con JSON válido y bien formado, '
        'sin bloques de código markdown, sin texto introductorio ni explicaciones.'
    )

    user_prompt = (
        'El documento adjunto es una convocatoria o agenda de reunión.\n\n'
        f'Órganos registrados en el sistema (usá el id más apropiado o null):\n'
        f'{ref_organos}\n\n'
        'Extraé los siguientes datos:\n'
        '1. **organo_id**: id del órgano que mejor coincide con el documento (null si no hay coincidencia clara)\n'
        '2. **organo_nombre_detectado**: nombre del órgano tal como aparece en el documento\n'
        '3. **numero**: número correlativo de la reunión si se menciona explícitamente (null si no aparece)\n'
        '4. **gestion**: año de la gestión si aparece o puede inferirse del contexto (null si no)\n'
        '5. **fecha**: fecha de la reunión en formato YYYY-MM-DD (null si no se puede determinar)\n'
        '6. **hora_inicio**: hora de inicio en formato HH:MM 24 h — convertí "9:00 am" a "09:00" (null si no aparece)\n'
        '7. **hora_fin**: hora de fin en formato HH:MM 24 h (null si no aparece)\n'
        '8. **lugar**: lugar o dirección de la reunión (cadena vacía si no se menciona)\n'
        '9. **tipo**: "ORDINARIA" o "EXTRAORDINARIA" según el documento (por defecto "ORDINARIA")\n'
        '10. **modalidad**: "PRESENCIAL", "VIRTUAL" o "MIXTA" (por defecto "PRESENCIAL")\n'
        '11. **puntos**: lista COMPLETA y ORDENADA de los puntos del orden del día; '
        'incluí el título limpio SIN el número de orden al inicio\n\n'
        'Devolvé EXACTAMENTE este JSON:\n'
        '{\n'
        '  "organo_id": <id entero o null>,\n'
        '  "organo_nombre_detectado": "<nombre>",\n'
        '  "numero": <número entero o null>,\n'
        '  "gestion": <año entero o null>,\n'
        '  "fecha": "<YYYY-MM-DD>" o null,\n'
        '  "hora_inicio": "<HH:MM>" o null,\n'
        '  "hora_fin": "<HH:MM>" o null,\n'
        '  "lugar": "<lugar o cadena vacía>",\n'
        '  "tipo": "ORDINARIA",\n'
        '  "modalidad": "PRESENCIAL",\n'
        '  "puntos": [\n'
        '    {"orden": 1, "titulo": "<título sin número de orden>"}\n'
        '  ]\n'
        '}'
    )

    # ── 4. Llamar a la API de Anthropic ─────────────────────────────────────
    # Haiku no soporta thinking, se omite ese parámetro.
    # _llamar_con_retry maneja RateLimitError (429) con backoff de 65 s.
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    message = _llamar_con_retry(
        client=client,
        model=IA_MODEL_LITE,
        max_tokens=IA_MAX_TOKENS_LITE,
        system=system_prompt,
        messages=[
            {
                'role': 'user',
                'content': [
                    content_block,
                    {'type': 'text', 'text': user_prompt},
                ],
            }
        ],
    )

    # ── 5. Extraer el bloque de texto ────────────────────────────────────────
    texto = next(
        (block.text for block in message.content if block.type == 'text'),
        '',
    )

    if not texto.strip():
        raise ValueError('La IA no devolvió contenido de texto.')

    # ── 6. Limpiar y parsear el JSON ─────────────────────────────────────────
    texto = re.sub(r'^```(?:json)?\s*', '', texto.strip())
    texto = re.sub(r'\s*```$', '', texto)

    try:
        datos = _parse_json_robust(texto, contexto='(convocatoria)')
    except ValueError as exc:
        logger.error(
            'JSON inválido en extracción de convocatoria:\nTexto (500 chars): %.500s', texto,
        )
        raise

    # Garantizar que 'puntos' sea siempre una lista
    if not isinstance(datos.get('puntos'), list):
        datos['puntos'] = []

    logger.info(
        'Extracción convocatoria completada: órgano="%s" (id=%s), %d punto(s), '
        'tokens entrada=%s salida=%s',
        datos.get('organo_nombre_detectado', '?'),
        datos.get('organo_id'),
        len(datos['puntos']),
        getattr(message.usage, 'input_tokens', '?'),
        getattr(message.usage, 'output_tokens', '?'),
    )

    return datos


def extraer_acta_completa(archivo_bytes, media_type, organos_disponibles):
    """Lee el PDF (o imagen) de un ACTA firmada y extrae TODO en un solo llamado.

    A diferencia de `extraer_desde_convocatoria` (solo agenda) y
    `extraer_desde_pdf` (solo contenido dado un acta existente), esta función
    extrae en un único pase:
      - Metadatos de la reunión (órgano, número, gestión, fecha, hora, lugar…)
      - Por cada punto: título, desarrollo, resoluciones y compromisos

    Se usa para el flujo "Acta-first": se sube el PDF ya firmado, la IA extrae
    la propuesta completa, el usuario la revisa y el backend la persiste en una
    transacción (POST /api/reuniones/crear-desde-acta/).

    Parámetros
    ----------
    archivo_bytes      : bytes del archivo (PDF o imagen)
    media_type         : str, p.ej. 'application/pdf', 'image/jpeg'
    organos_disponibles: list de dicts [{id, nombre, tipo, empresa_nombre}]

    Retorna
    -------
    dict:
    {
      "organo_id"               : int | null
      "organo_nombre_detectado" : str
      "numero"                  : int | null
      "gestion"                 : int | null
      "fecha"                   : "YYYY-MM-DD" | null
      "hora_inicio"             : "HH:MM" | null
      "hora_fin"                : "HH:MM" | null
      "lugar"                   : str
      "tipo"                    : "ORDINARIA" | "EXTRAORDINARIA"
      "modalidad"               : "PRESENCIAL" | "VIRTUAL" | "MIXTA"
      "puntos": [
        {
          "orden"                 : int,
          "titulo"                : str,
          "desarrollo"            : str,   ← texto verbatim del acta, solo corrección ortográfica
          "resumen"               : str,   ← síntesis concisa de los aspectos clave
          "resoluciones"          : [{"texto": str, "resultado": str, "por_unanimidad": bool}],
          "compromisos"           : [{"descripcion": str, "responsable_nombre": str,
                                      "fecha_limite": str | null, "para_proxima_reunion": bool}],
          "documentos_detectados" : [{"descripcion": str, "tipo_sugerido": str}]
        }
      ]
    }
    """
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError(
            'ANTHROPIC_API_KEY no está configurada. '
            'Agregala a tu .env: ANTHROPIC_API_KEY=sk-ant-...'
        )

    if media_type not in MEDIA_TYPES_SOPORTADOS:
        raise ValueError(
            f'Tipo de archivo no soportado: {media_type}. '
            'Usá PDF o imagen (JPG, PNG, WEBP, GIF).'
        )

    # ── 1. Codificar el archivo en base64 ────────────────────────────────────
    b64_data = base64.standard_b64encode(archivo_bytes).decode('utf-8')

    # ── 2. Bloque de contenido (document para PDF, image para imágenes) ──────
    if media_type.startswith('image/'):
        content_block = {
            'type': 'image',
            'source': {'type': 'base64', 'media_type': media_type, 'data': b64_data},
            'cache_control': {'type': 'ephemeral'},
        }
    else:
        content_block = {
            'type': 'document',
            'source': {'type': 'base64', 'media_type': media_type, 'data': b64_data},
            'cache_control': {'type': 'ephemeral'},
        }

    # ── 3. Construir los prompts ─────────────────────────────────────────────
    ref_organos = '\n'.join(
        f'  - id={o["id"]}, nombre="{o["nombre"]}", '
        f'tipo={o["tipo"]}, empresa="{o["empresa_nombre"]}"'
        for o in organos_disponibles
    ) or '  (ningún órgano registrado aún)'

    system_prompt = (
        'Sos un asistente especializado en gobierno corporativo boliviano. '
        'Analizás actas de reuniones y extraés su contenido completo en JSON estructurado. '
        'Respondés ÚNICAMENTE con JSON válido y bien formado, '
        'sin bloques de código markdown, sin texto introductorio ni explicaciones.'
    )

    user_prompt = (
        'El documento adjunto es el ACTA de una reunión de gobierno corporativo. '
        'Extraé TODA la información en un único JSON.\n\n'
        f'Órganos registrados (usá el id más apropiado o null):\n{ref_organos}\n\n'
        'PARTE 1 — Metadatos de la reunión:\n'
        '1. organo_id: id del órgano que mejor coincide (null si no hay coincidencia)\n'
        '2. organo_nombre_detectado: nombre del órgano tal como aparece en el documento\n'
        '3. numero: número correlativo (ej. 4 para "Nº 04/2026") — null si no aparece\n'
        '4. gestion: año de la gestión — null si no se puede determinar\n'
        '5. fecha: fecha de la reunión en YYYY-MM-DD — null si no aparece\n'
        '6. hora_inicio: hora de inicio HH:MM 24 h — null si no aparece\n'
        '7. hora_fin: hora de fin HH:MM 24 h — null si no aparece\n'
        '8. lugar: lugar donde se realizó (cadena vacía si no se menciona)\n'
        '9. tipo: "ORDINARIA" o "EXTRAORDINARIA" (por defecto "ORDINARIA")\n'
        '10. modalidad: "PRESENCIAL", "VIRTUAL" o "MIXTA" (por defecto "PRESENCIAL")\n\n'
        'PARTE 2 — Contenido punto a punto:\n'
        'Para CADA punto del orden del día del acta extraé los siguientes campos:\n\n'
        '- titulo: título limpio del punto SIN el número de orden al inicio\n'
        '- desarrollo: copiá el texto del acta para este punto TAL CUAL aparece en el '
        'documento, corrigiendo ÚNICAMENTE errores tipográficos, ortográficos y de '
        'puntuación evidentes. NO resumir, NO interpretar, NO agregar ni quitar '
        'información. El texto debe ser el mismo del documento original, solo limpiado.\n'
        '- resumen: redactá un resumen conciso de 3 a 5 oraciones destacando los aspectos '
        'más importantes: decisiones tomadas, acuerdos alcanzados, puntos críticos discutidos. '
        'No incluyas detalles menores ni repetir todo el desarrollo.\n'
        '- resoluciones: decisiones formales adoptadas (lista vacía [] si no hay)\n'
        '- compromisos: tareas o encargos asumidos (lista vacía [] si no hay)\n'
        '- documentos_detectados: si el acta menciona que se presentó, adjuntó o debe '
        'adjuntarse algún documento (informe, contrato, estado financiero, etc.), '
        'incluilo en esta lista. Usá lista vacía [] si no se mencionan documentos. '
        'Para tipo_sugerido usá uno de: INFORME, CONTRATO, TESTIMONIO, ESTADO_FINANCIERO, '
        'ACTA_FIRMADA, OTRO.\n\n'
        'Devolvé EXACTAMENTE este JSON (sin envolver en bloques ```json```):\n'
        '{\n'
        '  "organo_id": <id entero o null>,\n'
        '  "organo_nombre_detectado": "<nombre>",\n'
        '  "numero": <entero o null>,\n'
        '  "gestion": <año entero o null>,\n'
        '  "fecha": "<YYYY-MM-DD>" o null,\n'
        '  "hora_inicio": "<HH:MM>" o null,\n'
        '  "hora_fin": "<HH:MM>" o null,\n'
        '  "lugar": "<lugar o cadena vacía>",\n'
        '  "tipo": "ORDINARIA",\n'
        '  "modalidad": "PRESENCIAL",\n'
        '  "puntos": [\n'
        '    {\n'
        '      "orden": 1,\n'
        '      "titulo": "<título sin número de orden>",\n'
        '      "desarrollo": "<texto verbatim del acta, solo corrección ortográfica>",\n'
        '      "resumen": "<síntesis concisa de 3–5 oraciones con los aspectos clave>",\n'
        '      "resoluciones": [\n'
        '        {"texto": "<texto>", "resultado": "APROBADA", "por_unanimidad": true}\n'
        '      ],\n'
        '      "compromisos": [\n'
        '        {"descripcion": "<tarea>", "responsable_nombre": "<nombre completo>",\n'
        '         "fecha_limite": null, "para_proxima_reunion": false}\n'
        '      ],\n'
        '      "documentos_detectados": [\n'
        '        {"descripcion": "<nombre o descripción del documento>",\n'
        '         "tipo_sugerido": "INFORME"}\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        'Valores válidos para resultado: APROBADA, RECHAZADA, POSPUESTA.\n'
        'Si un punto no tiene resoluciones, compromisos o documentos detectados, '
        'incluí listas vacías [].\n\n'
        'CRÍTICO — ESCAPE DE CARACTERES EN JSON:\n'
        'Dentro de cualquier valor de texto en el JSON, escapá correctamente:\n'
        '  - Comillas dobles → \\" (si el texto dice: el director dijo "esto", escribí: el director dijo \\"esto\\")\n'
        '  - Backslash → \\\\\n'
        '  - Saltos de línea dentro de un campo → \\n (NO saltos de línea literales)\n'
        'El JSON completo debe ser parseable con json.loads() sin ningún error.'
    )

    # ── 4. Llamar a la API de Anthropic ─────────────────────────────────────
    # Usa Sonnet (IA_MODEL_FULL) porque la salida verbatim + resumen por punto
    # puede superar los 8 192 tokens de Haiku, lo que truncaría el JSON.
    # Sonnet soporta hasta 64 000 tokens de salida y es más que suficiente
    # para cualquier acta corporativa estándar.
    # _llamar_con_retry maneja RateLimitError (429) con backoff automático de
    # 65 s (reset del contador tokens/minuto) sin consumir créditos extra.
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    message = _llamar_con_retry(
        client=client,
        model=IA_MODEL_FULL,
        max_tokens=IA_MAX_TOKENS_FULL,
        system=system_prompt,
        messages=[
            {
                'role': 'user',
                'content': [
                    content_block,
                    {'type': 'text', 'text': user_prompt},
                ],
            }
        ],
    )

    # ── 5. Extraer el bloque de texto ────────────────────────────────────────
    texto = next(
        (block.text for block in message.content if block.type == 'text'),
        '',
    )

    if not texto.strip():
        raise ValueError('La IA no devolvió contenido de texto.')

    # ── 6. Limpiar y parsear el JSON ─────────────────────────────────────────
    texto = re.sub(r'^```(?:json)?\s*', '', texto.strip())
    texto = re.sub(r'\s*```$', '', texto)

    try:
        datos = _parse_json_robust(texto, contexto='(acta completa)')
    except ValueError as exc:
        logger.error(
            'JSON inválido en extracción de acta completa:\nTexto (500 chars): %.500s', texto,
        )
        raise

    if not isinstance(datos.get('puntos'), list):
        datos['puntos'] = []

    # Normalizar: garantizar que todos los campos de lista existan como [] si faltan o son null.
    # La IA a veces devuelve null en vez de [] para puntos sin resoluciones/compromisos.
    for pt in datos['puntos']:
        for campo in ('resoluciones', 'compromisos', 'documentos_detectados'):
            if not isinstance(pt.get(campo), list):
                pt[campo] = []

    logger.info(
        'Extracción acta completa: órgano="%s" (id=%s), %d punto(s), '
        'tokens entrada=%s salida=%s',
        datos.get('organo_nombre_detectado', '?'),
        datos.get('organo_id'),
        len(datos['puntos']),
        getattr(message.usage, 'input_tokens', '?'),
        getattr(message.usage, 'output_tokens', '?'),
    )

    return datos


# ── Generación de tags semánticos ────────────────────────────────────────────

def generar_tags_reunion(reunion) -> dict:
    """Genera tags semánticos para todos los puntos de una reunión usando IA.

    Estrategia:
    - Carga el catálogo completo de tags activos desde la BD.
    - Por cada punto con contenido (titulo/desarrollo/resumen) construye un resumen breve.
    - Envía un único prompt a Haiku (IA_MODEL_LITE) para clasificar TODOS los puntos de
      una vez, reduciendo el número de llamadas a la API.
    - Parsea la respuesta JSON, valida los slugs contra el catálogo y crea los
      PuntoTag correspondientes (origen=IA) usando get_or_create.
    - Nunca borra tags existentes; solo añade los nuevos.

    Devuelve: {"message": str, "creados": int}

    Nota de producción: si hay muchos puntos con textos largos, el prompt puede
    superar el contexto de Haiku. En ese caso subir a IA_MODEL_FULL o procesar
    por lotes.
    """
    from .models import PuntoTag, Tag  # import local para evitar circular

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # ── 1. Catálogo de tags activos ──────────────────────────────────────────
    tags_qs = Tag.objects.filter(activo=True).order_by('categoria', 'nombre_display')
    catalogo = list(tags_qs.values('slug', 'categoria', 'nombre_display', 'descripcion'))
    if not catalogo:
        return {'message': 'No hay tags activos en el catálogo.', 'creados': 0}

    # Mapa slug → objeto Tag para creación rápida
    slug_to_tag = {t.slug: t for t in tags_qs}

    catalogo_txt = '\n'.join(
        f'  {t["slug"]} ({t["categoria"]}): {t["nombre_display"]}'
        + (f' — {t["descripcion"]}' if t['descripcion'] else '')
        for t in catalogo
    )

    # ── 2. Puntos de la reunión con contenido ────────────────────────────────
    puntos = list(
        reunion.puntos.order_by('orden').values('id', 'orden', 'titulo', 'resumen', 'desarrollo')
    )
    if not puntos:
        return {'message': 'La reunión no tiene puntos del orden del día.', 'creados': 0}

    puntos_txt_items = []
    for p in puntos:
        contenido = ' '.join(filter(None, [p['titulo'], p['resumen'], (p['desarrollo'] or '')[:300]]))
        puntos_txt_items.append(f'  punto_id={p["id"]} orden={p["orden"]}: {contenido}')
    puntos_txt = '\n'.join(puntos_txt_items)

    # ── 3. Prompt ────────────────────────────────────────────────────────────
    prompt = (
        'Eres un asistente de clasificación semántica para actas de reuniones corporativas.\n\n'
        'CATÁLOGO DE TAGS DISPONIBLES (slug: descripción):\n'
        f'{catalogo_txt}\n\n'
        'PUNTOS DE LA REUNIÓN:\n'
        f'{puntos_txt}\n\n'
        'TAREA: Para cada punto, asigná entre 1 y 5 slugs del catálogo que mejor lo describan.\n'
        'Solo usá slugs del catálogo; no inventes nuevos.\n\n'
        'Respondé ÚNICAMENTE con un objeto JSON (sin markdown, sin explicaciones) con este formato:\n'
        '{\n'
        '  "<punto_id>": ["slug1", "slug2", ...],\n'
        '  ...\n'
        '}\n'
        'Donde las claves son los punto_id como strings.'
    )

    message = client.messages.create(
        model=IA_MODEL_LITE,
        max_tokens=2048,
        messages=[{'role': 'user', 'content': prompt}],
    )

    texto_respuesta = message.content[0].text.strip()
    # Extraer JSON aunque venga envuelto en markdown
    match = re.search(r'\{[\s\S]+\}', texto_respuesta)
    if not match:
        raise ValueError(f'La IA no devolvió un objeto JSON válido: {texto_respuesta[:200]}')

    asignaciones = _parse_json_robust(match.group(), contexto='generar_tags')
    if not isinstance(asignaciones, dict):
        raise ValueError('La IA devolvió JSON pero no es un objeto.')

    # ── 4. Crear PuntoTag ────────────────────────────────────────────────────
    # Construir mapa punto_id → objeto PuntoOrden
    from .models import PuntoOrden
    punto_map = {p.id: p for p in reunion.puntos.all()}

    creados = 0
    for str_id, slugs in asignaciones.items():
        try:
            punto_id = int(str_id)
        except (ValueError, TypeError):
            continue

        punto_obj = punto_map.get(punto_id)
        if punto_obj is None:
            continue

        if not isinstance(slugs, list):
            continue

        for slug in slugs:
            if not isinstance(slug, str):
                continue
            tag_obj = slug_to_tag.get(slug)
            if tag_obj is None:
                logger.warning('generar_tags: slug desconocido "%s" ignorado.', slug)
                continue
            _, created = PuntoTag.objects.get_or_create(
                punto=punto_obj,
                tag=tag_obj,
                defaults={'origen': PuntoTag.Origen.IA, 'notas': ''},
            )
            if created:
                creados += 1

    logger.info(
        'generar_tags_reunion: reunion_id=%s, %d punto(s), %d tag(s) creados, '
        'tokens entrada=%s salida=%s',
        reunion.pk,
        len(puntos),
        creados,
        getattr(message.usage, 'input_tokens', '?'),
        getattr(message.usage, 'output_tokens', '?'),
    )

    return {
        'message': f'Tags generados correctamente. {creados} tag(s) nuevo(s) asignado(s).',
        'creados': creados,
    }
