import type { AxiosError } from 'axios'

interface BackendProblem {
  detail?: string
  message?: string
  error_code?: string
  title?: string
}

export function extractApiError(error: unknown, fallback: string): string {
  const err = error as AxiosError<BackendProblem>
  const data = err.response?.data

  if (data?.error_code === 'GENDER_MISMATCH') {
    return 'Error de genero: estas intentando agregar jugadoras femeninas a un partido masculino.'
  }

  if (data?.detail) {
    return data.detail
  }

  if (data?.message) {
    return data.message
  }

  if (data?.title && data.title !== 'about:blank') {
    return data.title
  }

  if (err.response?.status === 409) {
    return 'Ya existe una solicitud de pareja o una relacion activa con esa jugadora/jugador.'
  }

  return fallback
}
