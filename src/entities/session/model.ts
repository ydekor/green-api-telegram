import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Credentials } from '../../shared/api/green-api'
import { readSavedConnection } from '../../shared/lib/saved-connection'

export type ReceiveStatus = 'stopped' | 'active' | 'reconnecting' | 'error'
interface SessionState {
  credentials: Credentials | null
  status: 'disconnected' | 'restoring' | 'connecting' | 'connected' | 'error'
  error: string | null
  receiveStatus: ReceiveStatus
  receiveError: string | null
}
const disconnectedState: SessionState = {
  credentials: null,
  status: 'disconnected',
  error: null,
  receiveStatus: 'stopped',
  receiveError: null,
}
const initialState: SessionState = {
  ...disconnectedState,
  status: readSavedConnection() ? 'restoring' : 'disconnected',
}
export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    restoring: (state) => {
      state.status = 'restoring'
      state.error = null
    },
    connecting: (state) => {
      state.status = 'connecting'
      state.error = null
    },
    connected: (state, action: PayloadAction<Credentials>) => {
      state.credentials = action.payload
      state.status = 'connected'
      state.error = null
    },
    connectionFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error'
      state.error = action.payload
      state.credentials = null
    },
    receiveChanged: (
      state,
      action: PayloadAction<{ status: ReceiveStatus; error?: string }>,
    ) => {
      state.receiveStatus = action.payload.status
      state.receiveError = action.payload.error ?? null
    },
    disconnected: () => disconnectedState,
  },
})
export const sessionActions = sessionSlice.actions
