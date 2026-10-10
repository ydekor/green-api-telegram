import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { ArrowLeft, Check, CheckCheck, Paperclip, RotateCcw, Send, Smile, X, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from 'react-redux'
import type { RootState } from '../../app/store'
import { useAppDispatch, useAppSelector } from '../../shared/lib/redux'
import {
  messagesSlice,
  selectMessagesForChat,
  type Message,
} from '../../entities/message/model'
import { normalizeHistory } from '../../entities/message/normalize'
import { messagesActions } from '../../entities/message/model'
import { chatsActions, type Chat } from '../../entities/chat/model'
import { useGetHistoryQuery, useGetContactInfoQuery, useSendFileMutation } from '../../shared/api/green-api/rtk'
import { useSend } from '../../features/send-message/useSend'
import {
  EmptyState,
  IconButton,
  Spinner,
  Textarea,
  Avatar,
} from '../../shared/ui'
import { ChatAvatar } from '../chat-sidebar/ChatAvatar'
import { formatDay, formatTime, formatLastSeen } from '../../shared/lib/time'
import styles from './conversation.module.css'

const supportedMediaTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
])

function MessageBubble({
  message,
  onRetry,
}: {
  message: Message
  onRetry: (message: Message) => void
}) {
  return (
    <div
      className={`${styles.messageRow} ${message.direction === 'outgoing' ? styles.outgoing : ''}`}
    >
      <div className={styles.bubble}>
        {message.kind === 'image' && message.mediaUrl &&
          <a href={message.mediaUrl} target="_blank" rel="noreferrer" aria-label="Открыть фото">
            <img className={styles.mediaImage} src={message.mediaUrl} alt={message.text === 'Фото' ? 'Фото' : message.text} loading="lazy" referrerPolicy="no-referrer" />
          </a>}
        {message.kind === 'video' && message.mediaUrl &&
          <video className={styles.mediaVideo} src={message.mediaUrl} controls preload="none" playsInline />}
        {message.kind === 'sticker' && message.mediaUrl && message.mimeType === 'image/webp' &&
          <img className={styles.stickerImage} src={message.mediaUrl} alt="Стикер" loading="lazy" referrerPolicy="no-referrer" />}
        {(message.kind === 'document' || message.kind === 'audio' || (message.kind === 'sticker' && message.mimeType !== 'image/webp')) && message.mediaUrl &&
          <a className={styles.fileLink} href={message.mediaUrl} target="_blank" rel="noreferrer">{message.fileName || message.text}</a>}
        {message.kind !== 'sticker' && <p>{message.text}</p>}
        {message.kind === 'sticker' && !message.mediaUrl && <p>Стикер</p>}
        {message.reactions?.length ? <div className={styles.reactions} aria-label="Реакции">{message.reactions.join(' ')}</div> : null}
        <div className={styles.meta}>
          <time>{formatTime(message.timestamp)}</time>
          {message.direction === 'outgoing' &&
            (message.status === 'pending' ? (
              <Spinner />
            ) : message.status === 'failed' ? (
              <span className={styles.failed}>Не отправлено</span>
            ) : message.status === 'read' || message.status === 'delivered' ? (
              <CheckCheck
                size={15}
                aria-label={
                  message.status === 'read' ? 'Прочитано' : 'Доставлено'
                }
              />
            ) : (
              <Check size={15} aria-label="Принято API" />
            ))}
        </div>
        {message.status === 'failed' && message.kind !== 'image' && message.kind !== 'video' && (
          <button className={styles.retry} onClick={() => onRetry(message)}>
            <RotateCcw size={14} /> Повторить
          </button>
        )}
      </div>
    </div>
  )
}

export function Conversation({ chat }: { chat: Chat }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const store = useStore<RootState>()
  const instanceId = useAppSelector((state: RootState) => state.session.credentials?.idInstance)
  const messages = useAppSelector(
    (state: { messages: ReturnType<typeof messagesSlice.reducer> }) =>
      selectMessagesForChat(state, chat.id),
  )
  const historyState = useGetHistoryQuery(chat.id, {
    refetchOnMountOrArgChange: true,
    pollingInterval: 30000,
    skipPollingIfUnfocused: true,
  })
  const { refetch: refetchHistory, isError: historyError, isFetching: historyFetching } = historyState
  const [draft, setDraft] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [fileError, setFileError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const historyRetryCount = useRef(0)
  const [sendFileMutation, fileSendState] = useSendFileMutation()
  useEffect(() => {
    if (!historyError) historyRetryCount.current = 0
    if (!historyError || historyFetching) return
    const delay = Math.min(3000 * 2 ** historyRetryCount.current, 60000)
    historyRetryCount.current += 1
    const timer = window.setTimeout(() => { void refetchHistory() }, delay)
    return () => window.clearTimeout(timer)
  }, [chat.id, historyError, historyFetching, refetchHistory])
  const [profileOpen, setProfileOpen] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  const profile = useGetContactInfoQuery(chat.id, {
    skip: chat.type !== 'user',
    pollingInterval: 300000,
    skipPollingIfUnfocused: true,
    refetchOnMountOrArgChange: 300,
  })
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const profileRetryCount = useRef(0)
  const { isError: profileError, isFetching: profileFetching, refetch: refetchProfile } = profile
  useEffect(() => {
    if (!profileError) profileRetryCount.current = 0
    if (!profileOpen || !profileError || profileFetching) return
    const delay = Math.min(5000 * 2 ** profileRetryCount.current, 60000)
    profileRetryCount.current += 1
    const timer = window.setTimeout(() => { void refetchProfile() }, delay)
    return () => window.clearTimeout(timer)
  }, [profileOpen, profileError, profileFetching, refetchProfile])
  useEffect(() => {
    if (!profileOpen) return
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profileOpen])
  const { send, isSending } = useSend()
  const scroller = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  useEffect(() => {
    if (!historyState.data) return
    const normalized = historyState.data
      .map(normalizeHistory)
      .filter((item): item is Message => item !== null)
    dispatch(messagesActions.historyReceived(normalized))
    const latest = normalized.reduce<Message | null>(
      (current, message) =>
        !current || message.timestamp > current.timestamp ? message : current,
      null,
    )
    if (latest)
      dispatch(
        chatsActions.activity({
          chatId: chat.id,
          text: latest.text,
          timestamp: latest.timestamp,
          messageId: latest.serverId,
          direction: latest.direction,
          status: latest.status,
        }),
      )
  }, [chat.id, dispatch, historyState.data])
  useEffect(() => {
    if (nearBottom.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight
  }, [messages.length])
  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || text.length > 4096 || isSending || fileSendState.isLoading) return
    setDraft('')
    await send(chat.id, text)
  }
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }
  const retry = (message: Message) => {
    void send(chat.id, message.text, message)
  }
  const sendFile = async (file?: File) => {
    if (!file || isSending || fileSendState.isLoading) return
    if (!supportedMediaTypes.has(file.type) || file.size > 20 * 1024 * 1024) {
      setFileError('Выберите фото или видео размером до 20 МБ.')
      return
    }
    if (draft.trim().length > 1024) {
      setFileError('Подпись к файлу должна быть не длиннее 1024 символов.')
      return
    }
    setFileError('')
    const kind = file.type.startsWith('video/') ? 'video' : 'image'
    const caption = draft.trim()
    const text = caption || (kind === 'image' ? 'Фото' : 'Видео')
    const clientId = crypto.randomUUID()
    const timestamp = Math.floor(Date.now() / 1000)
    dispatch(messagesActions.optimistic({
      id: `local:${clientId}`, clientId, chatId: chat.id, text, kind,
      direction: 'outgoing', timestamp, status: 'pending', fileName: file.name,
      mimeType: file.type,
    }))
    dispatch(chatsActions.activity({
      chatId: chat.id, text, timestamp, messageId: `local:${clientId}`,
      direction: 'outgoing', status: 'pending', promote: true,
    }))
    setDraft('')
    try {
      const result = await sendFileMutation({ chatId: chat.id, file, caption }).unwrap()
      if (store.getState().session.credentials?.idInstance !== instanceId) return
      dispatch(messagesActions.sendConfirmed({ clientId, serverId: result.idMessage }))
      dispatch(chatsActions.messageStatus({
        chatId: chat.id, messageId: `local:${clientId}`, serverId: result.idMessage, status: 'sent',
      }))
      dispatch(messagesActions.received({
        id: `${chat.id}:${result.idMessage}`, chatId: chat.id, text, kind,
        direction: 'outgoing', timestamp, status: 'sent', serverId: result.idMessage,
        mediaUrl: result.urlFile, fileName: file.name, mimeType: file.type,
      }))
      void refetchHistory()
    } catch {
      if (store.getState().session.credentials?.idInstance !== instanceId) return
      dispatch(messagesActions.removed(`local:${clientId}`))
      dispatch(chatsActions.messageStatus({ chatId: chat.id, messageId: `local:${clientId}`, status: 'failed' }))
      setFileError('Не удалось отправить файл. Выберите его ещё раз.')
      setDraft(caption)
    }
  }
  return (
    <section className={styles.conversation} aria-label={`Чат ${chat.name}`}>
      <header className={styles.header}>
        <IconButton
          className={styles.back}
          aria-label="К списку чатов"
          onClick={() => navigate('/chats')}
        >
          <ArrowLeft size={21} />
        </IconButton>
        <button className={styles.headerProfile} onClick={() => setProfileOpen(true)} aria-label={`Информация о ${chat.name}`}>
          <ChatAvatar chatId={chat.id} name={chat.name} eager />
          <span>
            <strong>{chat.name}</strong>
            <small>{profile.data?.lastSeen
              ? formatLastSeen(profile.data.lastSeen, clock)
              : chat.username || (chat.phoneNumber ? `+${chat.phoneNumber}` : chat.type === 'user' ? 'Личный чат' : 'Групповой чат')}</small>
          </span>
        </button>
      </header>
      <div
        className={styles.messages}
        ref={scroller}
        onScroll={(event) => {
          const el = event.currentTarget
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
      >
        {(historyState.isFetching || historyState.isError) && messages.length === 0 && (
          <div className={styles.historySkeleton} aria-label="Загружаем историю">
            <span className={styles.skeletonDay} />
            <span className={styles.skeletonBubble} />
            <span className={`${styles.skeletonBubble} ${styles.skeletonRight}`} />
            <span className={styles.skeletonBubble} />
          </div>
        )}
        {!historyState.isFetching &&
          messages.length === 0 &&
          !historyState.isError && (
          <EmptyState
            title="Начните разговор"
            text="Напишите первое сообщение в этот чат."
          />
        )}
        {messages.map((message, index) => {
          const day = formatDay(message.timestamp)
          const showDay =
            index === 0 || day !== formatDay(messages[index - 1].timestamp)
          return (
            <div key={message.id}>
              {showDay && <div className={styles.day}>{day}</div>}
              <MessageBubble message={message} onRetry={retry} />
            </div>
          )
        })}
      </div>
      <form
        className={styles.composer}
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        <input ref={fileInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" aria-label="Выбрать фото или видео" onChange={(event) => {
          void sendFile(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }} />
        <IconButton type="button" aria-label="Прикрепить фото или видео" title="Прикрепить фото или видео" onClick={() => fileInput.current?.click()} disabled={fileSendState.isLoading}><Paperclip size={21} /></IconButton>
        <div className={styles.emojiWrap}>
          <IconButton type="button" aria-label="Выбрать смайлик" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}><Smile size={21} /></IconButton>
          {emojiOpen && <div className={styles.emojiPicker} role="group" aria-label="Смайлики">
            {['😀', '😊', '😂', '❤️', '👍', '🙏', '🔥', '🎉', '😢', '👋', '🤔', '😍'].map((emoji) =>
              <button key={emoji} type="button" aria-label={`Добавить ${emoji}`} onClick={() => { setDraft((value) => value + emoji); setEmojiOpen(false) }}>{emoji}</button>)}
          </div>}
        </div>
        <Textarea
          aria-label="Текст сообщения"
          placeholder="Написать сообщение…"
          value={draft}
          maxLength={4096}
          rows={1}
          onChange={(event) => {
            setDraft(event.target.value)
            event.currentTarget.style.height = 'auto'
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`
          }}
          onKeyDown={keyDown}
        />
        <IconButton
          className={styles.send}
          aria-label="Отправить сообщение"
          type="submit"
          disabled={!draft.trim() || isSending || fileSendState.isLoading}
        >
          {isSending ? <Spinner /> : <Send size={20} />}
        </IconButton>
      </form>
      {fileError && <div className={styles.uploadError} role="alert">{fileError}</div>}
      {profileOpen && (
        <div className={styles.profileBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget) setProfileOpen(false)
        }}>
          <aside className={styles.profilePanel} role="dialog" aria-modal="true" aria-label={`Информация о ${chat.name}`}>
            <header>
              <strong>Информация</strong>
              <IconButton aria-label="Закрыть профиль" onClick={() => setProfileOpen(false)}><X size={20} /></IconButton>
            </header>
            <div className={styles.profileHero}>
              {profile.data?.avatar ? <Avatar name={chat.name} imageUrl={profile.data.avatar} className={styles.largeAvatar} /> : <ChatAvatar chatId={chat.id} name={chat.name} eager />}
              <h2>{profile.data?.contactName || profile.data?.name || chat.name}</h2>
              <span>{chat.type === 'user' ? 'Контакт Telegram' : 'Чат Telegram'}</span>
            </div>
            {profile.isFetching && <div className={styles.profileLoading}><Spinner /> Загружаем профиль…</div>}
            <div className={styles.profileDetails}>
              {(profile.data?.username || chat.username) && <div><UserRound size={18} /><span><strong>{profile.data?.username || chat.username}</strong><small>Имя пользователя</small></span></div>}
              {(profile.data?.phoneNumber || chat.phoneNumber) && <div><span className={styles.detailIcon}>#</span><span><strong>+{profile.data?.phoneNumber || chat.phoneNumber}</strong><small>Телефон</small></span></div>}
              {profile.data?.description && <div><span className={styles.detailIcon}>i</span><span><strong>{profile.data.description}</strong><small>О себе</small></span></div>}
              {profile.data?.lastSeen ? <div><span className={styles.detailIcon}>◷</span><span><strong>{new Date(profile.data.lastSeen * 1000).toLocaleString('ru-RU')}</strong><small>Был(а) в сети</small></span></div> : null}
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
