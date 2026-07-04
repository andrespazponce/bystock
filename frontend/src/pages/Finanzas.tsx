import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import Layout from '../components/Layout'
import { useAuth } from '../auth/AuthContext'
import {
  type DashboardData,
  type PeriodoDisponible,
  getDashboard,
  getPeriodosDisponibles,
} from '../api/finanzas'

// ── Helpers ──────────────────────────────────────────────────────────────────

function bs(val: number | undefined | null): string {
  if (val == null) return '—'
  return 'Bs. ' + Math.round(val).toLocaleString('es-BO')
}

function pct(val: number | null | undefined): string {
  if (val == null) return '—'
  return (val * 100).toFixed(1) + '%'
}

function ratio(val: number | null | undefined, decimales = 2): string {
  if (val == null) return '—'
  return val.toFixed(decimales) + 'x'
}

const COLORES = [
  'var(--gold)', '#60a5fa', '#34d399', '#f87171',
  '#a78bfa', '#fb923c', '#38bdf8', '#4ade80', '#f472b6',
]

// ── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({
  label, valor, sub, color,
}: { label: string; valor: string; sub?: string; color?: string }) {
  return (
    <div
      className="card"
      style={{ flex: '1 1 180px', minWidth: 150, padding: '1rem 1.25rem' }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: color ?? 'var(--text)' }}>
        {valor}
      </p>
      {sub && <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function Finanzas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const esGestor = !!user?.is_staff

  const [data, setData] = useState<DashboardData | null>(null)
  const [periodos, setPeriodos] = useState<PeriodoDisponible[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [anioSel, setAnioSel] = useState<number | undefined>()
  const [mesSel, setMesSel]   = useState<number | undefined>()

  // Cargar períodos disponibles
  useEffect(() => {
    getPeriodosDisponibles().then(setPeriodos).catch(() => {})
  }, [])

  // Cargar dashboard
  useEffect(() => {
    setCargando(true)
    setError(null)
    getDashboard(anioSel, mesSel)
      .then(d => {
        setData(d)
        setAnioSel(d.periodo.anio)
        setMesSel(d.periodo.mes)
      })
      .catch(err => {
        const msg = err?.response?.data?.error
        setError(msg ?? 'No hay datos financieros cargados aún.')
        setData(null)
      })
      .finally(() => setCargando(false))
  }, [anioSel, mesSel])

  // ── Datos para gráficos ──────────────────────────────────────────────────

  const dataBarra = data?.empresas.map((e) => ({
    nombre: e.empresa_codigo || e.empresa_nombre,
    'Act. Corriente': e.activo_corriente ?? 0,
    'Act. No Corriente': e.activo_no_corriente ?? 0,
    'Pasivo Corriente': e.pasivo_corriente ?? 0,
    'Pasivo No Corriente': e.pasivo_no_corriente ?? 0,
    Patrimonio: e.patrimonio ?? 0,
  })) ?? []

  const dataPie = data?.empresas.map((e, i) => ({
    name: e.empresa_codigo || e.empresa_nombre,
    value: Math.round(e.activo_total ?? 0),
    color: COLORES[i % COLORES.length],
  })).filter(d => d.value > 0) ?? []

  const con = data?.consolidado

  const periodoLabel = data
    ? periodos.find(p => p.anio === data.periodo.anio && p.mes === data.periodo.mes)?.label
      ?? `${data.periodo.mes}/${data.periodo.anio}`
    : ''

  return (
    <Layout>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="serif" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--gold-strong)' }}>
            Dashboard Financiero
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.9rem' }}>
            Balance General consolidado del grupo corporativo
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Selector de período */}
          {periodos.length > 0 && (
            <select
              value={anioSel && mesSel ? `${anioSel}-${mesSel}` : ''}
              onChange={e => {
                const [a, m] = e.target.value.split('-').map(Number)
                setAnioSel(a); setMesSel(m)
              }}
              style={{
                padding: '0.45rem 0.75rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: '0.9rem',
              }}
            >
              {periodos.map(p => (
                <option key={`${p.anio}-${p.mes}`} value={`${p.anio}-${p.mes}`}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
          <button className="btn-ghost" onClick={() => navigate('/finanzas/subir')} style={{ padding: '0.45rem 0.9rem' }}>
            Reportes PDF
          </button>
          {esGestor && (
            <button className="btn-gold" style={{ padding: '0.45rem 1rem' }} onClick={() => navigate('/finanzas/importar')}>
              ↑ Importar Excel
            </button>
          )}
        </div>
      </div>

      {/* Estado de carga */}
      {cargando && <p style={{ color: 'var(--text-muted)' }}>Cargando datos…</p>}

      {/* Sin datos */}
      {!cargando && error && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</p>
          <p style={{ marginBottom: '1rem' }}>{error}</p>
          {esGestor && (
            <button className="btn-gold" style={{ padding: '0.6rem 1.4rem' }} onClick={() => navigate('/finanzas/importar')}>
              Importar primer Excel
            </button>
          )}
        </div>
      )}

      {/* Dashboard con datos */}
      {!cargando && data && con && (
        <>
          {/* Período activo */}
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Período: <strong style={{ color: 'var(--gold)' }}>{periodoLabel}</strong>
            {' · '}{data.empresas.length} empresa{data.empresas.length !== 1 ? 's' : ''} con datos
          </p>

          {/* KPIs consolidados */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
              Consolidado
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <KpiCard label="Activo Total"    valor={bs(con.activo_total)}    color="var(--gold-strong)" />
              <KpiCard label="Pasivo Total"    valor={bs(con.pasivo_total)}    sub={`${pct((con.pasivo_total ?? 0) / (con.activo_total ?? 1))} del activo`} />
              <KpiCard label="Patrimonio"      valor={bs(con.patrimonio)}      color="var(--success)" />
              <KpiCard label="Resultado Gest." valor={bs(con.resultado_gestion)} color={(con.resultado_gestion ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'} />
              <KpiCard label="Liquidez"        valor={ratio(con.ratios.liquidez_corriente)} sub="Act. Cte / Pas. Cte" color={(con.ratios.liquidez_corriente ?? 0) >= 1 ? 'var(--success)' : 'var(--danger)'} />
              <KpiCard label="ROA"             valor={pct(con.ratios.roa)} sub="Resultado / Activo" color={(con.ratios.roa ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'} />
              <KpiCard label="ROE"             valor={pct(con.ratios.roe)} sub="Resultado / Capital" color={(con.ratios.roe ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'} />
            </div>
          </section>

          {/* Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

            {/* Barras: estructura financiera por empresa */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 className="serif" style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--gold)' }}>
                Estructura por empresa
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dataBarra} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => (v / 1_000_000).toFixed(1) + 'M'} />
                  <Tooltip formatter={(v) => bs(typeof v === 'number' ? v : Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Act. Corriente"     fill="#c9a84c" radius={[3,3,0,0]} />
                  <Bar dataKey="Act. No Corriente"  fill="#60a5fa" radius={[3,3,0,0]} />
                  <Bar dataKey="Pasivo Corriente"   fill="#f87171" radius={[3,3,0,0]} />
                  <Bar dataKey="Pasivo No Corriente" fill="#fb923c" radius={[3,3,0,0]} />
                  <Bar dataKey="Patrimonio"         fill="#34d399" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Donut: participación en Activo Total */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 className="serif" style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--gold)' }}>
                Participación en Activo Total
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={dataPie}
                    cx="50%" cy="45%"
                    innerRadius={60} outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dataPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => bs(typeof v === 'number' ? v : Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla de ratios por empresa */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
              Ratios por empresa
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Activo Total</th>
                    <th>Pasivo Total</th>
                    <th>Patrimonio</th>
                    <th>Liquidez</th>
                    <th>Endeudamiento</th>
                    <th>ROA</th>
                    <th>ROE</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empresas.map(e => (
                    <tr key={e.empresa_id}>
                      <td style={{ fontWeight: 600 }}>{e.empresa_nombre}</td>
                      <td>{bs(e.activo_total)}</td>
                      <td>{bs(e.pasivo_total)}</td>
                      <td style={{ color: (e.patrimonio ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {bs(e.patrimonio)}
                      </td>
                      <td style={{ color: (e.ratios.liquidez_corriente ?? 0) >= 1 ? 'var(--success)' : 'var(--danger)' }}>
                        {ratio(e.ratios.liquidez_corriente)}
                      </td>
                      <td>{ratio(e.ratios.endeudamiento)}</td>
                      <td style={{ color: (e.ratios.roa ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {pct(e.ratios.roa)}
                      </td>
                      <td style={{ color: (e.ratios.roe ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {pct(e.ratios.roe)}
                      </td>
                    </tr>
                  ))}
                  {/* Fila consolidada */}
                  <tr style={{ background: 'rgba(201,168,76,0.07)', fontWeight: 700 }}>
                    <td style={{ color: 'var(--gold-strong)' }}>Consolidado</td>
                    <td>{bs(con.activo_total)}</td>
                    <td>{bs(con.pasivo_total)}</td>
                    <td style={{ color: (con.patrimonio ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {bs(con.patrimonio)}
                    </td>
                    <td style={{ color: (con.ratios.liquidez_corriente ?? 0) >= 1 ? 'var(--success)' : 'var(--danger)' }}>
                      {ratio(con.ratios.liquidez_corriente)}
                    </td>
                    <td>{ratio(con.ratios.endeudamiento)}</td>
                    <td style={{ color: (con.ratios.roa ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {pct(con.ratios.roa)}
                    </td>
                    <td style={{ color: (con.ratios.roe ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {pct(con.ratios.roe)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Layout>
  )
}
