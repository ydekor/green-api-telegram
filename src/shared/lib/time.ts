import { format, isToday, isYesterday } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatTime(timestamp: number): string {
  return format(new Date(timestamp * 1000), 'HH:mm')
}
export function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return isToday(date) ? format(date, 'HH:mm') : isYesterday(date) ? 'Вчера' : format(date, 'dd.MM.yy')
}
export function formatDay(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return isToday(date)
    ? 'Сегодня'
    : isYesterday(date)
      ? 'Вчера'
      : format(date, 'd MMMM yyyy', { locale: ru })
}

const relativeTime = new Intl.RelativeTimeFormat('ru', { numeric: 'always' })
export function formatLastSeen(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  const elapsed = Math.max(0, Math.floor(now / 1000) - timestamp)
  if (elapsed < 60) return 'последний раз в сети только что'
  if (elapsed < 3600) return `последний раз в сети ${relativeTime.format(-Math.floor(elapsed / 60), 'minute')}`
  if (elapsed < 86400) return `последний раз в сети ${relativeTime.format(-Math.floor(elapsed / 3600), 'hour')}`
  if (elapsed < 7 * 86400) return `последний раз в сети ${relativeTime.format(-Math.floor(elapsed / 86400), 'day')}`
  return `последний раз в сети ${format(new Date(timestamp * 1000), 'd MMMM yyyy, HH:mm', { locale: ru })}`
}
