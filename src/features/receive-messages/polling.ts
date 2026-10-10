import type { Dispatch } from '@reduxjs/toolkit'
import {
  greenClient,
  errorMessage,
  type Credentials,
} from '../../shared/api/green-api'
import { normalizeNotification } from '../../entities/message/normalize'
import { messagesActions } from '../../entities/message/model'
import { chatsActions } from '../../entities/chat/model'
import { sessionActions } from '../../entities/session/model'

function waitUnlessAborted(signal: AbortSignal, delay: number): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, delay)
    signal.addEventListener('abort', finish, { once: true })
  })
}

class NotificationPolling {
  private controller: AbortController | null = null
  private generation = 0

  get active() {
    return this.controller !== null
  }
  start(credentials: Credentials, dispatch: Dispatch) {
    if (this.active) return
    const controller = new AbortController()
    this.controller = controller
    const generation = ++this.generation
    dispatch(sessionActions.receiveChanged({ status: 'active' }))
    void this.loop(credentials, dispatch, controller, generation)
  }
  stop(dispatch: Dispatch) {
    this.generation++
    this.controller?.abort()
    this.controller = null
    dispatch(sessionActions.receiveChanged({ status: 'stopped' }))
  }
  private async loop(
    credentials: Credentials,
    dispatch: Dispatch,
    controller: AbortController,
    generation: number,
  ) {
    let failures = 0
    while (!controller.signal.aborted && generation === this.generation) {
      try {
        const notification = await greenClient.receive(
          credentials,
          controller.signal,
        )
        if (controller.signal.aborted || generation !== this.generation) break
        if (notification) {
          const event = normalizeNotification(notification.body)
          if (event.kind === 'message') {
            dispatch(messagesActions.received(event.message))
            dispatch(
              chatsActions.activity({
                chatId: event.message.chatId,
                text: event.message.text,
                timestamp: event.message.timestamp,
                messageId: event.message.serverId,
                direction: event.message.direction,
                status: event.message.status,
                name: event.chatName,
                promote: true,
              }),
            )
          } else if (event.kind === 'status') {
            dispatch(messagesActions.statusReceived(event))
            dispatch(
              chatsActions.messageStatus({
                chatId: event.chatId,
                messageId: event.serverId,
                status: event.status,
              }),
            )
          }
          const deleted = await greenClient.delete(
            credentials,
            notification.receiptId,
            controller.signal,
          )
          if (!deleted.result)
            throw new Error('Notification acknowledgement failed')
        }
        failures = 0
        dispatch(sessionActions.receiveChanged({ status: 'active' }))
        if (!notification) await waitUnlessAborted(controller.signal, 500)
      } catch (error: unknown) {
        if (controller.signal.aborted || generation !== this.generation) break
        failures++
        dispatch(
          sessionActions.receiveChanged({
            status: failures >= 5 ? 'error' : 'reconnecting',
            error: errorMessage(error),
          }),
        )
        await waitUnlessAborted(
          controller.signal,
          Math.min(30000, 1000 * 2 ** Math.min(failures - 1, 5)),
        )
      }
    }
    if (this.controller === controller) this.controller = null
  }
}
export const notificationPolling = new NotificationPolling()
