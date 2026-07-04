import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          margin: '2rem',
          padding: '1.5rem',
          borderRadius: 10,
          border: '1px solid #e55',
          background: '#fff5f5',
          fontFamily: 'monospace',
          maxWidth: 700,
        }}>
          <h2 style={{ margin: '0 0 0.75rem', color: '#c33', fontSize: '1.1rem' }}>
            ⚠️ Error al renderizar
          </h2>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#333' }}>
            {this.state.error.message}
          </p>
          <pre style={{
            margin: 0, fontSize: '0.78rem', color: '#555',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            background: '#f0f0f0', padding: '0.75rem', borderRadius: 6,
          }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '1rem', padding: '0.4rem 1rem',
              borderRadius: 6, border: '1px solid #c33',
              background: 'none', color: '#c33', cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
