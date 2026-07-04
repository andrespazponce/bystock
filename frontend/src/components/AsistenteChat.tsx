import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { preguntarAsistente } from '../api/asistente'
import type { MensajeChat, ReferenciaActa } from '../api/asistente'

// ── Generador de IDs únicos ───────────────────────────────────────────────────
let _seq = 0
function uid() {
  return `m${Date.now()}_${++_seq}`
}

// ── Icono de Sparkle (IA) ─────────────────────────────────────────────────────
function IconSparkle({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
      <path d="M5 3L5.7 5.3L8 6L5.7 6.7L5 9L4.3 6.7L2 6L4.3 5.3L5 3Z" strokeWidth={1.4} />
      <path d="M19 16L19.5 17.7L21 18.2L19.5 18.7L19 20.4L18.5 18.7L17 18.2L18.5 17.7L19 16Z" strokeWidth={1.4} />
    </svg>
  )
}

// ── Icono X (cerrar) ──────────────────────────────────────────────────────────
function IconX({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Icono Enviar ──────────────────────────────────────────────────────────────
function IconEnviar({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

// ── Chip de referencia ────────────────────────────────────────────────────────
function ChipReferencia({ referencia: r, onClick }: { referencia: ReferenciaActa; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={r.titulo_punto}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 600,
        border: '1px solid var(--gold)',
        color: 'var(--gold)',
        background: 'var(--gold-soft)',
        cursor: 'pointer',
        maxWidth: '100%',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75' }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
    >
      <span style={{ flexShrink: 0 }}>↗</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {r.etiqueta} · {r.titulo_punto}
      </span>
    </button>
  )
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────
function BurbujasMensaje({ msg, onRef }: {
  msg: MensajeChat
  onRef: (r: ReferenciaActa) => void
}) {
  const esUsuario = msg.rol === 'user'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: esUsuario ? 'flex-end' : 'flex-start',
        gap: '0.35rem',
        marginBottom: '0.75rem',
      }}
    >
      {/* Burbuja */}
      <div
        style={{
          maxWidth: '85%',
          padding: '0.6rem 0.85rem',
          borderRadius: esUsuario ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
          fontSize: '0.88rem',
          lineHeight: 1.55,
          background: esUsuario
            ? 'rgba(201,168,76,0.15)'
            : 'var(--surface-2)',
          border: `1px solid ${esUsuario ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
          color: msg.error ? 'var(--danger)' : 'var(--text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.cargando ? (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Consultando la memoria corporativa…
          </span>
        ) : (
          msg.texto
        )}
      </div>

      {/* Referencias (solo en mensajes del asistente con refs) */}
      {!esUsuario && !msg.cargando && (msg.referencias?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '90%' }}>
          {msg.referencias!.map((r) => (
            <ChipReferencia key={r.punto_id} referencia={r} onClick={() => onRef(r)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal: botón flotante + panel de chat ─────────────────────
export default function AsistenteChat() {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // Scroll automático al último mensaje
  useEffect(() => {
    if (listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight
    }
  }, [mensajes])

  // Foco automático al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [abierto])

  function handleRef(r: ReferenciaActa) {
    navigate(`/reuniones/${r.reunion_id}`)
    setAbierto(false)
  }

  async function enviar() {
    const pregunta = input.trim()
    if (!pregunta || cargando) return

    const msgUsuario: MensajeChat = { id: uid(), rol: 'user', texto: pregunta }
    const msgEspera: MensajeChat = { id: uid(), rol: 'asistente', texto: '', cargando: true }

    setInput('')
    setMensajes((prev) => [...prev, msgUsuario, msgEspera])
    setCargando(true)

    try {
      const { respuesta, referencias } = await preguntarAsistente(pregunta, [
        ...mensajes,
        msgUsuario,
      ])
      setMensajes((prev) =>
        prev.map((m) =>
          m.id === msgEspera.id
            ? { ...m, texto: respuesta, referencias, cargando: false }
            : m
        )
      )
    } catch (err) {
      const texto =
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con el asistente. Intentá de nuevo.'
      setMensajes((prev) =>
        prev.map((m) =>
          m.id === msgEspera.id
            ? { ...m, texto, cargando: false, error: true }
            : m
        )
      )
    } finally {
      setCargando(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <>
      {/* ── Panel de chat ─────────────────────────────────────────────── */}
      {abierto && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            right: 24,
            width: 360,
            maxHeight: 520,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'asistente-slide-up 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <IconSparkle size={18} color="var(--gold)" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                Asistente Corporativo
              </p>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Memoria de INCERPAZ / GIPRO
              </p>
            </div>
            <button
              onClick={() => setAbierto(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '0.25rem',
                display: 'flex',
                borderRadius: 6,
              }}
              title="Cerrar"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Lista de mensajes */}
          <div
            ref={listaRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {mensajes.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '1rem' }}>
                <IconSparkle size={32} color="var(--gold)" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
                  Preguntame sobre cualquier reunión, resolución o compromiso del Directorio.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
                  {[
                    '¿Qué se decidió sobre los estados financieros?',
                    '¿Cuáles son los compromisos pendientes?',
                    '¿Qué resoluciones se tomaron en 2025?',
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => { setInput(sug); inputRef.current?.focus() }}
                      style={{
                        padding: '0.4rem 0.7rem',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--gold)'
                        e.currentTarget.style.color = 'var(--text)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.color = 'var(--text-muted)'
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((msg) => (
              <BurbujasMensaje key={msg.id} msg={msg} onRef={handleRef} />
            ))}
          </div>

          {/* Input */}
          <div
            style={{
              padding: '0.75rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-end',
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={cargando}
              rows={1}
              placeholder="Escribí tu pregunta…"
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                fontSize: '0.88rem',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                maxHeight: 100,
                overflowY: 'auto',
              }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 100) + 'px'
              }}
            />
            <button
              onClick={enviar}
              disabled={!input.trim() || cargando}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: !input.trim() || cargando ? 'var(--border)' : 'var(--gold)',
                color: !input.trim() || cargando ? 'var(--text-muted)' : 'var(--bg)',
                cursor: !input.trim() || cargando ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
              title="Enviar (Enter)"
            >
              <IconEnviar size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Botón flotante ────────────────────────────────────────────── */}
      <button
        onClick={() => setAbierto((a) => !a)}
        title={abierto ? 'Cerrar asistente' : 'Asistente de Memoria Corporativa'}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: `2px solid ${abierto ? 'var(--gold-300)' : 'var(--gold)'}`,
          background: abierto ? 'var(--gold)' : 'var(--surface)',
          color: abierto ? 'var(--bg)' : 'var(--gold)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          boxShadow: abierto
            ? '0 4px 20px rgba(201,168,76,0.5)'
            : '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease',
          transform: abierto ? 'rotate(15deg) scale(1.05)' : 'rotate(0deg) scale(1)',
        }}
        onMouseEnter={(e) => {
          if (!abierto) {
            e.currentTarget.style.background = 'var(--gold-soft)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.35)'
          }
        }}
        onMouseLeave={(e) => {
          if (!abierto) {
            e.currentTarget.style.background = 'var(--surface)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
          }
        }}
      >
        {abierto ? <IconX size={20} /> : <IconSparkle size={22} />}
      </button>

      {/* Animación de slide-up */}
      <style>{`
        @keyframes asistente-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </>
  )
}
