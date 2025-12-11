import { Box, ChakraProvider, Text } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './components/ModernClusterStyles.css'
import './components/ModernMarkerStyles.css'
import TelegramLoginWidget from './components/TelegramLoginWidget'
import { useTelegramTheme } from './hooks/useTelegramTheme'
import { useTelegramUser } from './hooks/useTelegramUser'
import './index.css'
import NavBar from './NavBar.jsx'
import {
	TopUsersPage as TopUsers,
	MapPage as UserMap,
	WeeklyStatsPage as WeeklyStats,
	AuthPage,
} from './pages'
import './styles/theme.css'
import {
	APP_CONFIG,
	devLog,
	getCurrentConfig,
	getDefaultUser,
} from './utils/config.js'
import {
	getSharedRouteParamFromHash,
	getSharedRouteIdFromHash,
} from './utils/sharedRoute'

const queryClient = new QueryClient()
const AUTH_STORAGE_KEY = 'webmap_auth_v1'
const DEV_SKIP_AUTOLOGIN_KEY = 'webmap_skip_dev_autologin'
const GUEST_MODE_STORAGE_KEY = 'webmap_guest_mode'

const loadStoredAuth = () => {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
		return raw ? JSON.parse(raw) : null
	} catch (error) {
		console.error('Error reading auth data:', error)
		return null
	}
}

const normalizeTelegramUser = tg => {
	if (!tg) return null
	const user = {
		id: tg.id,
		firstName: tg.first_name || tg.firstName,
		lastName: tg.last_name || tg.lastName,
		username: tg.username || null,
		photoUrl: tg.photo_url || tg.photoUrl || null,
	}
	return user.id ? user : null
}

function App() {
	const { isDev } = APP_CONFIG
	const config = getCurrentConfig()

	useEffect(() => {
		if (window.Telegram?.WebApp) {
			window.Telegram.WebApp.ready()
			window.Telegram.WebApp.expand()
			devLog.info('Telegram WebApp initialized')
		}
	}, [])

	useEffect(() => {
		if (!window.location.hash || window.location.hash === '#') {
			window.location.replace('#/')
		}
	}, [])

	const adminIds = [
		200885469, 900133683, 527549474, 294170514, 495310665, 210489888, 207180970,
	]

	const telegramUser = useTelegramUser()
	useTelegramTheme()

	const [user, setUser] = useState(() => {
		const stored = loadStoredAuth()
		return stored?.user || null
	})
	const [authToken, setAuthToken] = useState(() => {
		const stored = loadStoredAuth()
		return stored?.token || null
	})
	const [isLoading, setIsLoading] = useState(true)
	const [guestMode, setGuestMode] = useState(() => {
		if (typeof window === 'undefined') return false
		try {
			// если уже есть авторизация в storage — не переключаемся в гостя даже с sharedId
			const storedAuth = loadStoredAuth()
			if (storedAuth?.user?.id) {
				return false
			}
			if (window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true') {
				return true
			}
			const sharedParam = getSharedRouteParamFromHash(window.location.hash || '')
			const sharedId = getSharedRouteIdFromHash(window.location.hash || '')
			if (sharedParam || sharedId) {
				window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true')
				return true
			}
		} catch (error) {
			console.error('Error reading guest flag:', error)
		}
		return false
	})

	const setGuestModePersisted = useCallback(next => {
		setGuestMode(next)
		if (typeof window === 'undefined') return
		try {
			if (next) {
				window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true')
			} else {
				window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY)
			}
		} catch (error) {
			console.error('Error updating guest flag:', error)
		}
	}, [])

const persistAuthData = useCallback(
	(nextUser, token = null) => {
		if (!nextUser?.id) return
		const payload = { user: nextUser, token }
		try {
			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
			localStorage.removeItem(DEV_SKIP_AUTOLOGIN_KEY)
		} catch (error) {
			console.error('Error saving auth data:', error)
		}
		setUser(nextUser)
		setAuthToken(token)
		setGuestModePersisted(false)
	},
	[setGuestModePersisted]
)

	const clearAuthData = useCallback(() => {
		try {
			localStorage.removeItem(AUTH_STORAGE_KEY)
		} catch (error) {
			console.error('Error clearing auth data:', error)
		}
		setUser(null)
		setAuthToken(null)
		setGuestModePersisted(false)
	}, [setGuestModePersisted])

	useEffect(() => {
		if (user && user.id) {
			setIsLoading(false)
			return
		}

	if (isDev) {
		const skipDevAutoLogin =
			localStorage.getItem(DEV_SKIP_AUTOLOGIN_KEY) === 'true'
		if (!skipDevAutoLogin) {
			const devUser = getDefaultUser()
			devLog.info('Development mode: using configured user', devUser)
			setUser(devUser)
			setIsLoading(false)
		} else {
			setIsLoading(false)
		}
	} else {
			const checkTelegramUser = () => {
				const tg = window.Telegram?.WebApp?.initDataUnsafe

				if (tg?.user) {
					const normalized = normalizeTelegramUser(tg.user)
					if (normalized) {
						persistAuthData(normalized)
						setIsLoading(false)
						devLog.success('Telegram WebApp user loaded:', normalized)
						return true
					}
				}

				if (telegramUser?.id) {
					const normalized = normalizeTelegramUser({
						id: telegramUser.id,
						first_name: telegramUser.firstName,
						last_name: telegramUser.lastName,
						username: telegramUser.username,
						photo_url: telegramUser.photoUrl,
					})
					if (normalized) {
						persistAuthData(normalized)
						setIsLoading(false)
						devLog.success('Telegram user from hook:', normalized)
						return true
					}
				}

				return false
			}

			if (!checkTelegramUser()) {
				const timeout = setTimeout(() => {
					if (!checkTelegramUser()) {
						setIsLoading(false)
					}
				}, 500)

				return () => clearTimeout(timeout)
			}
		}
	}, [isDev, telegramUser, user, persistAuthData])

	const handleGuestAccess = useCallback(() => {
		setGuestModePersisted(true)
		setIsLoading(false)
		window.location.replace('#/')
	}, [setGuestModePersisted])

	const handleRequireAuth = useCallback(() => {
		setGuestModePersisted(false)
		window.location.replace('#/auth')
	}, [setGuestModePersisted])

	if (isLoading) {
		return (
			<ChakraProvider>
				<div
					style={{
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						height: '100vh',
						flexDirection: 'column',
					}}
				>
					<div>🔄 Загрузка...</div>
				</div>
			</ChakraProvider>
		)
	}

	const handleAuth = authUser => {
		if (!isDev && authUser && authUser.id) {
			const normalized = normalizeTelegramUser(authUser)
			if (normalized) {
				persistAuthData(normalized)
				setIsLoading(false)
				devLog.success('Telegram auth successful:', authUser)
			}
		} else if (!isDev) {
			console.error('❌ Invalid user data received from Telegram widget')
		}
	}

	const handleManualAuthSuccess = ({ user: nextUser, token = null }) => {
		if (!nextUser?.id) {
			console.error('❌ Invalid user data received from auth form')
			return
		}
		persistAuthData(nextUser, token)
		setIsLoading(false)
	}

	const authFooter = !isDev && config.telegramBotName && (
		<Box textAlign='center'>
			<Text fontSize='sm' color='gray.600'>
				Или войдите через Telegram
			</Text>
			<Box mt={2} display='flex' justifyContent='center'>
				<TelegramLoginWidget botName={config.telegramBotName} onAuth={handleAuth} />
			</Box>
		</Box>
	)

const handleLogout = () => {
	clearAuthData()
	try {
		localStorage.setItem(DEV_SKIP_AUTOLOGIN_KEY, 'true')
	} catch (error) {
		console.error('Error writing dev skip flag:', error)
	}
	window.location.replace('#/auth')
}

	const effectiveUserId = user?.id || null
	const isGuestView = guestMode || !effectiveUserId

	if (!effectiveUserId && !guestMode) {
		return (
			<QueryClientProvider client={queryClient}>
				<ChakraProvider>
					<AuthPage
						onAuthSuccess={handleManualAuthSuccess}
						defaultMode='login'
						footer={authFooter}
						onGuestAccess={handleGuestAccess}
					/>
				</ChakraProvider>
			</QueryClientProvider>
		)
	}

	return (
		<QueryClientProvider client={queryClient}>
			<ChakraProvider>
				{config.showDevIndicator && (
					<div
						style={{
							position: 'fixed',
							top: '10px',
							right: '80px',
							backgroundColor: '#ff6b35',
							color: 'white',
							padding: '4px 8px',
							borderRadius: '4px',
							fontSize: '12px',
							fontWeight: 'bold',
							zIndex: 10000,
							boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
						}}
					>
						🛠️ DEV MODE
					</div>
				)}
				<HashRouter>
					<Routes>
						<Route
							path='/'
							element={
								<UserMap
									userId={effectiveUserId}
									admins={adminIds}
									isGuestMode={isGuestView}
									onRequireAuth={handleRequireAuth}
								/>
							}
						/>
						<Route
							path='/weekly-stats'
							element={
								isGuestView ? (
									<Navigate to='/' replace />
								) : (
									<WeeklyStats userId={effectiveUserId} onLogout={handleLogout} />
								)
							}
						/>
						<Route
							path='/top-users'
							element={
								isGuestView ? (
									<Navigate to='/' replace />
								) : (
									<TopUsers userId={effectiveUserId} admins={adminIds} />
								)
							}
						/>
						<Route path='*' element={<Navigate to='/' replace />} />
					</Routes>
					{!isGuestView && <NavBar />}
				</HashRouter>
			</ChakraProvider>
		</QueryClientProvider>
	)
}

export default App
