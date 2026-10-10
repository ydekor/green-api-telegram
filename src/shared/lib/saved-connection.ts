import { credentialsSchema, type Credentials } from '../api/green-api'

const key = 'greenchat-connection-v1'

export function readSavedConnection(): Credentials | null {
  try {
    const value = localStorage.getItem(key)
    if (!value) return null
    const parsed = credentialsSchema.safeParse(JSON.parse(value))
    if (parsed.success) return parsed.data
    localStorage.removeItem(key)
  } catch {
    // Storage may be unavailable in a private browser context.
  }
  return null
}

export function saveConnection(credentials: Credentials): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(credentials))
    return true
  } catch {
    return false
  }
}

export function forgetConnection() {
  try {
    localStorage.removeItem(key)
  } catch {
    // Keep logout functional when storage is unavailable.
  }
}
