import { useCallback, useEffect, useState, useRef } from 'react'
import {
  LogOut,
  MessageSquarePlus,
  Moon,
  Search,
  Sun,
  Menu,
  X,
  UserRound,
  Check,
  CheckCheck,
  Clock3,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../shared/lib/redux'
import { chatsActions, selectSortedChats, type ChatActivity } from '../../entities/chat/model'
import { messagesActions } from '../../entities/message/model'
import { sessionActions, sessionSlice } from '../../entities/session/model'
import { useGetChatsQuery, useGetRecentActivityQuery, useGetAccountSettingsQuery, greenApi } from '../../shared/api/green-api/rtk'
import { ApiError, greenClient } from '../../shared/api/green-api'
import { notificationPolling } from '../../features/receive-messages/polling'
import { CreateChatModal } from '../../features/create-chat/CreateChatModal'
import { Avatar, Button, IconButton, Input, Spinner } from '../../shared/ui'
import { formatChatTime } from '../../shared/lib/time'
import { forgetConnection } from '../../shared/lib/saved-connection'
import { clearAvatars } from '../../shared/lib/avatar-cache'
import { ChatAvatar } from './ChatAvatar'
import styles from './sidebar.module.css'

export function ChatSidebar({
  activeId,
  theme,
  onThemeChange,
}: {
  activeId?: string
  theme: 'light' | 'dark'
  onThemeChange: () => void
}) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const chats = useAppSelector(selectSortedChats)
  const session = useAppSelector(
    (state: { session: ReturnType<typeof sessionSlice.reducer> }) =>
      state.session,
  )
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [menuState, setMenuState] = useState<'closed' | 'open' | 'closing'>('closed')
  const [selfOpen, setSelfOpen] = useState(false)
  const [previewState, setPreviewState] = useState<Record<string, 'done' | 'error'>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewQuotaBlocked, setPreviewQuotaBlocked] = useState(false)
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set())
  const listRef = useRef<HTMLDivElement>(null)
  const attempted = useRef(new Set<string>())
  const activeIdRef = useRef(activeId)
  const retryCount = useRef(0)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  const closeMenu = useCallback(() => setMenuState('closing'), [])
  const closeModal = useCallback(() => setModalOpen(false), [])
  const { data: account } = useGetAccountSettingsQuery()
  const recent = useGetRecentActivityQuery(undefined, {
    pollingInterval: 120000,
    skipPollingIfUnfocused: true,
  })
  const {
    data: remoteChats,
    isFetching,
    isError,
    refetch,
  } = useGetChatsQuery(undefined, {
    pollingInterval: 60000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })
  useEffect(() => {
    if (!isError) retryCount.current = 0
    if (!isError || isFetching) return
    const delay = Math.min(5000 * 2 ** retryCount.current, 60000)
    retryCount.current += 1
    const timer = window.setTimeout(() => { void refetch() }, delay)
    return () => window.clearTimeout(timer)
  }, [isError, isFetching, refetch])
  useEffect(() => {
    if (!remoteChats) return
    dispatch(
      chatsActions.loaded(
        remoteChats.map((chat) => ({
          id: chat.chatId,
          name: chat.name || chat.chatId,
          type: chat.type,
          phoneNumber: chat.phoneNumber ? String(chat.phoneNumber) : undefined,
          username: chat.username,
        })),
      ),
    )
  }, [dispatch, remoteChats])
  useEffect(() => {
    if (!recent.data) return
    const latest = new Map<string, ChatActivity>()
    for (const item of recent.data) {
      const text = item.textMessage || item.caption || ({ imageMessage: 'Фото', videoMessage: 'Видео', audioMessage: 'Аудио', documentMessage: 'Документ', pollMessage: 'Опрос', locationMessage: 'Геолокация' } as Record<string, string>)[item.typeMessage] || 'Сообщение'
      const previous = latest.get(item.chatId)
      if (!previous || item.timestamp > previous.timestamp)
        latest.set(item.chatId, {
          chatId: item.chatId, text, timestamp: item.timestamp,
          messageId: item.idMessage,
          direction: item.type,
          status: item.type === 'outgoing'
            ? item.statusMessage === 'read' ? 'read' : item.statusMessage === 'delivered' ? 'delivered' : 'sent'
            : 'read',
        })
    }
    dispatch(chatsActions.activities([...latest.values()]))
  }, [dispatch, recent.data])
  useEffect(() => {
    if (!remoteChats || !session.credentials || previewQuotaBlocked || (!recent.data && !recent.isError)) return
    let cancelled = false
    const recentIds = new Set(recent.data?.map((item) => item.chatId) ?? [])
    const credentials = session.credentials
    const pendingChats = remoteChats.filter((chat) =>
      visibleIds.has(chat.chatId) && chat.chatId !== activeIdRef.current &&
      !recentIds.has(chat.chatId) && !attempted.current.has(chat.chatId))
    if (!pendingChats.length) {
      setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    void (async () => {
      for (const chat of pendingChats) {
        if (cancelled) break
        attempted.current.add(chat.chatId)
        try {
          const items = await greenClient.history(credentials, chat.chatId, undefined, 1)
          if (cancelled) {
            attempted.current.delete(chat.chatId)
            break
          }
          const item = items[0]
          if (item) {
            const text = item.textMessage || item.caption || ({ imageMessage: 'Фото', videoMessage: 'Видео', audioMessage: 'Аудио', documentMessage: 'Документ' } as Record<string, string>)[item.typeMessage] || 'Сообщение'
            dispatch(chatsActions.activity({
              chatId: chat.chatId, text, timestamp: item.timestamp,
              messageId: item.idMessage,
              direction: item.type,
              status: item.type === 'outgoing'
                ? item.statusMessage === 'read' ? 'read' : item.statusMessage === 'delivered' ? 'delivered' : 'sent'
                : 'read',
            }))
          }
          setPreviewState((state) => ({ ...state, [chat.chatId]: 'done' }))
        } catch (error) {
          if (cancelled) {
            attempted.current.delete(chat.chatId)
            break
          }
          attempted.current.delete(chat.chatId)
          setPreviewState((state) => ({ ...state, [chat.chatId]: 'error' }))
          if (error instanceof ApiError && error.status === 466) setPreviewQuotaBlocked(true)
          break // A failed upstream should not trigger a request for every chat.
        }
      }
      if (!cancelled) setPreviewLoading(false)
    })()
    return () => { cancelled = true; setPreviewLoading(false) }
  }, [dispatch, recent.data, recent.isError, remoteChats, session.credentials, visibleIds, previewQuotaBlocked])
  useEffect(() => {
    if (menuState !== 'open') return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenu() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuState, closeMenu])
  useEffect(() => {
    if (menuState !== 'closing') return
    const timer = window.setTimeout(() => setMenuState('closed'), 230)
    return () => window.clearTimeout(timer)
  }, [menuState])
  const filtered = chats.filter((chat) =>
    `${chat.name} ${chat.phoneNumber ?? ''} ${chat.username ?? ''}`
      .toLocaleLowerCase('ru')
      .includes(search.toLocaleLowerCase('ru')),
  )
  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-chat-id]')
    if (!rows?.length) return
    if (!('IntersectionObserver' in window)) {
      setVisibleIds((current) => new Set([...current, ...Array.from(rows).slice(0, 12).map((row) => row.dataset.chatId!).filter(Boolean)]))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      const ids = entries.filter((entry) => entry.isIntersecting).map((entry) => (entry.target as HTMLElement).dataset.chatId).filter((id): id is string => Boolean(id))
      if (ids.length) setVisibleIds((current) => {
        if (ids.every((id) => current.has(id))) return current
        return new Set([...current, ...ids])
      })
    }, { root: listRef.current, rootMargin: '80px' })
    rows.forEach((row) => observer.observe(row))
    return () => observer.disconnect()
  }, [chats.length, remoteChats, search])
  const logout = () => {
    notificationPolling.stop(dispatch)
    forgetConnection()
    clearAvatars()
    dispatch(greenApi.util.resetApiState())
    dispatch(messagesActions.cleared())
    dispatch(chatsActions.cleared())
    dispatch(sessionActions.disconnected())
    navigate('/connect', { replace: true })
  }
  return (
    <aside className={styles.sidebar} aria-label="Список чатов">
      <div className={styles.brand}>
        <IconButton
          aria-label="Открыть меню"
          aria-expanded={menuState === 'open'}
          onClick={() => setMenuState('open')}
        >
          <Menu size={23} />
        </IconButton>
        <div className={styles.search}>
          <Search size={18} />
          <Input
            aria-label="Поиск чатов"
            placeholder="Поиск по чатам"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className={styles.controls}>
        <Button onClick={() => setModalOpen(true)} className={styles.newChat}>
          <MessageSquarePlus size={18} /> Новый чат
        </Button>
      </div>
      <div className={styles.list} ref={listRef}>
        {(isFetching || isError) && chats.length === 0 && (
          <div aria-label="Загружаем чаты">
            {Array.from({ length: 8 }, (_, index) => (
              <div className={styles.chatSkeleton} key={index} aria-hidden="true">
                <span className={styles.skeletonAvatar} />
                <span className={styles.skeletonBody}>
                  <span className={styles.skeletonName} />
                  <span className={styles.skeletonPreview} />
                </span>
              </div>
            ))}
          </div>
        )}
        {filtered.map((chat, index) => (
          <button
            key={chat.id}
            data-chat-id={chat.id}
            className={`${styles.chat} ${activeId === chat.id ? styles.active : ''}`}
            onClick={() => navigate(`/chats/${encodeURIComponent(chat.id)}`)}
          >
            <ChatAvatar
              chatId={chat.id}
              name={chat.name}
              fallbackLoad={index < 10}
            />
            <span className={styles.chatBody}>
              <span className={styles.chatLine}>
                <strong>{chat.name}</strong>
                <span className={styles.chatMeta}>
                  {chat.lastMessageDirection === 'outgoing' && chat.lastMessageStatus && (
                    chat.lastMessageStatus === 'pending' ? <Clock3 size={14} aria-label="Отправляется" className={styles.statusPending} />
                      : chat.lastMessageStatus === 'failed' ? <X size={14} aria-label="Не отправлено" className={styles.statusFailed} />
                        : chat.lastMessageStatus === 'sent' ? <Check size={15} aria-label="Отправлено" className={styles.statusSent} />
                          : <CheckCheck size={16} aria-label={chat.lastMessageStatus === 'read' ? 'Прочитано' : 'Доставлено'} className={chat.lastMessageStatus === 'read' ? styles.statusRead : styles.statusSent} />
                  )}
                  <time>{chat.lastActivity ? formatChatTime(chat.lastActivity) : ''}</time>
                </span>
              </span>
              <span className={styles.preview}>
                {chat.lastMessage || (previewState[chat.id] === 'done'
                  ? 'Нет сообщений'
                  : previewQuotaBlocked ? null
                    : <span className={styles.skeletonPreview} aria-label="Загружаем последнее сообщение" />)}
              </span>
            </span>
          </button>
        ))}
        {!isFetching && !isError && remoteChats && chats.length === 0 && (
          <div className={styles.listState}>
            <p>Пока нет чатов. Начните новую беседу.</p>
          </div>
        )}
        {search && filtered.length === 0 && chats.length > 0 && (
          <div className={styles.listState}>
            <p>Ничего не найдено</p>
          </div>
        )}
      </div>
      {(isFetching || recent.isFetching || previewLoading || isError || session.receiveStatus === 'reconnecting') && (
        <div className={styles.syncStatus} role="status" aria-label="Синхронизация чатов">
          <Spinner />
        </div>
      )}
      {menuState !== 'closed' && (
        <div className={`${styles.menuBackdrop} ${menuState === 'closing' ? styles.menuClosing : ''}`} onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeMenu()
        }}>
          <nav className={styles.drawer} aria-label="Меню профиля">
            <div className={styles.drawerProfile}>
              <IconButton className={styles.closeMenu} aria-label="Закрыть меню" onClick={closeMenu}><X size={20} /></IconButton>
              <Avatar name={account?.username || 'Я'} imageUrl={account?.avatar} className={styles.profileAvatar} />
              <strong>{account?.username || account?.phone || 'Мой профиль'}</strong>
              <span>{account?.phone ? `+${account.phone}` : 'Telegram'}</span>
            </div>
            <button className={styles.menuItem} onClick={() => setSelfOpen((open) => !open)} aria-expanded={selfOpen}>
              <UserRound size={19} /><span>Мой профиль</span>
            </button>
            {selfOpen && <div className={styles.selfDetails}>
              {account?.username && <p><small>Имя пользователя</small><strong>{account.username}</strong></p>}
              {account?.phone && <p><small>Телефон</small><strong>+{account.phone}</strong></p>}
              {account?.historySyncProgress !== undefined && <p><small>Синхронизация истории</small><strong>{account.historySyncProgress}%</strong></p>}
            </div>}
            <button className={styles.menuItem} onClick={onThemeChange}>
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              <span>{theme === 'dark' ? 'Светлый режим' : 'Ночной режим'}</span>
              <span className={styles.switch} data-active={theme === 'dark'} />
            </button>
            <button className={styles.menuItem} onClick={logout}>
              <LogOut size={19} /><span>Выйти из профиля</span>
            </button>
          </nav>
        </div>
      )}
      {modalOpen && <CreateChatModal onClose={closeModal} />}
    </aside>
  )
}
