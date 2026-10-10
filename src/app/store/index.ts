import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from 'react-redux'
import { sessionSlice } from '../../entities/session/model'
import { chatsSlice } from '../../entities/chat/model'
import { messagesSlice } from '../../entities/message/model'
import { greenApi } from '../../shared/api/green-api/rtk'

export const store = configureStore({
  devTools: false,
  reducer: {
    session: sessionSlice.reducer,
    chats: chatsSlice.reducer,
    messages: messagesSlice.reducer,
    [greenApi.reducerPath]: greenApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(greenApi.middleware),
})
setupListeners(store.dispatch)
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
