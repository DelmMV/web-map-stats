import { AddIcon, HamburgerIcon } from '@chakra-ui/icons'
import {
	Box,
	Drawer,
	DrawerBody,
	DrawerCloseButton,
	DrawerContent,
	DrawerHeader,
	DrawerOverlay,
	IconButton,
	useDisclosure,
	useToast,
} from '@chakra-ui/react'
import imageCompression from 'browser-image-compression'
import haversine from 'haversine-distance'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'
import React, {
	Suspense,
	lazy,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react'
import { FaCloudSun, FaLocationArrow, FaUsers } from 'react-icons/fa'
import { HiLocationMarker } from 'react-icons/hi'
import {
	LayersControl,
	MapContainer,
	Marker,
	Polyline,
	Popup,
	TileLayer,
	useMapEvents,
} from 'react-leaflet'
import HeatmapLayer from './components/HeatmapLayer'
import MarkerFilterControl from './components/MarkerFilterControl'
import {
	createCharging24Marker,
	createChargingAutoMarker,
	createChargingMarker,
	createChatMarker,
	createDangerMarker,
	createInterestingMarker,
	createRouteEndMarker,
	createRouteStartMarker,
	createUserMarker,
	createWorkshopMarker,
} from './components/ModernMarkerIcon'
import WeatherLayer from './components/WeatherLayer'
import WeatherWidget from './components/WeatherWidget'
import routesReducer from './hooks/routesReducer'
import { useTelegramUser } from './hooks/useTelegramUser'

import { debounce } from 'lodash'
import {
	addChargingStation,
	deleteChargingStation,
	fetchChargingStations,
	updateChargingStation,
} from './services/chargingStationService'
import { fetchHeatmapData } from './services/heatmapService'
import { fetchRoute } from './services/routeService'
import { useActiveUsers } from './services/userService'

const DrawerMenu = lazy(() => import('./components/DrawerMenu'))
const AddStationModal = lazy(() => import('./components/AddStationModal'))
const EditStationModal = lazy(() => import('./components/EditStationModal'))
const StationModal = lazy(() => import('./components/StationModal'))
const WorkshopModalLazy = lazy(() => import('./components/WorkshopModal'))

// Constants
const GEOLOCATION_OPTIONS = {
	enableHighAccuracy: true,
	timeout: 5000,
	maximumAge: 0,
}
const DEFAULT_MAP_CENTER = [59.938676, 30.314487]
const DEFAULT_MAP_ZOOM = 10
const HEATMAP_DEBOUNCE_TIME = 300

// Оптимизированный компонент маркера для предотвращения ненужных перерисовок
const OptimizedMarker = memo(
	({ marker }) => {
		const [isPopupOpen, setIsPopupOpen] = useState(false)

		// Обработка открытия/закрытия попапа
		const handlePopupOpen = useCallback(() => {
			setIsPopupOpen(true)
		}, [])

		const handlePopupClose = useCallback(() => {
			setIsPopupOpen(false)
		}, [])

		// Создаем event handlers с мемоизацией
		const eventHandlers = useMemo(
			() => ({
				click: () => {
					if (marker.markerType === 'workshop') {
						setIsPopupOpen(true)
					} else {
						marker.onClick()
					}
				},
			}),
			[marker]
		)

		// Создаем опции маркера
		const markerOptions = useMemo(
			() => ({
				icon: marker.icon,
			}),
			[marker.icon]
		)

		return (
			<Marker
				position={[marker.latitude, marker.longitude]}
				eventHandlers={eventHandlers}
				{...markerOptions}
			>
				{marker.markerType === 'workshop' && (
					<Popup
						autoPan={true}
						closeOnClick={true}
						autoClose={true}
						closeOnEscapeKey={true}
						closeButton={true}
						maxWidth={300}
						onOpen={handlePopupOpen}
						onClose={handlePopupClose}
					>
						<div>
							<strong>{marker.name}</strong>
							<br />
							{marker.address}
							{isPopupOpen && (
								<div style={{ marginTop: '8px' }}>
									<button
										onClick={marker.onClick}
										style={{
											padding: '4px 8px',
											backgroundColor: '#4299e1',
											color: 'white',
											border: 'none',
											borderRadius: '4px',
											cursor: 'pointer',
											fontSize: '12px',
										}}
									>
										Подробнее
									</button>
								</div>
							)}
						</div>
					</Popup>
				)}
			</Marker>
		)
	},
	(prevProps, nextProps) => {
		// Оптимизация: ре-рендерим только если изменились ключевые свойства
		return (
			prevProps.marker._id === nextProps.marker._id &&
			prevProps.marker.latitude === nextProps.marker.latitude &&
			prevProps.marker.longitude === nextProps.marker.longitude &&
			prevProps.marker.markerType === nextProps.marker.markerType
		)
	}
)

// Оптимизированный компонент маркера активного пользователя
const OptimizedActiveUserMarker = memo(
	({ user }) => {
		// Мемоизируем иконку пользователя
		const userIcon = useMemo(() => {
			return L.divIcon({
				className: 'active-user-marker',
				html: `
					<div style="display: flex; flex-direction: column; align-items: center;">
					<div style="width: 45px; height: 45px; border-radius: 50%; overflow: hidden; border: 2px solid white; background-image: url('/pwa-192.png'); background-size: cover;">
                      <img 
                        src="${user.avatarUrl}" 
                        alt="${user.username}" 
                        style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.3s;"
                        onload="this.style.opacity = 1;"
                        onerror="this.style.display = 'none';"
                      >
                  </div>
					<div style="background-color: rgba(255, 255, 255, 0.7); padding: 2px 4px; border-radius: 3px; margin-top: 2px; font-size: 10px;">
						${user.username || 'Пользователь'}
						${user.averageSpeed.toFixed(0)} км/ч
					</div>
					</div>
				`,
				iconSize: [40, 50],
				iconAnchor: [20, 50],
			})
		}, [user.avatarUrl, user.username, user.averageSpeed])

		return (
			<Marker position={[user.latitude, user.longitude]} icon={userIcon}>
				<Popup>
					Активный пользователь: {user.username || 'Неизвестный'}
					<br />
					Последняя активность:{' '}
					{new Date(user.lastActive * 1000).toLocaleString()}
				</Popup>
			</Marker>
		)
	},
	(prevProps, nextProps) => {
		// Ре-рендерим только если изменились ключевые свойства пользователя
		return (
			prevProps.user.userId === nextProps.user.userId &&
			prevProps.user.latitude === nextProps.user.latitude &&
			prevProps.user.longitude === nextProps.user.longitude &&
			prevProps.user.averageSpeed === nextProps.user.averageSpeed &&
			prevProps.user.lastActive === nextProps.user.lastActive &&
			prevProps.user.username === nextProps.user.username &&
			prevProps.user.avatarUrl === nextProps.user.avatarUrl
		)
	}
)

const UserMap = ({ userId, admins }) => {
	// Защита от undefined userId
	if (!userId) {
		return (
			<div
				style={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100vh',
				}}
			>
				Loading user data...
			</div>
		)
	}

	const user = useTelegramUser()

	const today = new Date().toISOString().split('T')[0]
	const [routesState, dispatch] = useReducer(routesReducer, {
		data: {},
		distances: {},
		visibleSessions: {},
	})
	const [dateRange, setDateRange] = useState({ start: today, end: today })
	const [status, setStatus] = useState({ loading: false, error: null })

	const [chargingStations, setChargingStations] = useState([])
	const [showChargingStations, setShowChargingStations] = useState(() => {
		return JSON.parse(localStorage.getItem('showChargingStations') || 'false')
	})
	const [showHeatmap, setShowHeatmap] = useState(false)
	const [heatmapData, setHeatmapData] = useState([])
	const [heatmapStatus, setHeatmapStatus] = useState({
		loading: false,
		error: null,
	})
	const [heatmapPeriod, setHeatmapPeriod] = useState('this_month')
	const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear())
	const [heatmapMonth, setHeatmapMonth] = useState(new Date().getMonth() + 1)

	const {
		data: activeUsers,
		isLoading: isActiveUsersLoading,
		error: activeUsersError,
	} = useActiveUsers()

	const [showActiveUsers, setShowActiveUsers] = useState(false)

	// Состояния для погоды
	const [showWeather, setShowWeather] = useState(() => {
		return JSON.parse(localStorage.getItem('showWeather') || 'false')
	})
	const [showWeatherWidget, setShowWeatherWidget] = useState(() => {
		return JSON.parse(localStorage.getItem('showWeatherWidget') || 'true')
	})

	const [newStation, setNewStation] = useState(null)
	const [isAddingStation, setIsAddingStation] = useState(false)
	const [editingStation, setEditingStation] = useState(null)
	const [selectedStation, setSelectedStation] = useState(null)
	const {
		isOpen: isStationModalOpen,
		onOpen: onStationModalOpen,
		onClose: onStationModalClose,
	} = useDisclosure()
	const {
		isOpen: isAddOpen,
		onOpen: onAddOpen,
		onClose: onAddClose,
	} = useDisclosure()
	const {
		isOpen: isEditOpen,
		onOpen: onEditOpen,
		onClose: onEditClose,
	} = useDisclosure()
	const {
		isOpen: isDrawerOpen,
		onOpen: onDrawerOpen,
		onClose: onDrawerClose,
	} = useDisclosure()
	const toast = useToast()
	const isAdmin = admins.includes(userId)
	const carouselRef = useRef(null)
	const mapRef = useRef(null)

	const [mapLayer, setMapLayer] = useState(() => {
		return localStorage.getItem('mapLayer') || 'default'
	})

	const [selectedWorkshop, setSelectedWorkshop] = useState(null)
	const {
		isOpen: isWorkshopModalOpen,
		onOpen: onWorkshopModalOpen,
		onClose: onWorkshopModalClose,
	} = useDisclosure()

	const [mapBounds, setMapBounds] = useState(null)

	// Добавляем эффект для синхронизации состояния с localStorage
	useEffect(() => {
		const handleStorageChange = () => {
			const storedLayer = localStorage.getItem('mapLayer')
			if (storedLayer && storedLayer !== mapLayer) {
				setMapLayer(storedLayer)
			}
		}

		window.addEventListener('storage', handleStorageChange)

		return () => {
			window.removeEventListener('storage', handleStorageChange)
		}
	}, [mapLayer])

	const handleMapLayerChange = useCallback(newLayer => {
		setMapLayer(newLayer)
		localStorage.setItem('mapLayer', newLayer)
	}, [])

	const toggleActiveUsers = useCallback(() => {
		setShowActiveUsers(prev => !prev)
	}, [])

	const toggleWeather = useCallback(() => {
		setShowWeather(prev => {
			const newValue = !prev
			localStorage.setItem('showWeather', JSON.stringify(newValue))
			return newValue
		})
	}, [])

	const toggleWeatherWidget = useCallback(() => {
		setShowWeatherWidget(prev => {
			const newValue = !prev
			localStorage.setItem('showWeatherWidget', JSON.stringify(newValue))
			return newValue
		})
	}, [])

	// Инициализируем состояние фильтров из localStorage
	const [markerFilters, setMarkerFilters] = useState(() => {
		const savedFilters = localStorage.getItem('markerFilters')
		return savedFilters
			? JSON.parse(savedFilters)
			: {
					charging: true,
					chargingAuto: true,
					interesting: true,
					danger: true,
					chat: true,
					workshop: true,
			  }
	})

	const [userPosition, setUserPosition] = useState(null)
	const [geoPermission, setGeoPermission] = useState(() => {
		return localStorage.getItem('geoPermission') || 'unknown'
	})

	const requestGeolocation = useCallback(() => {
		if ('geolocation' in navigator) {
			navigator.geolocation.getCurrentPosition(
				position => {
					const newPosition = [
						position.coords.latitude,
						position.coords.longitude,
					]
					setUserPosition(newPosition)
					setGeoPermission('granted')
					localStorage.setItem('geoPermission', 'granted')

					// Центрируем карту сразу после получения геолокации
					if (mapRef.current) {
						mapRef.current.setView(newPosition, 15)
					}

					toast({
						title: 'Местоположение определено',
						status: 'success',
						duration: 2000,
						isClosable: true,
					})
				},
				error => {
					console.error('Error getting location:', error)
					setGeoPermission('denied')
					localStorage.setItem('geoPermission', 'denied')
					toast({
						title: 'Ошибка определения местоположения',
						description:
							'Пожалуйста, разрешите доступ к геолокации в настройках браузера.',
						status: 'error',
						duration: 2000,
						isClosable: true,
					})
				},
				GEOLOCATION_OPTIONS
			)
		}
	}, [toast])

	const centerOnUser = useCallback(() => {
		if (userPosition) {
			if (mapRef.current) {
				mapRef.current.setView(userPosition, 15)
			}
		} else {
			requestGeolocation()
		}
	}, [userPosition, requestGeolocation])

	useEffect(() => {
		if (userPosition && mapRef.current) {
			mapRef.current.setView(userPosition, 15)
		}
	}, [userPosition])

	useEffect(() => {
		localStorage.setItem(
			'showChargingStations',
			JSON.stringify(showChargingStations)
		)
	}, [showChargingStations])

	const toggleChargingStations = useCallback(() => {
		setShowChargingStations(prev => !prev)
	}, [])

	// const handleFilterChange = useCallback(newFilters => {
	// 	setMarkerFilters(newFilters)
	// }, [])

	const filteredChargingStations = useMemo(() => {
		return chargingStations.filter(
			station =>
				markerFilters[station.markerType] &&
				(isAdmin ||
					typeof station.dislikes === 'undefined' ||
					station.dislikes < 5)
		)
	}, [chargingStations, markerFilters, isAdmin])

	const fetchChargingStationsData = useCallback(async () => {
		try {
			const data = await fetchChargingStations()
			setChargingStations(data)
		} catch (error) {
			console.error('Error fetching charging stations:', error)
			toast({
				title: 'Ошибка загрузки станций',
				description: error.message,
				status: 'error',
				duration: 5000,
				isClosable: true,
			})
		}
	}, [toast])

	useEffect(() => {
		fetchChargingStationsData()
	}, [fetchChargingStationsData])

	const fetchHeatmapDataCallback = useCallback(async () => {
		setHeatmapStatus({ loading: true, error: null })
		try {
			const data = await fetchHeatmapData(
				heatmapPeriod,
				heatmapYear,
				heatmapMonth
			)
			if (Array.isArray(data) && data.length > 0) {
				setHeatmapData(
					data.map(point => [point.latitude, point.longitude, point.intensity])
				)
				setHeatmapStatus({ loading: false, error: null })
			} else {
				setHeatmapStatus({
					loading: false,
					error: 'Нет данных для тепловой карт за выбранный период',
				})
			}
		} catch (error) {
			console.error('Error fetching heatmap data:', error)
			setHeatmapStatus({ loading: false, error: error.message })
		}
	}, [heatmapPeriod, heatmapYear, heatmapMonth])

	const debouncedFetchHeatmapData = useCallback(
		debounce(fetchHeatmapDataCallback, HEATMAP_DEBOUNCE_TIME),
		[fetchHeatmapDataCallback]
	)

	useEffect(() => {
		if (showHeatmap) {
			debouncedFetchHeatmapData()
		}
	}, [showHeatmap, debouncedFetchHeatmapData])

	const processRouteData = useCallback(data => {
		const groupedRoutes = data.reduce((acc, point) => {
			const sessionId = point.sessionId
			if (!acc[sessionId]) {
				acc[sessionId] = []
			}
			acc[sessionId].push(point)
			return acc
		}, {})

		const distances = Object.keys(groupedRoutes).reduce((acc, sessionId) => {
			acc[sessionId] = groupedRoutes[sessionId].reduce(
				(totalDistance, point, index, array) => {
					if (index === 0) return totalDistance
					const prevPoint = array[index - 1]
					const currentDistance = haversine(
						{ lat: prevPoint.latitude, lon: prevPoint.longitude },
						{ lat: point.latitude, lon: point.longitude }
					)
					return totalDistance + currentDistance
				},
				0
			)
			return acc
		}, {})

		return { groupedRoutes, distances }
	}, [])

	const fetchRouteData = useCallback(async () => {
		const { start, end } = dateRange
		setStatus({ loading: true, error: null })
		dispatch({ type: 'CLEAR_ROUTES' })

		try {
			const startDate = new Date(start)
			const endDate = new Date(end)
			endDate.setHours(23, 59, 59, 999)

			const data = await fetchRoute(userId, startDate, endDate)
			if (data.length === 0) {
				setStatus({
					loading: false,
					error: 'Маршрут не найден для указанного периода',
				})
			} else {
				const { groupedRoutes, distances } = processRouteData(data)
				dispatch({
					type: 'SET_ROUTES',
					payload: { data: groupedRoutes, distances },
				})
			}
			setStatus({ loading: false, error: null })
		} catch (error) {
			toast({
				position: 'top-right',
				title: error.message,
				status: 'info',
				duration: 3000,
				isClosable: true,
			})
			console.error('Error fetching route:', error)
			setStatus({ loading: false, error: error.message })
			dispatch({ type: 'CLEAR_ROUTES' })
		}
	}, [userId, dateRange, toast, processRouteData])

	useEffect(() => {
		if (dateRange.start && dateRange.end) {
			fetchRouteData()
		}
	}, [fetchRouteData])

	const handleDateChange = useCallback(e => {
		const { name, value } = e.target
		setDateRange(prev => ({ ...prev, [name]: value }))
	}, [])

	const handleSearch = useCallback(
		e => {
			e.preventDefault()

			const startDate = new Date(dateRange.start)
			const endDate = new Date(dateRange.end)
			endDate.setHours(23, 59, 59, 999)

			if (startDate > endDate) {
				setStatus({
					loading: false,
					error: 'Дата начала должна быть раньше или равна дате окончания',
				})
				return
			}

			setDateRange({
				start: startDate.toISOString().split('T')[0],
				end: endDate.toISOString().split('T')[0],
			})

			fetchRouteData()
		},
		[dateRange, fetchRouteData]
	)

	const toggleSession = useCallback(sessionId => {
		dispatch({ type: 'TOGGLE_SESSION', payload: sessionId })
	}, [])

	const handleHeatmapPeriodChange = useCallback(e => {
		setHeatmapPeriod(e.target.value)
		if (e.target.value === 'this_year') {
			setHeatmapYear(new Date().getFullYear())
		} else {
			setHeatmapYear(new Date().getFullYear())
			setHeatmapMonth(new Date().getMonth() + 1)
		}
	}, [])

	const handleAddStationClick = useCallback(() => {
		setIsAddingStation(true)
	}, [])

	const handleMapClick = useCallback(
		latlng => {
			if (isAddingStation) {
				setNewStation(latlng)
				setIsAddingStation(false)
				onAddOpen()
			}
		},
		[isAddingStation, onAddOpen]
	)

	const handleEditStation = useCallback(
		station => {
			setEditingStation(station)
			onStationModalClose()
			onEditOpen()
		},
		[onStationModalClose, onEditOpen]
	)

	const handleDeleteStation = useCallback(
		async stationId => {
			onStationModalClose()
			try {
				await deleteChargingStation(stationId)
				await fetchChargingStationsData()
				toast({
					position: 'top-right',
					title: 'Станция удалена',
					status: 'success',
					duration: 3000,
					isClosable: true,
				})
			} catch (error) {
				console.error('Error deleting charging station:', error)
				toast({
					position: 'top-right',
					title: 'Ошибка при удалении станции',
					status: 'error',
					duration: 3000,
					isClosable: true,
				})
			}
		},
		[onStationModalClose, fetchChargingStationsData, toast]
	)

	const compressImage = async file => {
		const options = {
			maxSizeMB: 1,
			maxWidthOrHeight: 1920,
			useWebWorker: true,
		}

		try {
			return await imageCompression(file, options)
		} catch (error) {
			console.error('Error compressing image:', error)
			return file
		}
	}

	const handleSaveStation = useCallback(
		async stationData => {
			if (!newStation) return

			if (!user) {
				console.error('Данные пользователя недоступны')
				toast({
					position: 'top-right',
					title: 'Ошибка: данные пользователя недоступны',
					status: 'error',
					duration: 3000,
					isClosable: true,
				})
				return
			}
			console.log(user.id)
			const formData = new FormData()
			formData.append('latitude', newStation.lat)
			formData.append('longitude', newStation.lng)
			formData.append('is24Hours', stationData.is24Hours)
			formData.append('markerType', stationData.markerType)
			formData.append('comment', stationData.comment)
			formData.append('userId', userId)
			formData.append(
				'addedBy',
				JSON.stringify({
					id: user.id,
					name: `${
						user.firstName && user.lastName
							? `${user.firstName} ${user.lastName}`
							: user.firstName
							? user.firstName
							: user.lastName
					}`,
					username: user.username,
				})
			)
			formData.append('addedAt', new Date().toISOString())
			if (stationData.photo) {
				const compressedPhoto = await compressImage(stationData.photo)
				formData.append('photo', compressedPhoto)
			}

			try {
				await addChargingStation(formData)
				await fetchChargingStationsData()
				setNewStation(null)
				onAddClose()
				toast({
					position: 'top-right',
					title: 'Станция добавлена',
					status: 'success',
					duration: 3000,
					isClosable: true,
				})
			} catch (error) {
				console.error('Error adding charging station:', error)
				toast({
					position: 'top-right',
					title: `Ошибка при добавлении станции ${error}`,
					status: 'error',
					duration: 3000,
					isClosable: true,
				})
			}
		},
		[newStation, userId, fetchChargingStationsData, onAddClose, toast, user]
	)

	const handleUpdateStation = useCallback(
		async updatedData => {
			if (!editingStation) return

			const formData = new FormData()
			formData.append('latitude', editingStation.latitude)
			formData.append('longitude', editingStation.longitude)
			formData.append('is24Hours', updatedData.is24Hours)
			formData.append('markerType', updatedData.markerType)
			formData.append('comment', updatedData.comment)
			formData.append('userId', userId)
			if (updatedData.photo) {
				const compressedPhoto = await compressImage(updatedData.photo)
				formData.append('photo', compressedPhoto)
			}

			try {
				await updateChargingStation(editingStation._id, formData)
				await fetchChargingStationsData()
				setEditingStation(null)
				onEditClose()
				toast({
					position: 'top-right',
					title: 'Станция обновлена',
					status: 'success',
					duration: 3000,
					isClosable: true,
				})
			} catch (error) {
				console.error('Error updating charging station:', error)
				toast({
					position: 'top-right',
					title: 'Ошибка при обновлении станции',
					status: 'error',
					duration: 3000,
					isClosable: true,
				})
			}
		},
		[editingStation, userId, fetchChargingStationsData, onEditClose, toast]
	)

	const handleScroll = useCallback(direction => {
		if (carouselRef.current) {
			const scrollAmount = direction === 'left' ? -200 : 200
			carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
		}
	}, [])

	const sessionColors = useMemo(() => {
		if (!routesState.data || Object.keys(routesState.data).length === 0)
			return []

		return Object.keys(routesState.data).map((_, idx) => {
			const hue = (idx * 60) % 360
			return `hsl(${hue}, 100%, 30%)`
		})
	}, [routesState.data])

	const activeSessions = useMemo(() => {
		return Object.keys(routesState.visibleSessions).filter(
			sessionId => routesState.visibleSessions[sessionId]
		)
	}, [routesState.visibleSessions])

	const totalActiveDistance = useMemo(() => {
		return activeSessions.reduce((total, sessionId) => {
			return total + (routesState.distances[sessionId] || 0)
		}, 0)
	}, [activeSessions, routesState.distances])

	const startIcon = useMemo(() => createRouteStartMarker('#4285f4'), [])
	const endIcon = useMemo(() => createRouteEndMarker('#EA4335'), [])

	// Локации для отображения погоды (районы и пригороды Санкт-Петербурга)
	const weatherLocations = useMemo(
		() => [
			// Пригороды
			{
				id: 'murino',
				lat: 60.057,
				lon: 30.4306,
				name: 'Мурино',
			},
			{
				id: 'pargolobo',
				lat: 60.1089,
				lon: 30.2958,
				name: 'Парголово',
			},
			{
				id: 'sestroretsk',
				lat: 60.1004,
				lon: 29.9608,
				name: 'Сестрорецк',
			},
			{
				id: 'shushary',
				lat: 59.7528,
				lon: 30.3281,
				name: 'Шушары',
			},
			{
				id: 'kolpino',
				lat: 59.7506,
				lon: 30.5931,
				name: 'Колпино',
			},
			{
				id: 'pushkin',
				lat: 59.7142,
				lon: 30.3936,
				name: 'Пушкин',
			},
			{
				id: 'petergof',
				lat: 59.8842,
				lon: 29.9089,
				name: 'Петергоф',
			},
			{
				id: 'kronshtadt',
				lat: 59.9911,
				lon: 29.7658,
				name: 'Кронштадт',
			},
			{
				id: 'kudrovo',
				lat: 59.9136,
				lon: 30.5119,
				name: 'Кудрово',
			},
			{
				//60.024647, 30.645621
				id: 'vsevolozhsk',
				lat: 60.0246,
				lon: 30.6456,
				name: 'Всеволожск',
			},
			// Районы Санкт-Петербурга
			{
				id: 'kalininskiy',
				lat: 59.9965,
				lon: 30.4006,
				name: 'Калининский район',
			},
			{
				id: 'primorskiy',
				lat: 60.0081,
				lon: 30.2084,
				name: 'Приморский район',
			},
			{
				//59.912381, 30.297154
				id: 'admiralteyskiy',
				lat: 59.9123,
				lon: 30.2971,
				name: 'Адмиралтейский район',
			},
			{
				//59.941562, 30.247963
				id: 'vasileostrovskiy',
				lat: 59.9415,
				lon: 30.2479,
				name: 'Василеостровский район',
			},
			{
				id: 'petrogradskiy',
				lat: 59.9606,
				lon: 30.3084,
				name: 'Петроградский район',
			},
			{
				id: 'nevskiy',
				lat: 59.9278,
				lon: 30.3609,
				name: 'Невский район',
			},
			{
				//60.032393, 30.330178
				id: 'vyborgskiy',
				lat: 60.0323,
				lon: 30.3301,
				name: 'Выборгский район',
			},
			{
				id: 'krasnogvardeyskiy',
				lat: 59.9561,
				lon: 30.4606,
				name: 'Красногвардейский район',
			},
			{
				//59.870031, 30.390721
				id: 'frunzenskiy',
				lat: 59.87,
				lon: 30.3907,
				name: 'Фрунзенский район',
			},
			{
				//59.876430, 30.257595
				id: 'kirovskiy',
				lat: 59.8764,
				lon: 30.2575,
				name: 'Кировский район',
			},
		],
		[]
	)

	const [workshops, setWorkshops] = useState([])

	// Добавляем загрузку мастерских
	useEffect(() => {
		const fetchWorkshops = async () => {
			try {
				const response = await fetch('https://api.monopiter.ru/api/workshops/')
				const data = await response.json()
				// Фильтруем только мастерские с координатами
				const workshopsWithCoords = data.filter(
					workshop => workshop.latitude && workshop.longitude
				)
				setWorkshops(workshopsWithCoords)
			} catch (error) {
				console.error('Error fetching workshops:', error)
			}
		}

		fetchWorkshops()
	}, [])

	// Сначала создаем мемоизированные иконки
	const icons = useMemo(
		() => ({
			charging: createChargingMarker(),
			charging24: createCharging24Marker(),
			chargingAuto: createChargingAutoMarker(),
			interesting: createInterestingMarker(),
			danger: createDangerMarker(),
			chat: createChatMarker(),
			workshop: createWorkshopMarker(),
		}),
		[]
	)

	// Затем создаем функцию получения иконок
	const getMarkerIcon = useCallback(
		station => {
			if (station.markerType === 'charging' && station.is24Hours) {
				return icons.charging24
			}
			return icons[station.markerType] || icons.charging
		},
		[icons]
	)

	const handleWorkshopClick = useCallback(
		workshop => {
			// Предотвращаем ненужные ререндеры при повторном клике на тот же маркер
			if (selectedWorkshop && selectedWorkshop._id === workshop._id) {
				return
			}
			setSelectedWorkshop(workshop)
			onWorkshopModalOpen()
		},
		[selectedWorkshop, onWorkshopModalOpen]
	)

	// Мемоизируем маркеры мастерских для предотвращения лишних перерисовок
	const workshopMarkers = useMemo(() => {
		return workshops
			.filter(() => markerFilters.workshop)
			.map(workshop => ({
				...workshop,
				markerType: 'workshop',
				icon: icons.workshop,
				onClick: () => handleWorkshopClick(workshop),
			}))
	}, [workshops, markerFilters.workshop, icons.workshop, handleWorkshopClick])

	// Фильтрация маркеров
	const filteredMarkers = useMemo(() => {
		const regularMarkers = filteredChargingStations
			.filter(
				station =>
					station.markerType !== 'workshop' &&
					markerFilters[station.markerType] &&
					(isAdmin ||
						typeof station.dislikes === 'undefined' ||
						station.dislikes < 5)
			)
			.map(station => ({
				...station,
				icon: getMarkerIcon(station),
				onClick: () => {
					setSelectedStation(station)
					onStationModalOpen()
				},
			}))

		return [...regularMarkers, ...workshopMarkers]
	}, [
		filteredChargingStations,
		workshopMarkers,
		markerFilters,
		isAdmin,
		getMarkerIcon,
		setSelectedStation,
		onStationModalOpen,
	])

	// Обработчик изменения границ карты
	const handleMapMoveEnd = useCallback(e => {
		const map = e.target
		setMapBounds(map.getBounds())
	}, [])

	// Функция для проверки, находится ли маркер в текущих границах карты
	const isMarkerInBounds = useCallback(
		marker => {
			if (!mapBounds) return true // Если границы не определены, отображаем все маркеры
			const latLng = L.latLng(marker.latitude, marker.longitude)
			return mapBounds.contains(latLng)
		},
		[mapBounds]
	)

	// Отфильтрованные маркеры, видимые в текущей области карты
	// Исключаем активных пользователей из фильтрации по границам, чтобы избежать мерцания
	const visibleMarkers = useMemo(() => {
		if (!mapBounds) return filteredMarkers
		return filteredMarkers.filter(isMarkerInBounds)
	}, [filteredMarkers, mapBounds, isMarkerInBounds])

	const MapEvents = () => {
		const map = useMapEvents({
			click: e => {
				if (isAddingStation) {
					handleMapClick(e.latlng)
				}
			},
			moveend: handleMapMoveEnd,
		})

		// Инициализация границ карты при первой загрузке
		useEffect(() => {
			if (map && !mapBounds) {
				setMapBounds(map.getBounds())
			}
		}, [map, mapBounds])

		return null
	}

	const userIcon = createUserMarker()

	return (
		<Box
			position='relative'
			display='flex'
			flexDirection='column'
			height='100vh'
			paddingBottom='50px'
		>
			<IconButton
				onClick={onDrawerOpen}
				position='absolute'
				top='10px'
				left='11px'
				zIndex={1000}
				icon={<HamburgerIcon />}
				borderWidth={2}
				borderRadius={4}
				borderColor='gray'
			/>

			<Drawer isOpen={isDrawerOpen} placement='right' onClose={onDrawerClose}>
				<DrawerOverlay>
					<DrawerContent
						borderBottomWidth={2}
						borderBottomRadius={6}
						borderBottomColor='black'
						bg='rgba(255, 255, 255, 0.8)'
						backdropFilter='blur(10px)'
					>
						<DrawerCloseButton />
						<DrawerHeader>Меню</DrawerHeader>
						<DrawerBody>
							<Suspense fallback={<div>Loading...</div>}>
								<DrawerMenu
									dateRange={dateRange}
									handleDateChange={handleDateChange}
									handleSearch={handleSearch}
									showHeatmap={showHeatmap}
									setShowHeatmap={setShowHeatmap}
									heatmapStatus={heatmapStatus}
									handleHeatmapPeriodChange={handleHeatmapPeriodChange}
									heatmapPeriod={heatmapPeriod}
									heatmapMonth={heatmapMonth}
									setHeatmapMonth={setHeatmapMonth}
									heatmapYear={heatmapYear}
									setHeatmapYear={setHeatmapYear}
									totalActiveDistance={totalActiveDistance}
									routesState={routesState}
									toggleSession={toggleSession}
									handleScroll={handleScroll}
									carouselRef={carouselRef}
								/>
							</Suspense>
						</DrawerBody>
					</DrawerContent>
				</DrawerOverlay>
			</Drawer>

			<Box
				flex='1'
				position='absolute'
				top='0'
				left='0'
				right='0'
				bottom='0'
				overflow='hidden'
			>
				<MapContainer
					center={DEFAULT_MAP_CENTER}
					zoom={DEFAULT_MAP_ZOOM}
					attributionControl={false}
					zoomControl={false}
					style={{ height: '100%', width: '100%' }}
					whenCreated={mapInstance => {
						mapRef.current = mapInstance
					}}
				>
					<LayersControl position='topright'>
						<LayersControl.BaseLayer
							checked={mapLayer === 'default'}
							name='Схема'
							onChange={() => handleMapLayerChange('default')}
						>
							<TileLayer
								url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
								attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
							/>
						</LayersControl.BaseLayer>

						<LayersControl.BaseLayer
							checked={mapLayer === 'bike'}
							name='Велосипедная'
							onChange={() => handleMapLayerChange('bike')}
						>
							<TileLayer
								url='https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=a02fc7da35c244579a5516d8938b8861'
								attribution='&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
							/>
						</LayersControl.BaseLayer>

						<LayersControl.BaseLayer
							checked={mapLayer === 'satellite'}
							name='Спутник'
							onChange={() => handleMapLayerChange('satellite')}
						>
							<TileLayer
								url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
								attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
							/>
						</LayersControl.BaseLayer>
					</LayersControl>

					{showChargingStations && (
						<>
							{visibleMarkers.map(marker => (
								<OptimizedMarker key={marker._id} marker={marker} />
							))}
						</>
					)}

					{Object.keys(routesState.data).map((sessionId, idx) => {
						if (!routesState.visibleSessions[sessionId]) return null
						const sessionRoute = routesState.data[sessionId]
						const sessionPositions = sessionRoute.map(point => [
							point.latitude,
							point.longitude,
						])
						const totalDistance = routesState.distances[sessionId]

						return (
							<React.Fragment key={sessionId}>
								<Polyline
									positions={sessionPositions}
									color={sessionColors[idx]}
									weight={3}
								/>

								<Marker position={sessionPositions[0]} icon={startIcon}>
									<Popup>{`Начало трека (Маршрут ${sessionId}): ${new Date(
										sessionRoute[0].timestamp * 1000
									).toLocaleString()}`}</Popup>
								</Marker>

								<Marker
									position={sessionPositions[sessionPositions.length - 1]}
									icon={endIcon}
								>
									<Popup>{`Конец трека (Маршрут ${sessionId}): ${new Date(
										sessionRoute[sessionRoute.length - 1].timestamp * 1000
									).toLocaleString()} \n Пробег: ${(
										totalDistance / 1000
									).toFixed(2)} км`}</Popup>
								</Marker>
							</React.Fragment>
						)
					})}

					{showHeatmap &&
						!heatmapStatus.loading &&
						!heatmapStatus.error &&
						heatmapData.length > 0 && <HeatmapLayer points={heatmapData} />}

					{userPosition && (
						<Marker position={userPosition} icon={userIcon}>
							<Popup>Вы здесь</Popup>
						</Marker>
					)}

					{showActiveUsers &&
						!isActiveUsersLoading &&
						!activeUsersError &&
						activeUsers &&
						activeUsers.map(user => (
							<OptimizedActiveUserMarker key={user.userId} user={user} />
						))}

					{showWeather && (
						<WeatherLayer
							locations={weatherLocations}
							isVisible={showWeather}
							mapBounds={mapBounds}
						/>
					)}

					<MapEvents />
					{showChargingStations && (
						<MarkerFilterControl
							filters={markerFilters}
							onFilterChange={setMarkerFilters}
						/>
					)}

					<Box position='absolute' top='81px' left='11px' zIndex={1000}>
						<IconButton
							onClick={toggleChargingStations}
							variant='solid'
							icon={<HiLocationMarker />}
							colorScheme={showChargingStations ? 'blue' : 'gray'}
							size='md'
							borderRadius={3}
							borderColor='gray'
							borderWidth={2}
							width='30px'
							padding='0'
						/>
					</Box>
					{showChargingStations && (
						<Box position='absolute' top='130px' left='11px' zIndex={1000}>
							<IconButton
								onClick={handleAddStationClick}
								isDisabled={isAddingStation}
								icon={<AddIcon />}
								colorScheme='gray'
								size='md'
								borderRadius={3}
								borderColor='gray'
								borderWidth={2}
							/>
						</Box>
					)}
				</MapContainer>

				{/* Погодный виджет */}
				{showWeatherWidget && userPosition && (
					<WeatherWidget
						lat={userPosition[0]}
						lon={userPosition[1]}
						isVisible={showWeatherWidget}
						position='top-right'
					/>
				)}
			</Box>

			{isAddingStation && (
				<Box
					fontSize={12}
					width='210px'
					position='absolute'
					top='75%'
					left='30%'
					backgroundColor='white'
					padding='10px'
					borderRadius='md'
					boxShadow='md'
					zIndex={1000}
				>
					Кликните на карту, чтобы добавить станцию
				</Box>
			)}

			<Box position='absolute' top='230px' left='11px' zIndex={1000}>
				<IconButton
					onClick={centerOnUser}
					icon={<FaLocationArrow />}
					colorScheme='blue'
					size='md'
					aria-label='Определить местоположение'
				/>
			</Box>

			<Box position='absolute' top='280px' left='11px' zIndex={1000}>
				<IconButton
					onClick={toggleActiveUsers}
					variant='solid'
					icon={<FaUsers />}
					colorScheme={showActiveUsers ? 'green' : 'gray'}
					size='md'
					borderRadius={3}
					borderColor='gray'
					borderWidth={2}
					width='30px'
					padding='0'
				/>
			</Box>

			<Box position='absolute' top='330px' left='11px' zIndex={1000}>
				<IconButton
					onClick={toggleWeather}
					variant='solid'
					icon={<FaCloudSun />}
					colorScheme={showWeather ? 'blue' : 'gray'}
					size='md'
					borderRadius={3}
					borderColor='gray'
					borderWidth={2}
					width='30px'
					padding='0'
					aria-label='Показать погоду'
				/>
			</Box>

			<Suspense fallback={<div>Loading...</div>}>
				<AddStationModal
					isOpen={isAddOpen}
					onClose={onAddClose}
					onSave={handleSaveStation}
				/>

				<EditStationModal
					isOpen={isEditOpen}
					onClose={onEditClose}
					onUpdate={handleUpdateStation}
					station={editingStation}
				/>

				<StationModal
					isOpen={isStationModalOpen}
					onClose={onStationModalClose}
					station={selectedStation}
					onEdit={handleEditStation}
					onDelete={handleDeleteStation}
					isAdmin={isAdmin}
					userId={userId}
				/>

				<Suspense fallback={<Box>Загрузка...</Box>}>
					<WorkshopModalLazy
						isOpen={isWorkshopModalOpen}
						onClose={onWorkshopModalClose}
						workshop={selectedWorkshop}
					/>
				</Suspense>
			</Suspense>
		</Box>
	)
}

export default React.memo(UserMap)
