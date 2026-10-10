import { useEffect, useState, type CSSProperties, type PointerEvent } from 'react'
import { useParams } from 'react-router-dom'
import { MessageCircleMore } from 'lucide-react'
import { ChatSidebar } from '../../widgets/chat-sidebar/ChatSidebar'
import { Conversation } from '../../widgets/conversation/Conversation'
import { useAppDispatch, useAppSelector } from '../../app/store'
import { notificationPolling } from '../../features/receive-messages/polling'
import { chatsSlice, selectChatById } from '../../entities/chat/model'
import styles from './chats.module.css'

export function ChatsPage() {
  const dispatch = useAppDispatch()
  const credentials = useAppSelector((state) => state.session.credentials)
  const { chatId } = useParams()
  const chat = useAppSelector(
    (state: { chats: ReturnType<typeof chatsSlice.reducer> }) =>
      selectChatById(state, chatId || ''),
  )
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('greenchat-theme') === 'dark' ? 'dark' : 'light',
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('greenchat-sidebar-width'))
    return Number.isFinite(saved) && saved >= 300 && saved <= 600 ? saved : 390
  })
  const clampWidth = (value: number) =>
    Math.max(300, Math.min(560, Math.floor(window.innerWidth * 0.55), value))
  const resizeStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const move = (next: globalThis.PointerEvent) => setSidebarWidth(clampWidth(next.clientX))
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }
  useEffect(() => {
    localStorage.setItem('greenchat-sidebar-width', String(sidebarWidth))
  }, [sidebarWidth])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('greenchat-theme', theme)
  }, [theme])
  useEffect(() => {
    if (!credentials) return
    const start = window.setTimeout(
      () => notificationPolling.start(credentials, dispatch),
      0,
    )
    return () => {
      clearTimeout(start)
      notificationPolling.stop(dispatch)
    }
  }, [credentials, dispatch])
  return (
    <main
      className={`${styles.layout} ${chatId ? styles.chatOpen : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <ChatSidebar
        activeId={chatId}
        theme={theme}
        onThemeChange={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      />
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину списка чатов"
        aria-valuemin={300}
        aria-valuemax={560}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={resizeStart}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault()
            setSidebarWidth((width) => clampWidth(width + (event.key === 'ArrowRight' ? 24 : -24)))
          }
        }}
      />
      <div className={styles.main}>
        {chatId ? (
          <Conversation
            key={chatId}
            chat={chat ?? { id: chatId, name: chatId, type: 'user' }}
          />
        ) : (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>
              <MessageCircleMore size={34} />
            </div>
            <h2>Ваши разговоры здесь</h2>
            <p>
              Выберите чат слева или начните новую беседу.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
