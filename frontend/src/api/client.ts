import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { tokenStore } from '../auth/tokenStore'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// --- Request: adjunta el access token si existe ---
apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Renovación de token ante 401 ---
// Usamos axios "pelado" (no apiClient) para el refresh, así no disparamos otra
// vez los interceptores y evitamos recursión. Compartimos una sola promesa para
// que varias peticiones en paralelo no lancen múltiples refresh a la vez.
let refreshing: Promise<string | null> | null = null

async function refreshAccess(): Promise<string | null> {
  const refresh = tokenStore.getRefresh()
  if (!refresh) return null
  try {
    const res = await axios.post(`${baseURL}/api/token/refresh/`, { refresh })
    const newAccess = res.data.access as string
    const newRefresh = res.data.refresh as string | undefined
    tokenStore.setAccess(newAccess)
    if (newRefresh) tokenStore.setRefresh(newRefresh)
    return newAccess
  } catch {
    tokenStore.clear()
    return null
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      if (!refreshing) {
        refreshing = refreshAccess()
      }
      const newAccess = await refreshing
      refreshing = null

      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`
        return apiClient(original)
      }

      // El refresh falló: limpiamos y mandamos al login.
      tokenStore.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
