import { z } from 'zod'

export const credentialsSchema = z.object({
  apiUrl: z.url({ message: 'Укажите корректный HTTPS URL' }).refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'api.green-api.com' ||
        /^[a-z0-9-]+\.api\.green-api\.com$/.test(url.hostname)) &&
      !url.port &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    )
  }, 'Укажите API-хост GREEN-API из кабинета'),
  idInstance: z
    .string()
    .regex(/^\d{6,15}$/, 'ID должен содержать от 6 до 15 цифр'),
  apiTokenInstance: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,256}$/, 'Проверьте API-токен'),
  mediaUrl: z.string().optional().refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return url.protocol === 'https:' &&
        (url.hostname === 'media.green-api.com' || /^[a-z0-9-]+\.media\.green-api\.com$/.test(url.hostname)) &&
        !url.port && url.pathname === '/' && !url.search && !url.hash
    } catch { return false }
  }, 'Укажите Media URL GREEN-API из кабинета'),
})
export type Credentials = z.infer<typeof credentialsSchema>

export const stateSchema = z.object({
  stateInstance: z.enum([
    'authorized',
    'notAuthorized',
    'blocked',
    'suspended',
    'starting',
    'pendingPassword',
  ]),
})
export const accountSchema = z.object({
  exist: z.boolean(),
  chatId: z.string(),
  username: z.string().optional(),
  phoneNumber: z.number().optional(),
  fromCache: z.boolean().optional(),
})
export const chatSchema = z.object({
  chatId: z.string(),
  name: z.string(),
  type: z.string(),
  phoneNumber: z.number().optional(),
  username: z.string().optional(),
})
export const avatarSchema = z.object({
  urlAvatar: z
    .string()
    .refine(
      (value) => value === '' || value.startsWith('https://'),
      'Некорректная ссылка на аватар',
    ),
})
export const accountSettingsSchema = z.object({
  avatar: z.string().optional(),
  phone: z.string().optional(),
  chatId: z.string().optional(),
  username: z.string().optional(),
  historySyncProgress: z.number().optional(),
})
export const contactInfoSchema = z.object({
  avatar: z.string().optional(),
  name: z.string().optional(),
  contactName: z.string().optional(),
  chatId: z.string(),
  chatType: z.string().optional(),
  lastSeen: z.number().nullable().optional(),
  phoneNumber: z.number().optional(),
  username: z.string().optional(),
  description: z.string().optional(),
  isPremium: z.boolean().optional(),
  isVerified: z.boolean().optional(),
})
export const historyItemSchema = z.object({
  type: z.enum(['incoming', 'outgoing']),
  idMessage: z.string(),
  timestamp: z.number(),
  chatId: z.string(),
  typeMessage: z.string(),
  textMessage: z.string().optional(),
  caption: z.string().optional(),
  downloadUrl: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  extendedTextMessageData: z.object({ text: z.string() }).optional(),
  quotedMessage: z.object({ stanzaId: z.string() }).optional(),
  statusMessage: z.string().optional(),
  senderName: z.string().optional(),
})
export const journalSchema = z.array(historyItemSchema)
export const notificationSchema = z.object({
  receiptId: z.number(),
  body: z
    .object({
      typeWebhook: z.string(),
      timestamp: z.number().optional(),
      idMessage: z.string().optional(),
      chatId: z.string().optional(),
      status: z.string().optional(),
      senderData: z
        .object({ chatId: z.string(), chatName: z.string().optional() })
        .optional(),
      messageData: z
        .object({
          typeMessage: z.string(),
          textMessageData: z.object({ textMessage: z.string() }).optional(),
          fileMessageData: z.object({
            downloadUrl: z.string().optional(),
            caption: z.string().optional(),
            fileName: z.string().optional(),
            mimeType: z.string().optional(),
          }).optional(),
          stickerMessageData: z.object({
            downloadUrl: z.string().optional(),
            fileName: z.string().optional(),
            mimeType: z.string().optional(),
          }).optional(),
          extendedTextMessageData: z.object({ text: z.string() }).optional(),
          quotedMessage: z.object({ stanzaId: z.string() }).optional(),
        })
        .optional(),
    })
    .passthrough(),
})
export const sendResponseSchema = z.object({ idMessage: z.string() })
export const sendFileResponseSchema = sendResponseSchema.extend({
  urlFile: z.string().url().refine((value) => value.startsWith('https://')).optional(),
})
export const deleteResponseSchema = z.object({
  result: z.boolean(),
  reason: z.string().optional(),
})

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/[\s()+-]/g, '')
  return /^\d{7,15}$/.test(digits) && digits[0] !== '0' ? digits : null
}
