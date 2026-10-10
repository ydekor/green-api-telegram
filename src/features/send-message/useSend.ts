import { useCallback, useRef } from 'react'
import { useStore } from 'react-redux'
import { useSendMessageMutation } from '../../shared/api/green-api/rtk'
import { useAppDispatch, useAppSelector, type RootState } from '../../app/store'
import { messagesActions, type Message } from '../../entities/message/model'
import { chatsActions } from '../../entities/chat/model'

export function useSend() {
  const dispatch = useAppDispatch()
  const store = useStore<RootState>()
  const instanceId = useAppSelector(
    (state) => state.session.credentials?.idInstance,
  )
  const [sendMutation, result] = useSendMessageMutation()
  const busy = useRef(false)
  const send = useCallback(
    async (chatId: string, value: string, retry?: Message) => {
      const text = value.trim()
      if (!text || text.length > 4096 || busy.current) return false
      busy.current = true
      const clientId = retry?.clientId ?? crypto.randomUUID()
      const timestamp = retry?.timestamp ?? Math.floor(Date.now() / 1000)
      if (retry) dispatch(messagesActions.retrying(retry.id))
      else
        dispatch(
          messagesActions.optimistic({
            id: `local:${clientId}`,
            clientId,
            chatId,
            text,
            direction: 'outgoing',
            timestamp,
            status: 'pending',
          }),
        )
      dispatch(chatsActions.activity({
        chatId, text, timestamp, messageId: `local:${clientId}`,
        direction: 'outgoing', status: 'pending', promote: true,
      }))
      try {
        const promise = sendMutation({ chatId, message: text })
        const response = await promise.unwrap()
        if (store.getState().session.credentials?.idInstance === instanceId) {
          dispatch(messagesActions.sendConfirmed({ clientId, serverId: response.idMessage }))
          dispatch(chatsActions.messageStatus({
            chatId, messageId: `local:${clientId}`, serverId: response.idMessage, status: 'sent',
          }))
        }
        return true
      } catch {
        if (store.getState().session.credentials?.idInstance === instanceId) {
          dispatch(messagesActions.sendFailed({
            clientId,
            error: 'Не отправлено. Нажмите «Повторить».',
          }))
          dispatch(chatsActions.messageStatus({ chatId, messageId: `local:${clientId}`, status: 'failed' }))
        }
        return false
      } finally {
        busy.current = false
      }
    },
    [dispatch, instanceId, sendMutation, store],
  )
  return { send, isSending: result.isLoading }
}
