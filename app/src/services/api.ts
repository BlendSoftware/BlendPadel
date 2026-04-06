import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios'

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = ''
const REFRESH_URL = '/auth/refresh'
const REFRESH_TTL_MS = 25 * 60 * 1000 // 25 min (proactive refresh)

// ─── Token storage (access in memory, refresh in localStorage) ───────────────

let _accessToken: string | null = null
let _refreshTimer: ReturnType<typeof setTimeout> | null = null

export const tokenStore = {
  getAccess: () => _accessToken,
  setAccess: (token: string) => {
    _accessToken = token
  },
  clearAccess: () => {
    _accessToken = null
  },
  getRefresh: () => localStorage.getItem('refresh_token'),
  setRefresh: (token: string) => localStorage.setItem('refresh_token', token),
  clearRefresh: () => localStorage.removeItem('refresh_token'),
  clearAll: () => {
    _accessToken = null
    localStorage.removeItem('refresh_token')
  },
}

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request interceptor: inject Bearer token ─────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Refresh logic ────────────────────────────────────────────────────────────

let _isRefreshing = false
let _refreshQueue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
}> = []

async function doRefresh(): Promise<string> {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) throw new Error('No refresh token')

  const res = await axios.post<{ access_token: string; refresh_token?: string }>(
    `${BASE_URL}${REFRESH_URL}`,
    { refresh_token: refreshToken },
  )

  const { access_token, refresh_token } = res.data
  tokenStore.setAccess(access_token)
  if (refresh_token) tokenStore.setRefresh(refresh_token)
  scheduleProactiveRefresh()
  return access_token
}

function drainQueue(token: string | null, error?: unknown) {
  _refreshQueue.forEach((cb) => {
    if (token) cb.resolve(token)
    else cb.reject(error)
  })
  _refreshQueue = []
}

// ─── Proactive refresh timer ──────────────────────────────────────────────────

export function scheduleProactiveRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  _refreshTimer = setTimeout(async () => {
    try {
      await doRefresh()
    } catch {
      // Will be caught by 401 interceptor on next request
    }
  }, REFRESH_TTL_MS)
}

export function cancelProactiveRefresh() {
  if (_refreshTimer) {
    clearTimeout(_refreshTimer)
    _refreshTimer = null
  }
}

// ─── Global HTTP error events (decoupled from store imports) ─────────────────

function dispatchToast(type: 'success' | 'error' | 'warning' | 'info', message: string) {
  window.dispatchEvent(new CustomEvent('toast:add', { detail: { type, message } }))
}

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Let 401 fall through to the refresh logic below; skip showing a toast
    if (error.response?.status !== 401 || original._retry) {
      const status = error.response?.status

      if (status === 403) {
        dispatchToast('error', 'No tenés permisos para realizar esta acción')
      } else if (status !== undefined && status >= 500) {
        dispatchToast('error', 'Error del servidor, intentá de nuevo')
      } else if (!error.response) {
        // Network error / timeout / no response
        dispatchToast('error', 'Error de conexión')
      }

      return Promise.reject(error)
    }

    if (_isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        _refreshQueue.push({
          resolve: (token) => {
            if (original.headers) original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          },
          reject,
        })
      })
    }

    original._retry = true
    _isRefreshing = true

    try {
      const newToken = await doRefresh()
      drainQueue(newToken)
      if (original.headers) original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch (refreshError) {
      drainQueue(null, refreshError)
      // Trigger logout via custom event (decoupled from store import)
      window.dispatchEvent(new CustomEvent('auth:logout'))
      return Promise.reject(refreshError)
    } finally {
      _isRefreshing = false
    }
  },
)

export default api
