import { z } from 'zod'
import type { Credentials } from './contracts'

export type ApiErrorKind =
  | 'auth'
  | 'rate'
  | 'timeout'
  | 'network'
  | 'validation'
  | 'unavailable'
  | 'unexpected'
export class ApiError extends Error {
  kind: ApiErrorKind
  status?: number
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export async function request<T>(
  credentials: Credentials,
  method: string,
  httpMethod: 'GET' | 'POST' | 'DELETE',
  schema: z.ZodType<T>,
  options: {
    body?: unknown
    signal?: AbortSignal
    receiptId?: number
    mediaUrl?: string
  } = {},
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    method === 'receiveNotification'
      ? 14000
      : method === 'sendFileByUpload'
        ? 90000
        : 24000,
  )
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal
  try {
    const path = `${method}${options.receiptId === undefined ? '' : `/${options.receiptId}`}`
    const url = new URL(`/api/green/${path}`, window.location.href)
    const response = await fetch(url, {
      method: httpMethod,
      signal,
      cache: 'no-store',
      headers: {
        ...(options.body === undefined || options.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        'x-green-url': credentials.apiUrl,
        'x-green-id': credentials.idInstance,
        'x-green-token': credentials.apiTokenInstance,
        ...(options.mediaUrl ? { 'x-green-media-url': options.mediaUrl } : {}),
      },
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new ApiError(
          'auth',
          'Проверьте ID инстанса и API-токен.',
          response.status,
        )
      if (response.status === 466)
        throw new ApiError(
          'rate',
          'Достигнут лимит чатов тарифа GREEN-API Developer.',
          response.status,
        )
      if (response.status === 429)
        throw new ApiError(
          'rate',
          'Слишком много запросов. Повторите позже.',
          response.status,
        )
      if (response.status === 504)
        throw new ApiError(
          'timeout',
          'GREEN-API не ответил вовремя.',
          response.status,
        )
      if (response.status >= 500)
        throw new ApiError(
          'unavailable',
          'GREEN-API временно недоступен.',
          response.status,
        )
      if (method === 'receiveNotification' && response.status === 400)
        throw new ApiError(
          'validation',
          'Проверьте настройки HTTP-уведомлений: webhookUrl должен быть пустым.',
          response.status,
        )
      if (
        method === 'getContactInfo' &&
        (response.status === 400 || response.status === 404)
      )
        throw new ApiError(
          'validation',
          'Дополнительные сведения для этого контакта недоступны.',
          response.status,
        )
      throw new ApiError(
        'validation',
        'GREEN-API отклонил запрос. Проверьте введённые данные и настройки инстанса.',
        response.status,
      )
    }
    const responseText = await response.text()
    let raw: unknown = null
    if (responseText.trim()) {
      try {
        raw = JSON.parse(responseText) as unknown
      } catch {
        throw new ApiError(
          'unexpected',
          'GREEN-API вернул ответ не в формате JSON.',
        )
      }
    }
    if (
      raw &&
      typeof raw === 'object' &&
      'code' in raw &&
      (raw.code === 401 || raw.code === 403)
    )
      throw new ApiError(
        'auth',
        'Проверьте ID инстанса и API-токен.',
        Number(raw.code),
      )
    const parsed = schema.safeParse(raw)
    if (!parsed.success)
      throw new ApiError(
        'unexpected',
        'GREEN-API вернул неожиданный формат ответа.',
      )
    return parsed.data
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new ApiError(
        'timeout',
        'Запрос прерван или истекло время ожидания.',
      )
    throw new ApiError(
      'network',
      'Нет связи с GREEN-API. Проверьте сеть и локальный API-сервер.',
    )
  } finally {
    clearTimeout(timeout)
  }
}

export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Произошла непредвиденная ошибка.'
