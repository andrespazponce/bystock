// Almacenamiento de tokens JWT.
//
// Decisión de seguridad (enfoque pragmático): el access token vive SOLO en
// memoria (se pierde al recargar, pero se renueva con el refresh), y el refresh
// token va en localStorage para sobrevivir recargas. Esto reduce la superficie
// de exposición frente a XSS. A futuro (hardening pre-producción) el refresh
// pasará a una cookie httpOnly y esta capa será el único lugar a cambiar.

const REFRESH_KEY = 'refresh_token'

let accessToken: string | null = null

export const tokenStore = {
  getAccess: (): string | null => accessToken,

  setAccess: (token: string | null): void => {
    accessToken = token
  },

  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),

  setRefresh: (token: string | null): void => {
    if (token) {
      localStorage.setItem(REFRESH_KEY, token)
    } else {
      localStorage.removeItem(REFRESH_KEY)
    }
  },

  clear: (): void => {
    accessToken = null
    localStorage.removeItem(REFRESH_KEY)
  },
}
