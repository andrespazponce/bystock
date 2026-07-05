"""
Plan de cuentas — estándar Bolivia (NIC adaptadas).

Incluye:
  · Balance General        (BG)  tipo: ACTIVO | PASIVO | PATRIMONIO | TOTAL
  · Estado de Resultados   (ER)  tipo: INGRESO | COSTO | GASTO | TOTAL
  · Flujo de Caja          (FC)  tipo: FLUJO | TOTAL  [base — ampliar según formato]

Campos:
  codigo        → clave interna única (BG-1, ER-1, FC-1…)
  nombre        → nombre de pantalla
  nombre_excel  → texto exacto a buscar en el Excel (case-insensitive)
  padre         → codigo del padre (None = raíz)
  tipo          → ver lista arriba
  es_cabecera   → True si es grupo (negrita, sin valor directo)
  es_total      → True si es fila de total/subtotal
  orden         → posición en pantalla

NOTA sobre duplicados de nombre en el mismo documento:
  El importer usa el PRIMER match cuando dos filas tienen el mismo texto.
  Si un ER tiene "Otros Gastos" en dos posiciones distintas, la segunda fila
  debe renombrarse en el Excel (ej. "Otros Gastos No Oper.") para ser capturada.
"""

CUENTAS_BALANCE_GENERAL = [
    # ── ACTIVO ───────────────────────────────────────────────────────────────
    {
        'codigo': 'BG-1', 'nombre': 'Activo Total',
        'nombre_excel': 'Activo Total',
        'padre': None, 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': True, 'orden': 1,
    },
    {
        'codigo': 'BG-1.1', 'nombre': 'Activo Corriente',
        'nombre_excel': 'Activo Corriente',
        'padre': 'BG-1', 'tipo': 'ACTIVO',
        'es_cabecera': True, 'es_total': True, 'orden': 2,
    },
    {
        'codigo': 'BG-1.1.1', 'nombre': 'Disponible',
        'nombre_excel': 'Disponible',
        'padre': 'BG-1.1', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 3,
    },
    {
        'codigo': 'BG-1.1.2', 'nombre': 'Exigible',
        'nombre_excel': 'Exigible',
        'padre': 'BG-1.1', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 4,
    },
    {
        'codigo': 'BG-1.1.3', 'nombre': 'Realizable',
        'nombre_excel': 'Realizable',
        'padre': 'BG-1.1', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 5,
    },
    {
        'codigo': 'BG-1.2', 'nombre': 'Activo No Corriente',
        'nombre_excel': 'Activo No Corriente',
        'padre': 'BG-1', 'tipo': 'ACTIVO',
        'es_cabecera': True, 'es_total': True, 'orden': 6,
    },
    {
        'codigo': 'BG-1.2.1', 'nombre': 'Bienes de Uso',
        'nombre_excel': 'Bienes de Uso',
        'padre': 'BG-1.2', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 7,
    },
    {
        'codigo': 'BG-1.2.2', 'nombre': 'Activo Intangible',
        'nombre_excel': 'Activo Intangible',
        'padre': 'BG-1.2', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 8,
    },
    {
        'codigo': 'BG-1.2.3', 'nombre': 'Activo Diferido',
        'nombre_excel': 'Activo Diferido',
        'padre': 'BG-1.2', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 9,
    },
    {
        'codigo': 'BG-1.2.4', 'nombre': 'Inversiones',
        'nombre_excel': 'Inversiones',
        'padre': 'BG-1.2', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 10,
    },
    {
        'codigo': 'BG-1.2.5', 'nombre': 'Inversiones Temporarias',
        'nombre_excel': 'Inversiones Temporarias',
        'padre': 'BG-1.2', 'tipo': 'ACTIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 11,
    },
    # ── PASIVO ───────────────────────────────────────────────────────────────
    {
        'codigo': 'BG-2', 'nombre': 'Pasivo Total',
        'nombre_excel': 'Pasivo Total',
        'padre': None, 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': True, 'orden': 12,
    },
    {
        'codigo': 'BG-2.1', 'nombre': 'Pasivo Corriente',
        'nombre_excel': 'Pasivo Corriente',
        'padre': 'BG-2', 'tipo': 'PASIVO',
        'es_cabecera': True, 'es_total': True, 'orden': 13,
    },
    {
        'codigo': 'BG-2.1.1', 'nombre': 'Cuentas por Pagar',
        'nombre_excel': 'Cuentas por Pagar',
        'padre': 'BG-2.1', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 14,
    },
    {
        'codigo': 'BG-2.1.2', 'nombre': 'Empresas por Pagar',
        'nombre_excel': 'Empresas por Pagar',
        'padre': 'BG-2.1', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 15,
    },
    {
        'codigo': 'BG-2.1.3', 'nombre': 'Entregas Pendientes',
        'nombre_excel': 'Entregas Pendientes',
        'padre': 'BG-2.1', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 16,
    },
    {
        'codigo': 'BG-2.1.4', 'nombre': 'Ventas Anticipadas',
        'nombre_excel': 'Ventas Anticipadas',
        'padre': 'BG-2.1', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 17,
    },
    {
        'codigo': 'BG-2.1.5', 'nombre': 'Obligaciones con el Personal',
        'nombre_excel': 'Obligaciones con el Personal',
        'padre': 'BG-2.1', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 18,
    },
    {
        'codigo': 'BG-2.1.6', 'nombre': 'Provisiones Operativas',
        'nombre_excel': 'Provisiones Operativas',
        'padre': 'BG-2.1', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 19,
    },
    {
        'codigo': 'BG-2.2', 'nombre': 'Pasivo No Corriente',
        'nombre_excel': 'Pasivo No Corriente',
        'padre': 'BG-2', 'tipo': 'PASIVO',
        'es_cabecera': True, 'es_total': True, 'orden': 20,
    },
    {
        'codigo': 'BG-2.2.1', 'nombre': 'Obligaciones Bancarias',
        'nombre_excel': 'Obligaciones Bancarias',
        'padre': 'BG-2.2', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 21,
    },
    {
        'codigo': 'BG-2.2.2', 'nombre': 'Intereses por Pagar',
        'nombre_excel': 'Intereses por Pagar',
        'padre': 'BG-2.2', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 22,
    },
    {
        'codigo': 'BG-2.2.3', 'nombre': 'Documentos por pagar a largo Plazo',
        'nombre_excel': 'Documentos por pagar a largo Plazo',
        'padre': 'BG-2.2', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 23,
    },
    {
        'codigo': 'BG-2.2.4', 'nombre': 'Previsión indemnizaciones',
        'nombre_excel': 'Previsión indemnizaciones',
        'padre': 'BG-2.2', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 24,
    },
    {
        'codigo': 'BG-2.2.5', 'nombre': 'Reserva para futuras Contingencias',
        'nombre_excel': 'Reserva para futuras Contingencias',
        'padre': 'BG-2.2', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 25,
    },
    {
        'codigo': 'BG-2.2.6', 'nombre': 'Procesos Legales',
        'nombre_excel': 'Procesos Legales',
        'padre': 'BG-2.2', 'tipo': 'PASIVO',
        'es_cabecera': False, 'es_total': False, 'orden': 26,
    },
    # ── PATRIMONIO ───────────────────────────────────────────────────────────
    {
        'codigo': 'BG-3', 'nombre': 'Patrimonio',
        'nombre_excel': 'Patrimonio',
        'padre': None, 'tipo': 'PATRIMONIO',
        'es_cabecera': True, 'es_total': True, 'orden': 27,
    },
    {
        'codigo': 'BG-3.1', 'nombre': 'Capital Social',
        'nombre_excel': 'Capital Social',
        'padre': 'BG-3', 'tipo': 'PATRIMONIO',
        'es_cabecera': False, 'es_total': False, 'orden': 28,
    },
    {
        'codigo': 'BG-3.2', 'nombre': 'Ajuste del Patrimonio',
        'nombre_excel': 'Ajuste del Patrimonio',
        'padre': 'BG-3', 'tipo': 'PATRIMONIO',
        'es_cabecera': False, 'es_total': False, 'orden': 29,
    },
    {
        'codigo': 'BG-3.3', 'nombre': 'Reservas Legales',
        'nombre_excel': 'Reservas Legales',
        'padre': 'BG-3', 'tipo': 'PATRIMONIO',
        'es_cabecera': False, 'es_total': False, 'orden': 30,
    },
    {
        'codigo': 'BG-3.4', 'nombre': 'Resultados Acumulados',
        'nombre_excel': 'Resultados Acumulados',
        'padre': 'BG-3', 'tipo': 'PATRIMONIO',
        'es_cabecera': False, 'es_total': False, 'orden': 31,
    },
    {
        'codigo': 'BG-3.5', 'nombre': 'Resultados de la Gestión',
        'nombre_excel': 'Resultados de la Gestión',
        'padre': 'BG-3', 'tipo': 'PATRIMONIO',
        'es_cabecera': False, 'es_total': False, 'orden': 32,
    },
    # ── TOTALES FINALES ───────────────────────────────────────────────────────
    {
        'codigo': 'BG-4', 'nombre': 'Total Pasivo y Patrimonio',
        'nombre_excel': 'Total Pasivo y Patrimonio',
        'padre': None, 'tipo': 'TOTAL',
        'es_cabecera': False, 'es_total': True, 'orden': 33,
    },
    {
        'codigo': 'BG-5', 'nombre': 'Diferencia',
        'nombre_excel': 'Diferencia',
        'padre': None, 'tipo': 'TOTAL',
        'es_cabecera': False, 'es_total': False, 'orden': 34,
    },
]

# ══════════════════════════════════════════════════════════════════════════════
# ESTADO DE RESULTADOS
# Basado en el formato real de Bystock.
#
# ⚠ "Otros Gastos" aparece DOS veces en el documento:
#   · ER-4.5  → dentro de Gastos Totales      (nombre_excel: 'Otros Gastos')
#   · ER-7    → ajuste no operativo post-utilidad (nombre_excel: 'Otros Gastos No Oper.')
#   En el Excel, la segunda celda debe decir exactamente "Otros Gastos No Oper."
#   para que el importer la capture correctamente.
# ══════════════════════════════════════════════════════════════════════════════

CUENTAS_ESTADO_RESULTADOS = [
    # ── INGRESOS ─────────────────────────────────────────────────────────────
    {
        'codigo': 'ER-1', 'nombre': 'Ventas Netas',
        'nombre_excel': 'Ventas Netas',
        'padre': None, 'tipo': 'INGRESO',
        'es_cabecera': False, 'es_total': False, 'orden': 1,
    },
    # ── COSTO DE VENTAS ───────────────────────────────────────────────────────
    {
        'codigo': 'ER-2', 'nombre': 'Costo de Ventas',
        'nombre_excel': 'Costo de Ventas',
        'padre': None, 'tipo': 'COSTO',
        'es_cabecera': True, 'es_total': False, 'orden': 2,
    },
    {
        'codigo': 'ER-2.1', 'nombre': 'Inventario Inicial',
        'nombre_excel': 'Inventario Inicial',
        'padre': 'ER-2', 'tipo': 'COSTO',
        'es_cabecera': False, 'es_total': False, 'orden': 3,
    },
    {
        'codigo': 'ER-2.2', 'nombre': 'Compras',
        'nombre_excel': 'Compras',
        'padre': 'ER-2', 'tipo': 'COSTO',
        'es_cabecera': False, 'es_total': False, 'orden': 4,
    },
    {
        'codigo': 'ER-2.3', 'nombre': 'Fletes de Agencias',
        'nombre_excel': 'Fletes de agencias',
        'padre': 'ER-2', 'tipo': 'COSTO',
        'es_cabecera': False, 'es_total': False, 'orden': 5,
    },
    {
        'codigo': 'ER-2.4', 'nombre': 'Costo de Producción',
        'nombre_excel': 'Costo de Produccion',
        'padre': 'ER-2', 'tipo': 'COSTO',
        'es_cabecera': False, 'es_total': False, 'orden': 6,
    },
    {
        'codigo': 'ER-2.5', 'nombre': 'Inventario Final Prod. Terminado',
        'nombre_excel': 'Invent.Final Prod.Termin.',
        'padre': 'ER-2', 'tipo': 'COSTO',
        'es_cabecera': False, 'es_total': False, 'orden': 7,
    },
    # ── UTILIDAD BRUTA ────────────────────────────────────────────────────────
    {
        'codigo': 'ER-3', 'nombre': 'Utilidad Bruta',
        'nombre_excel': 'Utilidad Bruta',
        'padre': None, 'tipo': 'TOTAL',
        'es_cabecera': False, 'es_total': True, 'orden': 8,
    },
    # ── GASTOS ────────────────────────────────────────────────────────────────
    {
        'codigo': 'ER-4', 'nombre': 'Gastos Totales',
        'nombre_excel': 'Gastos totales',
        'padre': None, 'tipo': 'GASTO',
        'es_cabecera': True, 'es_total': True, 'orden': 9,
    },
    {
        'codigo': 'ER-4.1', 'nombre': 'Gastos Administrativos',
        'nombre_excel': 'Gastos Administrativos',
        'padre': 'ER-4', 'tipo': 'GASTO',
        'es_cabecera': False, 'es_total': False, 'orden': 10,
    },
    {
        'codigo': 'ER-4.2', 'nombre': 'Gastos Comerciales',
        'nombre_excel': 'Gastos Comerciales',
        'padre': 'ER-4', 'tipo': 'GASTO',
        'es_cabecera': False, 'es_total': False, 'orden': 11,
    },
    {
        'codigo': 'ER-4.3', 'nombre': 'Gastos Financieros',
        'nombre_excel': 'Gastos Financieros',
        'padre': 'ER-4', 'tipo': 'GASTO',
        'es_cabecera': False, 'es_total': False, 'orden': 12,
    },
    {
        'codigo': 'ER-4.4', 'nombre': 'Gastos de Impuestos',
        'nombre_excel': 'Gastos De Impuestos',
        'padre': 'ER-4', 'tipo': 'GASTO',
        'es_cabecera': False, 'es_total': False, 'orden': 13,
    },
    {
        'codigo': 'ER-4.5', 'nombre': 'Otros Gastos Operativos',
        'nombre_excel': 'Otros Gastos',          # ← primera ocurrencia en el Excel
        'padre': 'ER-4', 'tipo': 'GASTO',
        'es_cabecera': False, 'es_total': False, 'orden': 14,
    },
    # ── UTILIDAD OPERATIVA ────────────────────────────────────────────────────
    {
        'codigo': 'ER-5', 'nombre': 'Utilidad Operativa',
        'nombre_excel': 'Utilidad Operativa',
        'padre': None, 'tipo': 'TOTAL',
        'es_cabecera': False, 'es_total': True, 'orden': 15,
    },
    # ── AJUSTES NO OPERATIVOS ─────────────────────────────────────────────────
    {
        'codigo': 'ER-6', 'nombre': 'Otros Ingresos',
        'nombre_excel': 'Otros Ingresos',
        'padre': None, 'tipo': 'INGRESO',
        'es_cabecera': False, 'es_total': False, 'orden': 16,
    },
    {
        'codigo': 'ER-7', 'nombre': 'Otros Gastos No Operativos',
        'nombre_excel': 'Otros Gastos No Oper.',  # ← renombrar en el Excel
        'padre': None, 'tipo': 'GASTO',
        'es_cabecera': False, 'es_total': False, 'orden': 17,
    },
    {
        'codigo': 'ER-8', 'nombre': 'Asesoramiento RPR',
        'nombre_excel': 'Asesoramiento RPR',
        'padre': None, 'tipo': 'GASTO',
        'es_cabecera': False, 'es_total': False, 'orden': 18,
    },
    # ── RESULTADO FINAL ───────────────────────────────────────────────────────
    {
        'codigo': 'ER-9', 'nombre': 'Utilidad Neta',
        'nombre_excel': 'Utilidad Neta',
        'padre': None, 'tipo': 'TOTAL',
        'es_cabecera': False, 'es_total': True, 'orden': 19,
    },
]

# ══════════════════════════════════════════════════════════════════════════════
# FLUJO DE CAJA OPERATIVA  (estructura base — ampliar al recibir el formato real)
# ══════════════════════════════════════════════════════════════════════════════

CUENTAS_FLUJO_CAJA = [
    {
        'codigo': 'FC-1', 'nombre': 'Flujo Operativo',
        'nombre_excel': 'Flujo Operativo',
        'padre': None, 'tipo': 'FLUJO',
        'es_cabecera': True, 'es_total': False, 'orden': 1,
    },
    {
        'codigo': 'FC-1.1', 'nombre': 'Resultado del Período',
        'nombre_excel': 'Resultado del Período',
        'padre': 'FC-1', 'tipo': 'FLUJO',
        'es_cabecera': False, 'es_total': False, 'orden': 2,
    },
    {
        'codigo': 'FC-1.2', 'nombre': 'Depreciaciones y Amortizaciones',
        'nombre_excel': 'Depreciaciones y Amortizaciones',
        'padre': 'FC-1', 'tipo': 'FLUJO',
        'es_cabecera': False, 'es_total': False, 'orden': 3,
    },
    {
        'codigo': 'FC-1.3', 'nombre': 'Variación de Capital de Trabajo',
        'nombre_excel': 'Variación de Capital de Trabajo',
        'padre': 'FC-1', 'tipo': 'FLUJO',
        'es_cabecera': False, 'es_total': False, 'orden': 4,
    },
    {
        'codigo': 'FC-2', 'nombre': 'Flujo de Inversión',
        'nombre_excel': 'Flujo de Inversión',
        'padre': None, 'tipo': 'FLUJO',
        'es_cabecera': True, 'es_total': False, 'orden': 5,
    },
    {
        'codigo': 'FC-2.1', 'nombre': 'Compra de Activos Fijos',
        'nombre_excel': 'Compra de Activos Fijos',
        'padre': 'FC-2', 'tipo': 'FLUJO',
        'es_cabecera': False, 'es_total': False, 'orden': 6,
    },
    {
        'codigo': 'FC-3', 'nombre': 'Flujo de Financiamiento',
        'nombre_excel': 'Flujo de Financiamiento',
        'padre': None, 'tipo': 'FLUJO',
        'es_cabecera': True, 'es_total': False, 'orden': 7,
    },
    {
        'codigo': 'FC-3.1', 'nombre': 'Préstamos Obtenidos',
        'nombre_excel': 'Préstamos Obtenidos',
        'padre': 'FC-3', 'tipo': 'FLUJO',
        'es_cabecera': False, 'es_total': False, 'orden': 8,
    },
    {
        'codigo': 'FC-3.2', 'nombre': 'Pago de Préstamos',
        'nombre_excel': 'Pago de Préstamos',
        'padre': 'FC-3', 'tipo': 'FLUJO',
        'es_cabecera': False, 'es_total': False, 'orden': 9,
    },
    {
        'codigo': 'FC-4', 'nombre': 'Flujo Neto del Período',
        'nombre_excel': 'Flujo Neto del Período',
        'padre': None, 'tipo': 'TOTAL',
        'es_cabecera': False, 'es_total': True, 'orden': 10,
    },
    {
        'codigo': 'FC-5', 'nombre': 'Saldo Inicial de Caja',
        'nombre_excel': 'Saldo Inicial de Caja',
        'padre': None, 'tipo': 'FLUJO',
        'es_cabecera': False, 'es_total': False, 'orden': 11,
    },
    {
        'codigo': 'FC-6', 'nombre': 'Saldo Final de Caja',
        'nombre_excel': 'Saldo Final de Caja',
        'padre': None, 'tipo': 'TOTAL',
        'es_cabecera': False, 'es_total': True, 'orden': 12,
    },
]
