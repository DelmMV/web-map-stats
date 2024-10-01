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
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react'
import { FaLocationArrow, FaUsers } from 'react-icons/fa'
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
import {
	customAutoChargerIcon,
	customChatIcon,
	customDangerIcon,
	customIconSvgCharger,
	customIconSvgCharger24,
	customIconSvgRange,
	customInterestingIcon,
} from './components/CustomIcon'
import CustomZoomControl from './components/CustomZoomControl'
import HeatmapLayer from './components/HeatmapLayer'
import MarkerClusterGroup from './components/MarkerClusterGroup'
import MarkerFilterControl from './components/MarkerFilterControl'
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

const AddStationModal = React.lazy(() => import('./components/AddStationModal'))
const EditStationModal = React.lazy(() =>
	import('./components/EditStationModal')
)
const StationModal = React.lazy(() => import('./components/StationModal'))
const DrawerMenu = React.lazy(() => import('./components/DrawerMenu'))

// Constants
const GEOLOCATION_OPTIONS = {
	enableHighAccuracy: true,
	timeout: 5000,
	maximumAge: 0,
}
const DEFAULT_MAP_CENTER = [59.938676, 30.314487]
const DEFAULT_MAP_ZOOM = 10
const HEATMAP_DEBOUNCE_TIME = 300

const UserMap = ({ userId, admins }) => {
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

	const { data: activeUsers, isLoading: isActiveUsersLoading, error: activeUsersError } = useActiveUsers();

	const [showActiveUsers, setShowActiveUsers] = useState(false)

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

	const [markerFilters, setMarkerFilters] = useState({
		charging: true,
		chargingAuto: true,
		interesting: true,
		danger: true,
		chat: true,
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

	const handleFilterChange = useCallback(newFilters => {
		setMarkerFilters(newFilters)
	}, [])

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
					title: 'Станция оновлена',
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

	const startIcon = useMemo(() => customIconSvgRange('blue'), [])
	const endIcon = useMemo(() => customIconSvgRange('red'), [])
	const chargingStationIcon = useMemo(() => customIconSvgCharger(), [])
	const chargingStationIcon24 = useMemo(() => customIconSvgCharger24(), [])
	const chargingStationAutoIcon = useMemo(() => customAutoChargerIcon(), [])
	const interestingIcon = useMemo(() => customInterestingIcon(), [])
	const dangerIcon = useMemo(() => customDangerIcon(), [])
	const chatIcon = useMemo(() => customChatIcon(), [])

	const getMarkerIcon = useCallback(
		station => {
			switch (station.markerType) {
				case 'charging':
					return station.is24Hours ? chargingStationIcon24 : chargingStationIcon
				case 'chargingAuto':
					return chargingStationAutoIcon
				case 'interesting':
					return interestingIcon
				case 'danger':
					return dangerIcon
				case 'chat':
					return chatIcon
				default:
					return chargingStationIcon
			}
		},
		[
			chargingStationIcon,
			chargingStationIcon24,
			chargingStationAutoIcon,
			interestingIcon,
			dangerIcon,
			chatIcon,
		]
	)

	const stationMarkers = useMemo(() => {
		return filteredChargingStations.map(station => (
			<Marker
				key={station._id}
				position={[station.latitude, station.longitude]}
				icon={getMarkerIcon(station)}
				eventHandlers={{
					click: () => {
						setSelectedStation(station)
						onStationModalOpen()
					},
				}}
			/>
		))
	}, [filteredChargingStations, getMarkerIcon, onStationModalOpen])

	const MapEvents = () => {
		useMapEvents({
			click: e => {
				if (isAddingStation) {
					handleMapClick(e.latlng)
				}
			},
		})
		return null
	}

	const userIcon = L.divIcon({
		className: 'user-marker',
		html: '<div style="background-color: blue; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>',
		iconSize: [14, 14],
		iconAnchor: [7, 7],
	})

	return (
		<Box
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

					{showChargingStations && filteredChargingStations.length > 0 && (
						<MarkerClusterGroup>{stationMarkers}</MarkerClusterGroup>
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
							<Marker
								key={user.userId}
								position={[user.latitude, user.longitude]}
								icon={L.divIcon({
									className: 'active-user-marker',
									html: `
										<div style="display: flex; flex-direction: column; align-items: center;">
											<div style="width: 45px; height: 45px; border-radius: 50%; overflow: hidden; border: 2px solid white;">
												<img src="${user.avatarUrl || '/pwa-192.png'}" alt="${user.username}" style="width: 100%; height: 100%; object-fit: cover;">
											</div>
											<div style="background-color: rgba(255, 255, 255, 0.7); padding: 2px 4px; border-radius: 3px; margin-top: 2px; font-size: 10px;">
												${user.username || 'Пользователь'}
												${user.averageSpeed.toFixed(0)} км/ч
											</div>
										</div>
									`,
									iconSize: [40, 50],
									iconAnchor: [20, 50],
								})}
							>
								<Popup>
									Активный пользователь: {user.username || 'Неизвестный'}
									<br />
									Последняя активность: {new Date(user.lastActive * 1000).toLocaleString()}
								</Popup>
							</Marker>
						))}

					<MapEvents />
					{showChargingStations && (
						<MarkerFilterControl onFilterChange={handleFilterChange} />
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
					aria-label='Опред��лить местоположение'
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
			</Suspense>
		</Box>
	)
}

export default React.memo(UserMap)