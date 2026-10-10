import {
  createEntityAdapter,
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export interface Message {
  id: string
  chatId: string
  text: string
  direction: 'incoming' | 'outgoing'
  timestamp: number
  status: MessageStatus
  serverId?: string
  clientId?: string
  error?: string
  kind?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'reaction'
  mediaUrl?: string
  fileName?: string
  mimeType?: string
  reactionTo?: string
  reactions?: string[]
}
const adapter = createEntityAdapter<Message>()
const initialState = adapter.getInitialState()
const rank: Record<MessageStatus, number> = {
  failed: 0,
  pending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
}
function merge(state: typeof initialState, message: Message) {
  const existing = state.entities[message.id]
  if (!existing) {
    adapter.addOne(state, message)
    return
  }
  adapter.upsertOne(state, {
    ...existing,
    ...message,
    status:
      rank[existing.status] > rank[message.status]
        ? existing.status
        : message.status,
  })
}
export const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    optimistic: (state, action: PayloadAction<Message>) => {
      adapter.addOne(state, action.payload)
    },
    removed: (state, action: PayloadAction<string>) => {
      adapter.removeOne(state, action.payload)
    },
    received: (state, action: PayloadAction<Message>) => {
      merge(state, action.payload)
    },
    historyReceived: (state, action: PayloadAction<Message[]>) => {
      action.payload.forEach((item) => merge(state, item))
    },
    sendConfirmed: (
      state,
      action: PayloadAction<{ clientId: string; serverId: string }>,
    ) => {
      const local = state.entities[`local:${action.payload.clientId}`]
      if (!local) return
      adapter.removeOne(state, local.id)
      merge(state, {
        ...local,
        id: `${local.chatId}:${action.payload.serverId}`,
        serverId: action.payload.serverId,
        status: 'sent',
        error: undefined,
      })
    },
    sendFailed: (
      state,
      action: PayloadAction<{ clientId: string; error: string }>,
    ) => {
      adapter.updateOne(state, {
        id: `local:${action.payload.clientId}`,
        changes: { status: 'failed', error: action.payload.error },
      })
    },
    retrying: (state, action: PayloadAction<string>) => {
      adapter.updateOne(state, {
        id: action.payload,
        changes: { status: 'pending', error: undefined },
      })
    },
    statusReceived: (
      state,
      action: PayloadAction<{
        chatId: string
        serverId: string
        status: MessageStatus
      }>,
    ) => {
      const id = `${action.payload.chatId}:${action.payload.serverId}`
      const existing = state.entities[id]
      if (
        existing &&
        (rank[action.payload.status] > rank[existing.status] ||
          action.payload.status === 'failed')
      )
        adapter.updateOne(state, {
          id,
          changes: { status: action.payload.status },
        })
    },
    cleared: () => initialState,
  },
})
export const messagesActions = messagesSlice.actions
interface MessagesRoot {
  messages: ReturnType<typeof messagesSlice.reducer>
}
const selectors = adapter.getSelectors<MessagesRoot>((state) => state.messages)
export const selectMessagesForChat = createSelector(
  [selectors.selectAll, (_state: MessagesRoot, chatId: string) => chatId],
  (messages, chatId) => {
    const inChat = messages.filter((message) => message.chatId === chatId)
    const byServerId = new Map(inChat.filter((message) => message.serverId).map((message) => [message.serverId, message]))
    const reactions = new Map<string, string[]>()
    for (const message of inChat) {
      if (message.kind !== 'reaction' || !message.reactionTo || !byServerId.has(message.reactionTo)) continue
      reactions.set(message.reactionTo, [...(reactions.get(message.reactionTo) ?? []), message.text])
    }
    return inChat
      .filter((message) => message.kind !== 'reaction' || !message.reactionTo || !byServerId.has(message.reactionTo))
      .map((message) => ({ ...message, reactions: message.serverId ? reactions.get(message.serverId) : undefined }))
      .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
  },
)
