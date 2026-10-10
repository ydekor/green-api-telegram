import { z } from 'zod'
import { request } from './client'
import {
  accountSchema,
  accountSettingsSchema,
  avatarSchema,
  chatSchema,
  deleteResponseSchema,
  historyItemSchema,
  journalSchema,
  contactInfoSchema,
  notificationSchema,
  sendResponseSchema,
  sendFileResponseSchema,
  stateSchema,
  type Credentials,
} from './contracts'

export { ApiError, errorMessage } from './client'
export { credentialsSchema, normalizePhone } from './contracts'
export type { Credentials } from './contracts'

let nextAvatarRequest = 0
let nextHistoryRequest = 0
async function waitForAvatarSlot(signal?: AbortSignal) {
  const startsAt = Math.max(Date.now(), nextAvatarRequest)
  nextAvatarRequest = startsAt + 350 // Keep avatar requests below three per second.
  const delay = startsAt - Date.now()
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}
async function waitForHistorySlot(signal?: AbortSignal) {
  const startsAt = Math.max(Date.now(), nextHistoryRequest)
  nextHistoryRequest = startsAt + 1100
  const delay = startsAt - Date.now()
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export const greenClient = {
  state: (c: Credentials, signal?: AbortSignal) =>
    request(c, 'getStateInstance', 'GET', stateSchema, { signal }),
  chats: (c: Credentials, signal?: AbortSignal) =>
    request(c, 'getChats', 'GET', z.array(chatSchema), { signal }),
  accountSettings: (c: Credentials, signal?: AbortSignal) =>
    request(c, 'getAccountSettings', 'GET', accountSettingsSchema, { signal }),
  incomingJournal: (c: Credentials, signal?: AbortSignal) =>
    request(c, 'lastIncomingMessages', 'GET', journalSchema, { signal }),
  outgoingJournal: (c: Credentials, signal?: AbortSignal) =>
    request(c, 'lastOutgoingMessages', 'GET', journalSchema, { signal }),
  contactInfo: (c: Credentials, chatId: string, signal?: AbortSignal) =>
    request(c, 'getContactInfo', 'POST', contactInfoSchema, {
      body: { chatId }, signal,
    }),
  avatar: async (c: Credentials, chatId: string, signal?: AbortSignal) => {
    await waitForAvatarSlot(signal)
    return request(c, 'getAvatar', 'POST', avatarSchema, {
      body: { chatId },
      signal,
    })
  },
  history: async (c: Credentials, chatId: string, signal?: AbortSignal, count = 50) => {
    await waitForHistorySlot(signal)
    return request(c, 'getChatHistory', 'POST', z.array(historyItemSchema), {
      body: { chatId, count }, signal,
    })
  },
  check: (c: Credentials, phone: string, signal?: AbortSignal) =>
    request(c, 'checkAccount', 'POST', accountSchema, {
      body: { phoneNumber: Number(phone) },
      signal,
    }),
  send: (
    c: Credentials,
    chatId: string,
    message: string,
    signal?: AbortSignal,
  ) =>
    request(c, 'sendMessage', 'POST', sendResponseSchema, {
      body: { chatId, message },
      signal,
    }),
  sendFile: (c: Credentials, chatId: string, file: File, caption: string, signal?: AbortSignal) => {
    const body = new FormData()
    body.append('chatId', chatId)
    body.append('file', file, file.name)
    body.append('fileName', file.name)
    if (caption) body.append('caption', caption)
    return request(c, 'sendFileByUpload', 'POST', sendFileResponseSchema, {
      body, signal, mediaUrl: c.mediaUrl || 'https://media.green-api.com/',
    })
  },
  receive: (c: Credentials, signal?: AbortSignal) =>
    request(c, 'receiveNotification', 'GET', notificationSchema.nullable(), {
      signal,
    }),
  delete: (c: Credentials, receiptId: number, signal?: AbortSignal) =>
    request(c, 'deleteNotification', 'DELETE', deleteResponseSchema, {
      receiptId,
      signal,
    }),
}
