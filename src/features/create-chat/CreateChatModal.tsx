import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useCheckAccountMutation } from '../../shared/api/green-api/rtk'
import { normalizePhone } from '../../shared/api/green-api'
import { useAppDispatch } from '../../shared/lib/redux'
import { chatsActions } from '../../entities/chat/model'
import { Button, FormField, Input, Modal, Spinner } from '../../shared/ui'
import styles from './create-chat.module.css'

const schema = z.object({
  phone: z
    .string()
    .refine(
      (value) => normalizePhone(value) !== null,
      'Введите номер в международном формате: 7–15 цифр',
    ),
})
type Values = z.infer<typeof schema>
export function CreateChatModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [check, result] = useCheckAccountMutation()
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<ReturnType<typeof check> | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(
    () => () => {
      pending.current?.abort()
    },
    [],
  )
  const submit = async ({ phone }: Values) => {
    const normalized = normalizePhone(phone)
    if (!normalized) return
    setError(null)
    const promise = check(normalized)
    pending.current = promise
    try {
      const account = await promise.unwrap()
      if (!account.exist || !account.chatId) {
        setError('Аккаунт не найден или номер скрыт настройками приватности.')
        return
      }
      dispatch(
        chatsActions.upsert({
          id: account.chatId,
          name: account.username || `+${normalized}`,
          type: 'user',
          phoneNumber: normalized,
          username: account.username,
        }),
      )
      onClose()
      navigate(`/chats/${encodeURIComponent(account.chatId)}`)
    } catch {
      setError(
        'Не удалось проверить номер. Проверьте соединение и повторите попытку.',
      )
    } finally {
      pending.current = null
    }
  }
  return (
    <Modal title="Новый чат" onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          void handleSubmit(submit)(event)
        }}
        noValidate
      >
        <p>
          Введите номер с кодом страны. Мы проверим его через CheckAccount и
          откроем чат по реальному Telegram ID.
        </p>
        <FormField label="Номер телефона" error={errors.phone?.message}>
          <Input
            autoFocus
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 999 123 45 67"
            {...register('phone')}
          />
        </FormField>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={result.isLoading}>
            {result.isLoading ? (
              <>
                <Spinner /> Проверяем…
              </>
            ) : (
              'Открыть чат'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
