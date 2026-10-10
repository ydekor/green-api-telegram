import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom'
import { Provider } from 'react-redux'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { store, useAppDispatch, useAppSelector } from './store'
import { Spinner } from '../shared/ui'
import { readSavedConnection } from '../shared/lib/saved-connection'
import { sessionActions } from '../entities/session/model'

const ConnectPage = lazy(() =>
  import('../pages/connect/ConnectPage').then((module) => ({
    default: module.ConnectPage,
  })),
)
const ChatsPage = lazy(() =>
  import('../pages/chats/ChatsPage').then((module) => ({
    default: module.ChatsPage,
  })),
)

function ProtectedLayout() {
  const connected = useAppSelector(
    (state) => state.session.status === 'connected',
  )
  return connected ? <Outlet /> : <Navigate to="/connect" replace />
}
function ConnectRoute() {
  const connected = useAppSelector(
    (state) => state.session.status === 'connected',
  )
  return connected ? <Navigate to="/chats" replace /> : <ConnectPage />
}
function Fallback() {
  const connected = useAppSelector(
    (state) => state.session.status === 'connected',
  )
  return <Navigate to={connected ? '/chats' : '/connect'} replace />
}
function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const status = useAppSelector((state) => state.session.status)
  const started = useRef(false)
  useEffect(() => {
    if (status !== 'restoring' || started.current) return
    started.current = true
    const saved = readSavedConnection()
    if (!saved) {
      dispatch(sessionActions.disconnected())
      return
    }
    dispatch(sessionActions.connected(saved))
  }, [dispatch, status])
  if (status === 'restoring')
    return (
      <div className="app-loading" role="status">
        <Spinner /> Восстанавливаем подключение…
      </div>
    )
  return children
}
export default function App() {
  return (
    <Provider store={store}>
      <SessionBootstrap>
        <BrowserRouter>
          <Suspense
            fallback={
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  height: '100dvh',
                }}
              >
                <Spinner />
              </div>
            }
          >
            <Routes>
              <Route path="/connect" element={<ConnectRoute />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/chats" element={<ChatsPage />} />
                <Route path="/chats/:chatId" element={<ChatsPage />} />
              </Route>
              <Route path="*" element={<Fallback />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SessionBootstrap>
    </Provider>
  )
}
