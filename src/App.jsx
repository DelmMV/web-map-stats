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
import WeeklyStats from './WeeklyStats.jsx'

const queryClient = new QueryClient()

function App() {
	//const user = { id: 200885469 } // Example userId
	const adminIds = [
		200885469, 900133683, 527549474, 294170514, 5550302390, 495310665,
	]
	const telegramUser = useTelegramUser()
	useTelegramTheme() // Инициализация темы
	const [user, setUser] = useState(null)
	useEffect(() => {
		if (telegramUser) {
			setUser(telegramUser)
		}
	}, [telegramUser])

	const handleAuth = authUser => {
		if (authUser && authUser.id) {
			// setUser({
			// 	id: authUser.id,
			// 	firstName: authUser.first_name,
			// 	lastName: authUser.last_name,
			// 	username: authUser.username,
			// })
			console.log('Auth received:', authUser)
		} else {
			console.error('Invalid user data received from Telegram widget')
		}
	}

	if (!user || !user.id) {
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
					<TelegramLoginWidget botName='LampStatsBot' onAuth={handleAuth} />
				</div>
			</ChakraProvider>
		)
	}

	return (
		<QueryClientProvider client={queryClient}>
			<ChakraProvider>
				<HashRouter>
					<Routes>
						<Route
							path='/'
							element={<UserMap userId={user.id} admins={adminIds} />}
						/>
						<Route
							path='/weekly-stats'
							element={<WeeklyStats userId={user.id} />}
						/>
						<Route
							path='/top-users'
							element={<TopUsers userId={user.id} admins={adminIds} />}
						/>
					</Routes>
					<NavBar />
				</HashRouter>
			</ChakraProvider>
		</QueryClientProvider>
	)
}

export default App
