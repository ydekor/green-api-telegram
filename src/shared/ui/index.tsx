import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { X } from 'lucide-react'
import styles from './ui.module.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
export function IconButton({
  className = '',
  ...props
}: ComponentPropsWithRef<'button'>) {
  return <button className={`${styles.iconButton} ${className}`} {...props} />
}
export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.input} ${className}`} {...props} />
}
export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${styles.textarea} ${className}`} {...props} />
}
export function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {error && <small role="alert">{error}</small>}
    </label>
  )
}
export function Avatar({
  name,
  imageUrl,
  className = '',
}: {
  name: string
  imageUrl?: string
  className?: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return (
    <span className={`${styles.avatar} ${className}`} aria-hidden="true">
      {imageUrl && failedUrl !== imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        Array.from(name).find((character) => /[\p{L}\p{N}]/u.test(character))?.toLocaleUpperCase() || '?'
      )}
    </span>
  )
}
export function Spinner() {
  return <span className={styles.spinner} role="status" aria-label="Загрузка" />
}
export function Skeleton() {
  return <div className={styles.skeleton} aria-hidden="true" />
}
export function EmptyState({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: ReactNode
}) {
  return (
    <div className={styles.state}>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  )
}
export function ErrorState({
  text,
  onRetry,
}: {
  text: string
  onRetry?: () => void
}) {
  return (
    <div className={styles.state} role="alert">
      <h2>Не удалось загрузить</h2>
      <p>{text}</p>
      {onRetry && <Button onClick={onRetry}>Повторить</Button>}
    </div>
  )
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]',
        ),
      ]
      if (!focusable.length) return
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault()
        focusable.at(-1)?.focus()
      } else if (
        !event.shiftKey &&
        document.activeElement === focusable.at(-1)
      ) {
        event.preventDefault()
        focusable[0].focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [onClose])
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <IconButton aria-label="Закрыть" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  )
}
