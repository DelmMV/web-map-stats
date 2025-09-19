import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './components/ModernClusterStyles.css'
import './components/ModernMarkerStyles.css'
import TelegramLoginWidget from './components/TelegramLoginWidget'
import { useTelegramTheme } from './hooks/useTelegramTheme'
import { useTelegramUser } from './hooks/useTelegramUser'
import './index.css'
import NavBar from './NavBar.jsx'
import './styles/theme.css'
import TopUsers from './TopUsers.jsx'
import UserMap from './UserMap.jsx'
import {
	APP_CONFIG,
	devLog,
	getCurrentConfig,
	getDefaultUser,
} from './utils/config.js'
import WeeklyStats from './WeeklyStats.jsx'

const queryClient = new QueryClient()

function App() {
	// Получаем настройки из конфигурации
	const { isDev } = APP_CONFIG
	const config = getCurrentConfig()

	// Инициализация Telegram WebApp
	useEffect(() => {
		if (window.Telegram?.WebApp) {
			window.Telegram.WebApp.ready()
			window.Telegram.WebApp.expand()
			devLog.info('Telegram WebApp initialized')
		}
	}, [])

	// Нормализуем hash: если пусто ('#' или ''), устанавливаем '#/'
	useEffect(() => {
		if (!window.location.hash || window.location.hash === '#') {
			window.location.replace('#/')
		}
	}, [])

	const adminIds = [
		200885469, 900133683, 527549474, 294170514, 495310665, 210489888, 207180970,
	]

	// Telegram hooks (используются только в production)
	const telegramUser = useTelegramUser()
	useTelegramTheme() // Инициализация темы

	const [user, setUser] = useState(null)
	const [isLoading, setIsLoading] = useState(true)

	// Инициализация пользователя в зависимости от режима
	useEffect(() => {
		if (isDev) {
			// Development режим: используем пользователя из конфигурации
			const devUser = getDefaultUser()
			devLog.info('Development mode: using configured user', devUser)
			setUser(devUser)
			setIsLoading(false)
		} else {
			// Production режим: проверяем Telegram WebApp
			const checkTelegramUser = () => {
				const tg = window.Telegram?.WebApp?.initDataUnsafe

				if (tg && tg.user) {
					// Данные пользователя получены из Telegram WebApp
					const telegramUser = {
						id: tg.user.id,
						firstName: tg.user.first_name,
						lastName: tg.user.last_name,
						username: tg.user.username,
					}
					setUser(telegramUser)
					setIsLoading(false)
					devLog.success('Telegram WebApp user loaded:', telegramUser)
					return true
				}

				// Проверяем telegramUser из хука
				if (telegramUser) {
					setUser(telegramUser)
					setIsLoading(false)
					devLog.success('Telegram user from hook:', telegramUser)
					return true
				}

				return false
			}

			// Пробуем получить данные сразу
			if (!checkTelegramUser()) {
				// Если не получилось, пробуем через небольшую задержку
				const timeout = setTimeout(() => {
					if (!checkTelegramUser()) {
						// Если данные всё ещё не получены, переходим к виджету авторизации
						setIsLoading(false)
					}
				}, 500) // Увеличиваем время ожидания до 500мс

				return () => clearTimeout(timeout)
			}
		}
	}, [isDev, telegramUser])

	// Показываем загрузку только первые 500мс
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
		// Эта функция используется только в production режиме
		if (!isDev && authUser && authUser.id) {
			setUser({
				id: authUser.id,
				firstName: authUser.first_name,
				lastName: authUser.last_name,
				username: authUser.username,
			})
			devLog.success('Telegram auth successful:', authUser)
		} else if (!isDev) {
			console.error('❌ Invalid user data received from Telegram widget')
		}
	}

	// Показываем форму входа, если пользователь не аутентифицирован
	// В dev режиме это не должно происходить, но добавляем защиту
	if (!user || !user.id) {
		// В production режиме проверяем различные способы открытия
		if (!isDev) {
			// Отладочная информация
			console.log('=== Telegram App Debug Info ===')
			console.log('URL:', window.location.href)
			console.log('Referrer:', document.referrer)
			console.log('User Agent:', navigator.userAgent)
			console.log('Telegram WebApp available:', !!window.Telegram?.WebApp)
			console.log('Telegram initData:', window.Telegram?.WebApp?.initData)
			console.log(
				'Parent window:',
				window.parent === window ? 'same' : 'different'
			)
			console.log('Search params:', window.location.search)

			// Проверяем открыт ли в Telegram (WebApp или обычная веб-страница)
			const isInTelegramWebApp = window.Telegram?.WebApp?.initData
			const isInTelegramWeb =
				window.location.href.includes('t.me') ||
				window.location.href.includes('telegram') ||
				navigator.userAgent.includes('Telegram') ||
				document.referrer.includes('t.me') ||
				document.referrer.includes('telegram') ||
				window.parent !== window || // Открыто в iframe
				window.location.search.includes('tgWebAppPlatform') // Telegram WebApp параметр

			console.log('Is in Telegram WebApp:', isInTelegramWebApp)
			console.log('Is in Telegram Web:', isInTelegramWeb)
			console.log('=== End Debug Info ===')

			// Агрессивный fallback: если это не точно внешний браузер, показываем карту
			const isExternalBrowser =
				!isInTelegramWebApp &&
				!isInTelegramWeb &&
				!window.location.hostname.includes('localhost') &&
				!window.location.hostname.includes('127.0.0.1') &&
				window.parent === window && // Не в iframe
				!document.referrer // Нет referrer

			console.log('Is external browser:', isExternalBrowser)

			if (!isExternalBrowser) {
				// Создаем временного пользователя для работы без авторизации
				const tempUser = {
					id: Math.floor(Math.random() * 1000000), // Случайный временный ID
					firstName: 'TelegramUser',
					lastName: '',
					username: 'telegram_user',
				}

				devLog.info('Using temporary user for Telegram access:', {
					isInTelegramWebApp,
					isInTelegramWeb,
				})

				return (
					<QueryClientProvider client={queryClient}>
						<ChakraProvider>
							{/* Индикатор временного доступа */}
							<div
								style={{
									position: 'fixed',
									top: '10px',
									right: '10px',
									backgroundColor: '#00A8FF',
									color: 'white',
									padding: '4px 8px',
									borderRadius: '4px',
									fontSize: '12px',
									fontWeight: 'bold',
									zIndex: 10000,
									boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
								}}
							>
								📱 Telegram
							</div>
							<HashRouter>
								<Routes>
									<Route
										path='/'
										element={<UserMap userId={tempUser.id} admins={adminIds} />}
									/>
									<Route
										path='/weekly-stats'
										element={<WeeklyStats userId={tempUser.id} />}
									/>
									<Route
										path='/top-users'
										element={
											<TopUsers userId={tempUser.id} admins={adminIds} />
										}
									/>
									<Route path='*' element={<Navigate to='/' replace />} />
								</Routes>
								<NavBar />
							</HashRouter>
						</ChakraProvider>
					</QueryClientProvider>
				)
			}

			// Обычный режим с виджетом авторизации для внешних браузеров
			return (
				<ChakraProvider>
					<div
						style={{
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							height: '100vh',
						}}
					>
						<TelegramLoginWidget
							botName={config.telegramBotName}
							onAuth={handleAuth}
						/>
					</div>
				</ChakraProvider>
			)
		} else {
			// В dev режиме показываем сообщение о загрузке
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
						<div>🛠️ Loading development user...</div>
					</div>
				</ChakraProvider>
			)
		}
	}

	return (
		<QueryClientProvider client={queryClient}>
			<ChakraProvider>
				{/* Индикатор режима разработки */}
				{config.showDevIndicator && (
					<div
						style={{
							position: 'fixed',
							top: '10px',
							right: '10px',
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
							element={<UserMap userId={user?.id} admins={adminIds} />}
						/>
						<Route
							path='/weekly-stats'
							element={<WeeklyStats userId={user?.id} />}
						/>
						<Route
							path='/top-users'
							element={<TopUsers userId={user?.id} admins={adminIds} />}
						/>
						<Route path='*' element={<Navigate to='/' replace />} />
					</Routes>
					<NavBar />
				</HashRouter>
			</ChakraProvider>
		</QueryClientProvider>
	)
}

export default App
