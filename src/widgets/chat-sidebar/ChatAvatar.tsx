import { useEffect, useRef, useState } from 'react'
import { useGetAvatarQuery } from '../../shared/api/green-api/rtk'
import { Avatar } from '../../shared/ui'
import styles from './sidebar.module.css'

export function ChatAvatar({
  chatId,
  name,
  eager = false,
  fallbackLoad = true,
}: {
  chatId: string
  name: string
  eager?: boolean
  fallbackLoad?: boolean
}) {
  const target = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(
    () => eager || (fallbackLoad && !('IntersectionObserver' in window)),
  )
  useEffect(() => {
    if (eager || visible || !('IntersectionObserver' in window)) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          timer ??= setTimeout(() => {
            setVisible(true)
            observer.disconnect()
          }, 450)
        else if (timer) {
          clearTimeout(timer)
          timer = undefined
        }
      },
      { rootMargin: '40px' },
    )
    if (target.current) observer.observe(target.current)
    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
    }
  }, [eager, visible])
  const { data, isFetching } = useGetAvatarQuery(chatId, { skip: !visible })
  return (
    <span ref={target} className={styles.avatarSlot}>
      {!visible || (isFetching && data === undefined) ? (
        <span className={styles.skeletonAvatar} aria-label="Загружаем аватар" />
      ) : (
        <Avatar name={name} imageUrl={data || undefined} />
      )}
    </span>
  )
}
