import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { ApiError, greenClient, errorMessage, type Credentials } from './index'
import { readAvatar, saveAvatar } from '../../lib/avatar-cache'

type State = { session: { credentials: Credentials | null } }
const credentials = (state: unknown) => (state as State).session.credentials
const failure = (error: unknown) => ({
  error: { message: errorMessage(error) },
})
const blockedContactInfoInstances = new Map<string, number>()
export const greenApi = createApi({
  reducerPath: 'greenApi',
  baseQuery: fakeBaseQuery<{ message: string }>(),
  endpoints: (build) => ({
    getChats: build.query<Awaited<ReturnType<typeof greenClient.chats>>, void>({
      async queryFn(_arg, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        try {
          return { data: await greenClient.chats(c, api.signal) }
        } catch (error) {
          return failure(error)
        }
      },
    }),
    getAccountSettings: build.query<Awaited<ReturnType<typeof greenClient.accountSettings>>, void>({
      async queryFn(_arg, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        try { return { data: await greenClient.accountSettings(c, api.signal) } }
        catch (error) { return failure(error) }
      },
    }),
    getRecentActivity: build.query<Awaited<ReturnType<typeof greenClient.incomingJournal>>, void>({
      async queryFn(_arg, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        try {
          const [incoming, outgoing] = await Promise.all([
            greenClient.incomingJournal(c, api.signal),
            greenClient.outgoingJournal(c, api.signal),
          ])
          return { data: [...incoming, ...outgoing] }
        } catch (error) { return failure(error) }
      },
    }),
    getContactInfo: build.query<Awaited<ReturnType<typeof greenClient.contactInfo>>, string>({
      keepUnusedDataFor: 300,
      async queryFn(chatId, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        if ((blockedContactInfoInstances.get(c.idInstance) ?? 0) > Date.now()) return { data: { chatId } }
        try { return { data: await greenClient.contactInfo(c, chatId, api.signal) } }
        catch (error) {
          if (error instanceof ApiError && error.status === 466) {
            blockedContactInfoInstances.set(c.idInstance, Date.now() + 5 * 60 * 1000)
            return { data: { chatId } }
          }
          return failure(error)
        }
      },
    }),
    getAvatar: build.query<string, string>({
      keepUnusedDataFor: 3600,
      async queryFn(chatId, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        const cached = readAvatar(c, chatId)
        if (cached !== null) return { data: cached }
        try {
          const result = await greenClient.avatar(c, chatId, api.signal)
          saveAvatar(c, chatId, result.urlAvatar)
          return { data: result.urlAvatar }
        } catch (error) {
          if (api.signal.aborted) return failure(error)
          saveAvatar(c, chatId, '', 5 * 60 * 1000)
          return { data: '' }
        }
      },
    }),
    getHistory: build.query<
      Awaited<ReturnType<typeof greenClient.history>>,
      string
    >({
      async queryFn(chatId, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        try {
          return { data: await greenClient.history(c, chatId, api.signal) }
        } catch (error) {
          return failure(error)
        }
      },
    }),
    checkAccount: build.mutation<
      Awaited<ReturnType<typeof greenClient.check>>,
      string
    >({
      async queryFn(phone, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        try {
          return { data: await greenClient.check(c, phone, api.signal) }
        } catch (error) {
          return failure(error)
        }
      },
    }),
    sendMessage: build.mutation<
      Awaited<ReturnType<typeof greenClient.send>>,
      { chatId: string; message: string }
    >({
      async queryFn({ chatId, message }, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        try {
          return {
            data: await greenClient.send(c, chatId, message, api.signal),
          }
        } catch (error) {
          return failure(error)
        }
      },
    }),
    sendFile: build.mutation<
      Awaited<ReturnType<typeof greenClient.sendFile>>,
      { chatId: string; file: File; caption: string }
    >({
      async queryFn({ chatId, file, caption }, api) {
        const c = credentials(api.getState())
        if (!c) return failure('No session')
        try { return { data: await greenClient.sendFile(c, chatId, file, caption, api.signal) } }
        catch (error) { return failure(error) }
      },
    }),
  }),
})
export const {
  useLazyGetChatsQuery,
  useGetChatsQuery,
  useGetAccountSettingsQuery,
  useGetRecentActivityQuery,
  useGetContactInfoQuery,
  useGetAvatarQuery,
  useGetHistoryQuery,
  useLazyGetHistoryQuery,
  useCheckAccountMutation,
  useSendMessageMutation,
  useSendFileMutation,
} = greenApi
