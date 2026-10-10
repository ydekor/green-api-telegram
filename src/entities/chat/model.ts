import {
  createEntityAdapter,
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import type { MessageStatus } from '../message/model'

export interface ChatActivity {
  chatId: string
  text: string
  timestamp: number
  messageId?: string
  direction?: 'incoming' | 'outgoing'
  status?: MessageStatus
}

export interface Chat {
  id: string
  name: string
  type: string
  phoneNumber?: string
  username?: string
  lastMessage?: string
  lastActivity?: number
  lastMessageId?: string
  lastMessageDirection?: 'incoming' | 'outgoing'
  lastMessageStatus?: MessageStatus
  order?: number
}
const adapter = createEntityAdapter<Chat>()
const initialState = adapter.getInitialState<{
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
}>({ status: 'idle', error: null })
const statusRank: Record<MessageStatus, number> = { failed: 0, pending: 1, sent: 2, delivered: 3, read: 4 }
function latestStatus(chat: Chat, messageId: string | undefined, status: MessageStatus | undefined) {
  return messageId && messageId === chat.lastMessageId && status && chat.lastMessageStatus && statusRank[chat.lastMessageStatus] > statusRank[status]
    ? chat.lastMessageStatus : status
}
function topOrder(state: typeof initialState) {
  return Math.min(0, ...Object.values(state.entities).map((chat) => chat.order ?? 0)) - 1
}
function bottomOrder(state: typeof initialState) {
  return Math.max(-1, ...Object.values(state.entities).map((chat) => chat.order ?? -1)) + 1
}
export const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    loading: (state) => {
      state.status = 'loading'
      state.error = null
    },
    loaded: (state, action: PayloadAction<Chat[]>) => {
      let nextOrder = bottomOrder(state)
      adapter.upsertMany(state, action.payload.map((chat) => ({
        ...chat,
        order: state.entities[chat.id]?.order ?? nextOrder++,
      })))
      state.status = 'ready'
      state.error = null
    },
    failed: (state, action: PayloadAction<string>) => {
      state.status = 'error'
      state.error = action.payload
    },
    upsert: (state, action: PayloadAction<Chat>) => {
      const existing = state.entities[action.payload.id]
      adapter.upsertOne(state, {
        ...action.payload,
        order: existing?.order ?? topOrder(state),
      })
    },
    activity: (
      state,
      action: PayloadAction<ChatActivity & { name?: string; promote?: boolean }>,
    ) => {
      const { chatId, text, timestamp, messageId, direction, status, name, promote = false } = action.payload
      const existing = state.entities[chatId]
      if (!existing)
        adapter.addOne(state, {
          id: chatId,
          name: name || chatId,
          type: 'user',
          lastMessage: text,
          lastActivity: timestamp,
          lastMessageId: messageId,
          lastMessageDirection: direction,
          lastMessageStatus: status,
          order: promote ? topOrder(state) : bottomOrder(state),
        })
      else if (!existing.lastActivity || timestamp >= existing.lastActivity)
        adapter.updateOne(state, {
          id: chatId,
          changes: {
            lastMessage: text,
            lastActivity: timestamp,
            lastMessageId: messageId ?? (timestamp === existing.lastActivity ? existing.lastMessageId : undefined),
            lastMessageDirection: direction ?? (timestamp === existing.lastActivity && !messageId ? existing.lastMessageDirection : undefined),
            lastMessageStatus: latestStatus(existing, messageId, status) ?? (timestamp === existing.lastActivity && !messageId ? existing.lastMessageStatus : undefined),
            ...(promote ? { order: topOrder(state) } : {}),
          },
        })
    },
    activities: (
      state,
      action: PayloadAction<ChatActivity[]>,
    ) => {
      for (const { chatId, text, timestamp, messageId, direction, status } of action.payload) {
        const existing = state.entities[chatId]
        if (existing && (!existing.lastActivity || timestamp >= existing.lastActivity))
          adapter.updateOne(state, {
            id: chatId,
            changes: {
              lastMessage: text,
              lastActivity: timestamp,
              lastMessageId: messageId,
              lastMessageDirection: direction,
              lastMessageStatus: latestStatus(existing, messageId, status),
            },
          })
      }
    },
    messageStatus: (
      state,
      action: PayloadAction<{ chatId: string; messageId: string; status: MessageStatus; serverId?: string }>,
    ) => {
      const chat = state.entities[action.payload.chatId]
      if (!chat || chat.lastMessageId !== action.payload.messageId || chat.lastMessageDirection !== 'outgoing') return
      if (action.payload.status !== 'failed' && chat.lastMessageStatus && statusRank[action.payload.status] < statusRank[chat.lastMessageStatus]) return
      adapter.updateOne(state, {
        id: chat.id,
        changes: {
          lastMessageStatus: action.payload.status,
          lastMessageId: action.payload.serverId ?? chat.lastMessageId,
        },
      })
    },
    cleared: () => initialState,
  },
})
export const chatsActions = chatsSlice.actions
interface ChatsRoot {
  chats: ReturnType<typeof chatsSlice.reducer>
}
const selectors = adapter.getSelectors<ChatsRoot>((state) => state.chats)
export const selectChatById = selectors.selectById
export const selectSortedChats = createSelector(selectors.selectAll, (chats) =>
  [...chats].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name, 'ru'),
  ),
)
