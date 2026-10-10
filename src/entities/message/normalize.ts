import type { Message } from './model'
import {
  historyItemSchema,
  notificationSchema,
} from '../../shared/api/green-api/contracts'
import { z } from 'zod'

type HistoryItem = z.infer<typeof historyItemSchema>
type Notification = z.infer<typeof notificationSchema>
const mediaKinds = {
  imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio',
  documentMessage: 'document', stickerMessage: 'sticker', reactionMessage: 'reaction',
} as const
const mediaLabels = {
  image: 'Фото', video: 'Видео', audio: 'Аудио', document: 'Документ',
  sticker: 'Стикер', reaction: 'Реакция',
} as const
function messageKind(type: string): NonNullable<Message['kind']> {
  return Object.prototype.hasOwnProperty.call(mediaKinds, type)
    ? mediaKinds[type as keyof typeof mediaKinds] : 'text'
}
function safeMediaUrl(value?: string) {
  if (!value) return undefined
  try { return new URL(value).protocol === 'https:' ? value : undefined }
  catch { return undefined }
}
export function normalizeHistory(item: HistoryItem): Message | null {
  const kind = messageKind(item.typeMessage)
  if (kind === 'text' && item.typeMessage !== 'textMessage') return null
  const text = kind === 'text' ? item.textMessage : kind === 'reaction'
    ? item.extendedTextMessageData?.text : item.caption || mediaLabels[kind]
  if (!text) return null
  return {
    id: `${item.chatId}:${item.idMessage}`,
    chatId: item.chatId,
    text,
    kind,
    mediaUrl: safeMediaUrl(item.downloadUrl),
    fileName: item.fileName,
    mimeType: item.mimeType,
    reactionTo: item.quotedMessage?.stanzaId,
    direction: item.type,
    timestamp: item.timestamp,
    serverId: item.idMessage,
    status:
      item.type === 'incoming'
        ? 'read'
        : item.statusMessage === 'read'
          ? 'read'
          : item.statusMessage === 'delivered'
            ? 'delivered'
            : 'sent',
  }
}
export type NormalizedEvent =
  | { kind: 'message'; message: Message; chatName?: string }
  | {
      kind: 'status'
      chatId: string
      serverId: string
      status: 'delivered' | 'read' | 'failed'
    }
  | { kind: 'ignored' }
export function normalizeNotification(
  body: Notification['body'],
): NormalizedEvent {
  if (body.typeWebhook === 'outgoingMessageStatus') {
    if (
      body.chatId &&
      body.idMessage &&
      (body.status === 'delivered' ||
        body.status === 'read' ||
        body.status === 'failed')
    )
      return {
        kind: 'status',
        chatId: body.chatId,
        serverId: body.idMessage,
        status: body.status,
      }
    return { kind: 'ignored' }
  }
  if (
    body.typeWebhook !== 'incomingMessageReceived' &&
    body.typeWebhook !== 'outgoingMessageReceived' &&
    body.typeWebhook !== 'outgoingAPIMessageReceived'
  )
    return { kind: 'ignored' }
  const data = body.messageData
  if (!data) return { kind: 'ignored' }
  const kind = messageKind(data.typeMessage)
  if (kind === 'text' && data.typeMessage !== 'textMessage') return { kind: 'ignored' }
  if (
    !body.senderData?.chatId ||
    !body.idMessage ||
    !body.timestamp ||
    (kind === 'text' && !data.textMessageData)
  )
    throw new Error('Malformed message notification')
  const media = kind === 'sticker' ? data.stickerMessageData : data.fileMessageData
  const text = kind === 'text' ? data.textMessageData?.textMessage : kind === 'reaction'
    ? data.extendedTextMessageData?.text : data.fileMessageData?.caption || mediaLabels[kind]
  if (!text) return { kind: 'ignored' }
  const chatId = body.senderData.chatId
  const direction =
    body.typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing'
  return {
    kind: 'message',
    chatName: body.senderData.chatName,
    message: {
      id: `${chatId}:${body.idMessage}`,
      chatId,
      text,
      kind,
      mediaUrl: safeMediaUrl(media?.downloadUrl),
      fileName: media?.fileName,
      mimeType: media?.mimeType,
      reactionTo: data.quotedMessage?.stanzaId,
      direction,
      timestamp: body.timestamp,
      status: direction === 'incoming' ? 'read' : 'sent',
      serverId: body.idMessage,
    },
  }
}
