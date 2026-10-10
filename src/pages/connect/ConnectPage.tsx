import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Eye,
  EyeOff,
  LockKeyhole,
  MessageCircleMore,
  ShieldCheck,
} from 'lucide-react'
import { Button, FormField, IconButton, Input, Spinner } from '../../shared/ui'
import {
  credentialsSchema,
  greenClient,
  errorMessage,
  type Credentials,
} from '../../shared/api/green-api'
import { sessionActions, sessionSlice } from '../../entities/session/model'
import { useAppDispatch, useAppSelector } from '../../shared/lib/redux'
import styles from './connect.module.css'
import {
  readSavedConnection,
  saveConnection,
} from '../../shared/lib/saved-connection'

export function ConnectPage() {
  const dispatch = useAppDispatch()
  const [visible, setVisible] = useState(false)
  const session = useAppSelector(
    (state: { session: ReturnType<typeof sessionSlice.reducer> }) =>
      state.session,
  )
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: readSavedConnection() ?? {
      apiUrl: '',
      idInstance: '',
      apiTokenInstance: '',
      mediaUrl: '',
    },
  })
  const submit = async (values: Credentials) => {
    dispatch(sessionActions.connecting())
    try {
      const state = await greenClient.state(values)
      if (state.stateInstance !== 'authorized') {
        dispatch(
          sessionActions.connectionFailed(
            `Инстанс не готов: ${state.stateInstance}. Проверьте состояние в кабинете GREEN-API.`,
          ),
        )
        return
      }
      saveConnection(values)
      dispatch(sessionActions.connected(values))
    } catch (error: unknown) {
      dispatch(sessionActions.connectionFailed(errorMessage(error)))
    }
  }
  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.shell}>
        <div className={styles.intro}>
          <div className={styles.mark}>
            <MessageCircleMore size={29} />
          </div>
          <span className={styles.eyebrow}>GREEN-API · TELEGRAM</span>
          <h1>
            Сообщения рядом.
            <br />
            <em>Управление у вас.</em>
          </h1>
          <p>
            Подключите существующий Telegram-инстанс и общайтесь через удобный
            веб-интерфейс.
          </p>
          <div className={styles.benefits}>
            <span>
              <ShieldCheck size={17} /> Подключение сохранится в этом браузере
            </span>
            <span>
              <LockKeyhole size={17} /> Защищённое соединение через приложение
            </span>
          </div>
        </div>
        <section className={styles.card} aria-label="Подключение инстанса">
          <div className={styles.cardHead}>
            <span className={styles.step}>01 / ПОДКЛЮЧЕНИЕ</span>
            <h2>Добро пожаловать</h2>
            <p>Введите данные авторизованного инстанса из личного кабинета.</p>
          </div>
          <form onSubmit={handleSubmit(submit)} noValidate>
            <FormField label="API URL" error={errors.apiUrl?.message}>
              <Input
                autoComplete="url"
                placeholder="https://4100.api.green-api.com/"
                {...register('apiUrl')}
              />
            </FormField>
            <FormField label="Media URL (для фото и видео)" error={errors.mediaUrl?.message}>
              <Input
                autoComplete="url"
                placeholder="https://media.green-api.com/"
                {...register('mediaUrl')}
              />
            </FormField>
            <FormField label="ID Instance" error={errors.idInstance?.message}>
              <Input
                autoComplete="off"
                inputMode="numeric"
                placeholder="Номер инстанса"
                {...register('idInstance')}
              />
            </FormField>
            <FormField
              label="API Token Instance"
              error={errors.apiTokenInstance?.message}
            >
              <div className={styles.password}>
                <Input
                  autoComplete="off"
                  type={visible ? 'text' : 'password'}
                  placeholder="Токен инстанса"
                  {...register('apiTokenInstance')}
                />
                <IconButton
                  type="button"
                  aria-label={visible ? 'Скрыть токен' : 'Показать токен'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </IconButton>
              </div>
            </FormField>
            {session.error && (
              <p className={styles.error} role="alert">
                {session.error}
              </p>
            )}
            <Button
              className={styles.submit}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner /> Подключаем…
                </>
              ) : (
                'Подключиться'
              )}
            </Button>
          </form>
          <div className={styles.footer}>
            Нет данных под рукой?{' '}
            <a
              href="https://console.green-api.com/"
              target="_blank"
              rel="noreferrer"
            >
              Открыть кабинет GREEN-API ↗
            </a>
          </div>
        </section>
      </div>
      <p className={styles.note}>
        Данные подключения хранятся в этом браузере. Кнопка «Отключиться» удалит
        их.
      </p>
    </main>
  )
}
