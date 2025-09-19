import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
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

	const adminIds = [
		200885469, 900133683, 527549474, 294170514, 5550302390, 495310665,
	]

	// Telegram hooks (используются только в production)
	const telegramUser = useTelegramUser()
	useTelegramTheme() // Инициализация темы

	const [user, setUser] = useState(null)

	// Инициализация пользователя в зависимости от режима
	useEffect(() => {
		if (isDev) {
			// Development режим: используем пользователя из конфигурации
			const devUser = getDefaultUser()
			devLog.info('Development mode: using configured user', devUser)
			setUser(devUser)
		} else {
			// Production режим: ждем Telegram аутентификацию
			devLog.info('Production mode: waiting for Telegram authentication')
			if (telegramUser) {
				setUser(telegramUser)
			}
		}
	}, [isDev, telegramUser])

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
		// В production режиме показываем Telegram виджет
		if (!isDev) {
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
					</Routes>
					<NavBar />
				</HashRouter>
			</ChakraProvider>
		</QueryClientProvider>
	)
}

export default App
