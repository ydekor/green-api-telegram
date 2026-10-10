import type { Credentials } from '../api/green-api'

const prefix = 'greenchat-avatar-v1:'
const lifetime = 24 * 60 * 60 * 1000
const key = (credentials: Credentials, chatId: string) =>
  `${prefix}${credentials.idInstance}:${chatId}`

export function readAvatar(
  credentials: Credentials,
  chatId: string,
): string | null {
  try {
    const value = localStorage.getItem(key(credentials, chatId))
    if (!value) return null
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'url' in parsed &&
      'expires' in parsed &&
      typeof parsed.url === 'string' &&
      (parsed.url === '' || parsed.url.startsWith('https://')) &&
      typeof parsed.expires === 'number' &&
      parsed.expires > Date.now()
    )
      return parsed.url
    localStorage.removeItem(key(credentials, chatId))
  } catch {
    // Fall back to the API if storage is unavailable or corrupted.
  }
  return null
}

export function saveAvatar(
  credentials: Credentials,
  chatId: string,
  url: string,
  ttl = lifetime,
) {
  try {
    localStorage.setItem(
      key(credentials, chatId),
      JSON.stringify({ url, expires: Date.now() + ttl }),
    )
  } catch {
    // An avatar is optional.
  }
}

export function clearAvatars() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const entry = localStorage.key(index)
      if (entry?.startsWith(prefix)) localStorage.removeItem(entry)
    }
  } catch {
    // Logout must still complete if storage is unavailable.
  }
}
