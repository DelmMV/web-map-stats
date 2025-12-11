import {
	Box,
	IconButton,
	Text,
	useBreakpointValue,
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
import { motion } from 'framer-motion'
import { FaLocationArrow, FaMapMarkedAlt, FaUsers } from 'react-icons/fa'
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
import MobileTooltip from './components/MobileTooltip'
import ModernMarkerClusterGroup from './components/ModernMarkerCluster'
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
import HeatmapControl from './components/HeatmapControl'
import routesReducer from './hooks/routesReducer'
import { useTelegramUser } from './hooks/useTelegramUser'
import { useSharedRoutesCatalog } from './hooks/useSharedRoutesCatalog'
import { resolveRouteAuthor } from './utils/routeFormatters'
import ManualRoutePanel from './components/ManualRoutePanel'
import DrawerMenuContainer from './components/DrawerMenuContainer'
import MapTopControls from './components/MapTopControls'
import { useManualRoutePanelState } from './hooks/useManualRoutePanelState'
import { useManualRouteState } from './hooks/useManualRouteState'
import { useManualRouteActions } from './hooks/useManualRouteActions'
import { useManualRouteEditing } from './hooks/useManualRouteEditing'
import { useManualRouteSaving } from './hooks/useManualRouteSaving'
import { useSidebarPosition } from './hooks/useSidebarPosition'
import { useDrawerMenuProps } from './hooks/useDrawerMenuProps'
import { useFloatingControlsPosition } from './hooks/useFloatingControlsPosition'
import {
	DEFAULT_MANUAL_ROUTE_COLOR,
	MANUAL_ROUTE_PROFILES,
	getManualRouteProfileConfig,
} from './utils/manualRouteProfiles'
import { useManualRouteDerived } from './hooks/useManualRouteDerived'

import { debounce } from 'lodash'
import {
	addChargingStation,
	deleteChargingStation,
	fetchChargingStations,
	updateChargingStation,
} from './services/chargingStationService'
import { fetchHeatmapData } from './services/heatmapService'
import {
	fetchUserProfile,
	fetchUserRoutes,
	saveUserRoute,
	deleteUserRoute,
	updateUserProfile,
} from './services/profileService'
import { deleteSharedRouteRecord } from './services/sharedRouteService'
import { fetchRoute } from './services/routeService'
import { useActiveUsers } from './services/userService'
import { API_CONFIG } from './utils/config'
import {
	SHARED_ROUTE_QUERY_KEY,
	SHARED_ROUTE_ID_QUERY_KEY,
} from './utils/sharedRoute'
import { useSharedRoutePreview } from './hooks/useSharedRoutePreview'
import {
	baseIconButtonStyles,
	motionButtonProps,
} from './styles/buttonStyles'
import { useUISelector, useUIStore } from './state/uiStore.jsx'

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
const loadPreferredCityCoords = () => {
	if (typeof window === 'undefined') return null
	try {
		const raw = localStorage.getItem(PREFERRED_CITY_STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw)
		if (
			parsed &&
			typeof parsed.lat === 'number' &&
			typeof parsed.lng === 'number'
		) {
			return parsed
		}
	} catch (error) {
		console.error('Error reading preferred city:', error)
	}
	return null
}
const PREFERRED_CITY_STORAGE_KEY = 'preferredCityCoords'
const DEFAULT_MAP_ZOOM = 10
const HEATMAP_DEBOUNCE_TIME = 300
const WEATHER_BUTTON_OFFSET = 30
const API_BASE_URL = API_CONFIG.BASE_URL
const RECENT_TRACK_COLORS = ['#F97316', '#3B82F6', '#10B981', '#F59E0B', '#6366F1']
const formatDistanceLabel = distanceMeters => {
	if (!distanceMeters || Number.isNaN(distanceMeters)) {
		return '0 м'
	}
	if (distanceMeters >= 1000) {
		const km = distanceMeters / 1000
		return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} км`
	}
	return `${Math.max(1, Math.round(distanceMeters))} м`
}


const computeWaypointDistancesFromPath = (pathPositions, waypoints) => {
	if (
		!Array.isArray(pathPositions) ||
		pathPositions.length < 2 ||
		!Array.isArray(waypoints) ||
		waypoints.length < 2
	) {
		return []
	}

	const waypointIndexes = []
	let searchStartIndex = 0

	waypoints.forEach(point => {
		let bestIndex = searchStartIndex
		let bestDistance = Infinity
		for (let i = searchStartIndex; i < pathPositions.length; i++) {
			const candidate = pathPositions[i]
			const dist = haversine(
				{ lat: candidate[0], lon: candidate[1] },
				{ lat: point.lat, lon: point.lng }
			)
			if (dist < bestDistance) {
				bestDistance = dist
				bestIndex = i
			}
			if (dist <= 3) {
				break
			}
		}
		waypointIndexes.push(bestIndex)
		searchStartIndex = bestIndex
	})

	const distances = []
	for (let i = 1; i < waypointIndexes.length; i++) {
		const startIndex = waypointIndexes[i - 1]
		const endIndex = waypointIndexes[i]
		if (endIndex <= startIndex) {
			distances.push(0)
			continue
		}
		let distance = 0
		for (let j = startIndex; j < endIndex; j++) {
			const current = pathPositions[j]
			const next = pathPositions[j + 1]
			if (!next) break
			distance += haversine(
				{ lat: current[0], lon: current[1] },
				{ lat: next[0], lon: next[1] }
			)
		}
		distances.push(distance)
	}

	return distances
}

const ROUTE_PATH_CACHE_KEY = 'manualRoutePaths'

const loadRoutePathCache = () => {
	if (typeof window === 'undefined') return {}
	try {
		const raw = localStorage.getItem(ROUTE_PATH_CACHE_KEY)
		return raw ? JSON.parse(raw) : {}
	} catch (error) {
		console.error('Failed to read route path cache', error)
		return {}
	}
}

const saveRoutePathCache = cache => {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem(ROUTE_PATH_CACHE_KEY, JSON.stringify(cache))
	} catch (error) {
		console.error('Failed to write route path cache', error)
	}
}

const getCachedRoutePath = routeId => {
	if (!routeId) return null
	const cache = loadRoutePathCache()
	return Array.isArray(cache[routeId]) ? cache[routeId] : null
}

const setCachedRoutePath = (routeId, coords) => {
	if (!routeId || !Array.isArray(coords) || coords.length < 2) return
	const cache = loadRoutePathCache()
	cache[routeId] = coords
	saveRoutePathCache(cache)
}

const removeCachedRoutePath = routeId => {
	if (!routeId) return
	const cache = loadRoutePathCache()
	if (cache[routeId]) {
		delete cache[routeId]
		saveRoutePathCache(cache)
	}
}

const DEFAULT_SURFACE_BY_PROFILE = {
	cycling: ['bike_lanes', 'road'],
	walking: ['sidewalks', 'forest'],
	driving: ['road'],
}

const buildPathCoordinatesForWaypoints = async (waypoints, profileValue) => {
	if (!Array.isArray(waypoints) || waypoints.length < 2) return []
	const profileConfig = getManualRouteProfileConfig(profileValue)
	const query = waypoints
		.map(point => `${point.longitude},${point.latitude}`)
		.join(';')
	const requestUrl = `${profileConfig.baseUrl}/route/v1/${profileConfig.apiProfile}/${query}?overview=full&geometries=geojson`
	const response = await fetch(requestUrl)
	if (!response.ok) {
		throw new Error('Не удалось восстановить маршрут')
	}
	const data = await response.json()
	const geometry = data?.routes?.[0]?.geometry?.coordinates
	if (!Array.isArray(geometry) || geometry.length < 2) {
		return []
	}
	return geometry.map(([lon, lat]) => ({
		latitude: lat,
		longitude: lon,
	}))
}

const createManualRoutePointIcon = color =>
	L.divIcon({
		className: 'manual-route-point-icon',
		html: `<div style="
				width: 12px;
				height: 12px;
				border-radius: 50%;
				background: ${color};
				border: 2px solid #fff;
				box-shadow: 0 0 4px rgba(0,0,0,0.4);
			"></div>`,
		iconSize: [12, 12],
		iconAnchor: [6, 6],
	})

const createDistanceLabelIcon = (color, label) =>
	L.divIcon({
		className: 'manual-route-distance-label',
		html: `<div style="
			transform: translate(-50%, -150%);
			background: rgba(255,255,255,0.98);
			padding: 4px 10px;
			min-width: 56px;
			text-align: center;
			border-radius: 18px;
			border: 2px solid ${color};
			box-shadow: 0 2px 8px rgba(0,0,0,0.25);
			font-size: 12px;
			color: #0f172a;
			font-weight: 600;
			line-height: 1.1;
			white-space: nowrap;
		">${label}</div>`,
		iconSize: [0, 0],
	})

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

// Кастомный компонент для управления маркерами без пересоздания DOM
const PersistentUserMarkers = memo(
	({ users, admins, map }) => {
		const markersRef = useRef(new Map()) // Хранилище маркеров
		const userDataRef = useRef(new Map()) // Кеш данных пользователей
		const clustersRef = useRef(new Map()) // Хранилище кластеров пользователей
		const updateTimeoutRef = useRef(null) // Для дебаунсинга обновлений

		// Функция для группировки пользователей по близости
		const groupUsersByLocation = useCallback(users => {
			const groups = []
			const processed = new Set()
			const CLUSTER_DISTANCE = 0.0005 // ~50 метров

			users.forEach((user, index) => {
				if (processed.has(index)) return

				const group = [user]
				processed.add(index)

				// Ищем других пользователей в радиусе
				users.forEach((otherUser, otherIndex) => {
					if (processed.has(otherIndex) || index === otherIndex) return

					const distance = Math.sqrt(
						Math.pow(user.latitude - otherUser.latitude, 2) +
							Math.pow(user.longitude - otherUser.longitude, 2)
					)

					if (distance <= CLUSTER_DISTANCE) {
						group.push(otherUser)
						processed.add(otherIndex)
					}
				})

				groups.push(group)
			})

			return groups
		}, [])

		// Функция создания HTML для одного пользователя
		const createUserMarkerHTML = useCallback(
			(user, isUserAdmin, isRecentlyActive) => {
				const labelClasses = [
					'user-info-label',
					isUserAdmin ? 'admin-label' : '',
				]
					.filter(Boolean)
					.join(' ')

				return `
			<div style="display: flex; flex-direction: column; align-items: center; position: relative;">
				<div class="avatar-container" style="position: relative; width: 42px; height: 42px;">
					${isUserAdmin ? `<div class="staff-badge">STAFF</div>` : ''}
										<img 
							src="/masked-icon.svg" 
							data-avatar="${user.avatarUrl || ''}"
							alt="${user.username}" 
							class="${isUserAdmin ? 'user-marker-admin' : 'user-marker-regular'} ${
					isRecentlyActive ? 'user-marker-active' : ''
				} user-avatar"
							style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; opacity: 1; transition: opacity 0.3s; background: transparent;"
							onload="(function(img){const a=img.getAttribute('data-avatar');if(a){const i=new Image();i.onload=function(){img.src=a};i.onerror=function(){img.src='/masked-icon.svg'};i.src=a}})(this)"
							onerror="this.src='/masked-icon.svg'"
					>
				</div>
				<div class="${labelClasses}">
					<span class="username">${user.username || 'Пользователь'}</span>
					<br>
					<span class="speed">${user.averageSpeed.toFixed(0)} км/ч</span>
				</div>
			</div>
		`
			},
			[]
		)

		// Функция создания HTML для группы пользователей
		const createUserGroupMarkerHTML = useCallback(
			userGroup => {
				const count = userGroup.length
				const hasAdmins = userGroup.some(
					user => admins && admins.includes(user.userId)
				)

				// Создаем компактную версию с ротацией аватаров
				const groupId = `group_${userGroup.map(u => u.userId).join('_')}`

				// Определяем стили в зависимости от того, есть ли админы в группе
				const borderStyle = hasAdmins
					? 'linear-gradient(135deg, #fed7aa, #fbd38d, #ed8936)'
					: 'linear-gradient(135deg, #4299e1, #63b3ed)'

				// Создаем HTML для всех аватаров
				const avatarsHTML = userGroup
					.map((user, index) => {
						const isUserAdmin = admins && admins.includes(user.userId)
						const isUserActive = Date.now() - user.lastActive * 1000 < 300000

						// Каждый пользователь использует свой индивидуальный стиль
						const userBorderStyle = isUserAdmin
							? 'linear-gradient(135deg, #fed7aa, #fbd38d, #ed8936)'
							: 'linear-gradient(135deg, #4299e1, #63b3ed)'

						return `
						<div class="user-cluster-avatar-wrapper" style="position: absolute; top: 0; left: 0; width: 50px; height: 50px;
								 opacity: ${index === 0 ? '1' : '0'};
								 transform: ${
										index === 0
											? 'scale(1) rotateY(0deg)'
											: 'scale(0.8) rotateY(180deg)'
									};
								 transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
								 z-index: ${index === 0 ? '10' : '1'};" data-index="${index}">
							${isUserAdmin ? `<div class="staff-badge">STAFF</div>` : ''}
							<img 
								src="/masked-icon.svg" 
								data-avatar="${user.avatarUrl || ''}"
								alt="${user.username}" 
								class="user-cluster-avatar-item ${
									isUserAdmin ? 'admin-cluster' : 'regular-cluster'
								} ${isUserActive ? 'active-cluster' : ''}"
								style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; 
									   border: 6px solid transparent;
									   background: linear-gradient(white, white) padding-box, ${userBorderStyle} border-box;
									   box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);"
								onload="(function(img){const a=img.getAttribute('data-avatar');if(a){const i=new Image();i.onload=function(){img.src=a};i.onerror=function(){img.src='/masked-icon.svg'};i.src=a}})(this)"
								onerror="this.src='/masked-icon.svg'"
							>
						</div>
					`
					})
					.join('')

				return `
					<div style="display: flex; flex-direction: column; align-items: center; position: relative;">
						<div class="user-cluster-avatar-container" id="${groupId}" 
							 style="position: relative; width: 50px; height: 50px;"
							 data-group-size="${count}" data-current-index="0">
							${avatarsHTML}
							<div class="user-cluster-counter" style="position: absolute; top: -8px; left: -8px; 
									 background: ${hasAdmins ? '#ed8936' : '#4299e1'}; color: white; 
									 font-size: 12px; font-weight: bold; padding: 4px 6px; 
									 border-radius: 12px; border: 2px solid white;
									 box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); min-width: 20px; 
									 text-align: center; line-height: 1; z-index: 15;">
								${count}
							</div>
							<div class="avatar-rotation-indicator" style="position: absolute; bottom: -2px; left: 50%; 
									 transform: translateX(-50%); width: 30px; height: 3px; 
									 background: linear-gradient(90deg, ${
											hasAdmins ? '#ed8936' : '#4299e1'
										}, transparent);
									 border-radius: 2px; opacity: 0.7; z-index: 5;
									 animation: rotationProgress 5s linear infinite;">
							</div>
						</div>
						<div class="user-cluster-label" style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(247, 250, 252, 0.95)); 
								   backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 6px; 
								   padding: 2px 6px; margin-top: 4px; font-size: 9px; font-weight: 600; color: #2d3748; 
								   box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); text-align: center; white-space: nowrap;">
							<span style="color: ${hasAdmins ? '#ed8936' : '#4299e1'};">👥 ${count}</span>
						</div>
					</div>
				`
			},
			[admins]
		)

		// Функция для создания попапа с информацией о группе
		const createGroupPopupContent = useCallback(
			userGroup => {
				const usersInfo = userGroup
					.map(user => {
						const isUserAdmin = admins && admins.includes(user.userId)
						const isRecentlyActive =
							Date.now() - user.lastActive * 1000 < 300000

						return `
						<div style="display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
							<img src="${user.avatarUrl || '/pwa-192.png'}" 
								 style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px; border: 1px solid #e2e8f0;">
							<div style="flex: 1;">
								<div style="font-weight: 600; color: ${isUserAdmin ? '#ed8936' : '#2d3748'};">
									${isUserAdmin ? '👑 ' : ''}${user.username || 'Пользователь'}
								</div>
								<div style="font-size: 11px; color: #718096;">
									Скорость: ${user.averageSpeed.toFixed(0)} км/ч
									${isRecentlyActive ? ' • 🟢 Активен' : ''}
								</div>
							</div>
						</div>
					`
					})
					.join('')

				return `
					<div style="max-width: 250px; max-height: 300px; overflow-y: auto;">
						<div style="font-weight: bold; margin-bottom: 8px; text-align: center; color: #2d3748;">
							👥 Пользователи в этой области (${userGroup.length})
						</div>
						${usersInfo}
					</div>
				`
			},
			[admins]
		)

		// Дебаунсированная функция обновления маркеров
		const updateMarkers = useCallback(() => {
			if (!map || !users) return

			const currentMarkers = markersRef.current
			const currentUserData = userDataRef.current
			const currentClusters = clustersRef.current

			// Группируем пользователей по близости
			const userGroups = groupUsersByLocation(users)

			// Создаем ключи для текущих групп
			const currentGroupKeys = new Set()
			const currentUserKeys = new Set()

			userGroups.forEach((group, groupIndex) => {
				if (group.length === 1) {
					currentUserKeys.add(group[0].userId)
				} else {
					const groupKey = `group_${group
						.map(u => u.userId)
						.sort()
						.join('_')}`
					currentGroupKeys.add(groupKey)
				}
			})

			// Удаляем устаревшие маркеры одиночных пользователей
			for (const [userId, marker] of currentMarkers.entries()) {
				if (!currentUserKeys.has(userId)) {
					map.removeLayer(marker)
					currentMarkers.delete(userId)
					currentUserData.delete(userId)
				}
			}

			// Удаляем устаревшие кластеры
			for (const [clusterKey, marker] of currentClusters.entries()) {
				if (!currentGroupKeys.has(clusterKey)) {
					// Очищаем интервал ротации для удаляемого кластера
					const containerElement = marker
						.getElement()
						?.querySelector('[data-rotation-interval]')
					if (containerElement) {
						const intervalId = containerElement.getAttribute(
							'data-rotation-interval'
						)
						if (intervalId) {
							clearInterval(parseInt(intervalId))
						}
					}

					map.removeLayer(marker)
					currentClusters.delete(clusterKey)
				}
			}

			userGroups.forEach((group, groupIndex) => {
				if (group.length === 1) {
					// Одиночный пользователь
					const user = group[0]
					const isUserAdmin = admins && admins.includes(user.userId)
					const isRecentlyActive = Date.now() - user.lastActive * 1000 < 300000

					const existingMarker = currentMarkers.get(user.userId)
					const cachedData = currentUserData.get(user.userId)

					// Проверяем нужно ли обновление
					const needsUpdate =
						!cachedData ||
						Math.abs(cachedData.latitude - user.latitude) > 0.0001 ||
						Math.abs(cachedData.longitude - user.longitude) > 0.0001 ||
						cachedData.username !== user.username ||
						cachedData.avatarUrl !== user.avatarUrl ||
						cachedData.isUserAdmin !== isUserAdmin ||
						Math.abs(cachedData.averageSpeed - user.averageSpeed) > 1

					if (existingMarker && !needsUpdate) {
						return // Маркер актуален, ничего не делаем
					}

					if (existingMarker) {
						// Плавно обновляем позицию существующего маркера
						const newLatLng = [user.latitude, user.longitude]
						existingMarker.setLatLng(newLatLng)

						// Обновляем попап если нужно
						if (
							cachedData &&
							(cachedData.username !== user.username ||
								Math.abs(cachedData.averageSpeed - user.averageSpeed) > 1)
						) {
							existingMarker.setPopupContent(`
								${isUserAdmin ? 'Staff: ' : 'Активный пользователь: '}${
								user.username || 'Неизвестный'
							}
								<br />
								Последняя активность: ${new Date(user.lastActive * 1000).toLocaleString()}
								<br />
								Средняя скорость: ${user.averageSpeed.toFixed(1)} км/ч
							`)
						}
					} else {
						// Создаем новый маркер
						const markerHTML = createUserMarkerHTML(
							user,
							isUserAdmin,
							isRecentlyActive
						)
						const icon = L.divIcon({
							className: 'active-user-marker',
							html: markerHTML,
							iconSize: [55, 70],
							iconAnchor: [27, 70],
						})

						const marker = L.marker([user.latitude, user.longitude], { icon })
						marker.bindPopup(`
					${isUserAdmin ? 'Staff: ' : 'Активный пользователь: '}${
							user.username || 'Неизвестный'
						}
					<br />
					Последняя активность: ${new Date(user.lastActive * 1000).toLocaleString()}
					<br />
					Средняя скорость: ${user.averageSpeed.toFixed(1)} км/ч
				`)

						marker.addTo(map)
						currentMarkers.set(user.userId, marker)
					}

					// Обновляем кеш данных
					currentUserData.set(user.userId, {
						...user,
						isUserAdmin,
						isRecentlyActive,
					})
				} else {
					// Группа пользователей
					const groupKey = `group_${group
						.map(u => u.userId)
						.sort()
						.join('_')}`
					const centerLat =
						group.reduce((sum, user) => sum + user.latitude, 0) / group.length
					const centerLng =
						group.reduce((sum, user) => sum + user.longitude, 0) / group.length

					const existingCluster = currentClusters.get(groupKey)

					if (existingCluster) {
						// Плавно обновляем позицию существующего кластера
						const newLatLng = [centerLat, centerLng]
						existingCluster.setLatLng(newLatLng)

						// Обновляем попап с актуальными данными
						existingCluster.setPopupContent(createGroupPopupContent(group))

						// Проверяем нужно ли обновить HTML маркера (изменились пользователи)
						const containerElement = document.getElementById(
							`group_${group.map(u => u.userId).join('_')}`
						)
						if (containerElement) {
							// Обновляем счетчик
							const counter = containerElement.querySelector(
								'.user-cluster-counter'
							)
							if (counter) {
								counter.textContent = group.length
							}

							// Проверяем изменились ли аватары
							const currentAvatars = containerElement.querySelectorAll(
								'.user-cluster-avatar-wrapper'
							)
							if (currentAvatars.length !== group.length) {
								// Количество изменилось - пересоздаем маркер
								map.removeLayer(existingCluster)
								currentClusters.delete(groupKey)

								const markerHTML = createUserGroupMarkerHTML(group)
								const icon = L.divIcon({
									className: 'active-user-cluster',
									html: markerHTML,
									iconSize: [65, 75],
									iconAnchor: [32, 75],
								})

								const newMarker = L.marker([centerLat, centerLng], { icon })
								newMarker.bindPopup(createGroupPopupContent(group), {
									maxWidth: 300,
									autoPan: true,
									closeOnClick: true,
									autoClose: true,
									closeOnEscapeKey: true,
								})

								newMarker.addTo(map)
								currentClusters.set(groupKey, newMarker)

								// Настраиваем ротацию для нового кластера
								setTimeout(() => {
									const groupId = `group_${group.map(u => u.userId).join('_')}`
									const containerElement = document.getElementById(groupId)

									if (containerElement && group.length > 1) {
										let currentIndex = 0

										const rotateAvatars = () => {
											const avatarWrappers = containerElement.querySelectorAll(
												'.user-cluster-avatar-wrapper'
											)
											if (avatarWrappers.length <= 1) return

											// Скрываем текущий аватар
											const currentWrapper = avatarWrappers[currentIndex]
											if (currentWrapper) {
												currentWrapper.style.opacity = '0'
												currentWrapper.style.transform =
													'scale(0.8) rotateY(-180deg)'
												currentWrapper.style.zIndex = '1'
											}

											// Переходим к следующему аватару
											currentIndex = (currentIndex + 1) % avatarWrappers.length

											// Показываем следующий аватар
											const nextWrapper = avatarWrappers[currentIndex]
											if (nextWrapper) {
												setTimeout(() => {
													nextWrapper.style.opacity = '1'
													nextWrapper.style.transform = 'scale(1) rotateY(0deg)'
													nextWrapper.style.zIndex = '10'
												}, 300)
											}

											// Обновляем data-current-index
											containerElement.setAttribute(
												'data-current-index',
												currentIndex.toString()
											)
										}

										// Запускаем ротацию каждые 5 секунд
										const interval = setInterval(rotateAvatars, 5000)

										// Сохраняем интервал для очистки
										containerElement.setAttribute(
											'data-rotation-interval',
											interval
										)
									}
								}, 100)
							}
						}
					} else {
						// Создаем новый кластер
						const markerHTML = createUserGroupMarkerHTML(group)
						const icon = L.divIcon({
							className: 'active-user-cluster',
							html: markerHTML,
							iconSize: [65, 75],
							iconAnchor: [32, 75],
						})

						const marker = L.marker([centerLat, centerLng], { icon })
						marker.bindPopup(createGroupPopupContent(group), {
							maxWidth: 300,
							autoPan: true,
							closeOnClick: true,
							autoClose: true,
							closeOnEscapeKey: true,
						})

						marker.addTo(map)
						currentClusters.set(groupKey, marker)

						// Настраиваем ротацию аватаров для нового кластера
						setTimeout(() => {
							const groupId = `group_${group.map(u => u.userId).join('_')}`
							const containerElement = document.getElementById(groupId)

							if (containerElement && group.length > 1) {
								let currentIndex = 0

								const rotateAvatars = () => {
									const avatarWrappers = containerElement.querySelectorAll(
										'.user-cluster-avatar-wrapper'
									)
									if (avatarWrappers.length <= 1) return

									// Скрываем текущий аватар
									const currentWrapper = avatarWrappers[currentIndex]
									if (currentWrapper) {
										currentWrapper.style.opacity = '0'
										currentWrapper.style.transform =
											'scale(0.8) rotateY(-180deg)'
										currentWrapper.style.zIndex = '1'
									}

									// Переходим к следующему аватару
									currentIndex = (currentIndex + 1) % avatarWrappers.length

									// Показываем следующий аватар
									const nextWrapper = avatarWrappers[currentIndex]
									if (nextWrapper) {
										setTimeout(() => {
											nextWrapper.style.opacity = '1'
											nextWrapper.style.transform = 'scale(1) rotateY(0deg)'
											nextWrapper.style.zIndex = '10'
										}, 300)
									}

									// Обновляем data-current-index
									containerElement.setAttribute(
										'data-current-index',
										currentIndex.toString()
									)
								}

								// Запускаем ротацию каждые 5 секунд
								const interval = setInterval(rotateAvatars, 5000)

								// Сохраняем интервал для очистки
								containerElement.setAttribute(
									'data-rotation-interval',
									interval
								)
							}
						}, 100) // Минимальная задержка для инициализации DOM
					}
				}
			})
		}, [
			map,
			users,
			admins,
			groupUsersByLocation,
			createUserMarkerHTML,
			createUserGroupMarkerHTML,
			createGroupPopupContent,
		])

		// Эффект для дебаунсированного обновления маркеров
		useEffect(() => {
			// Очищаем предыдущий таймаут
			if (updateTimeoutRef.current) {
				clearTimeout(updateTimeoutRef.current)
			}

			// Устанавливаем новый таймаут для дебаунсинга
			updateTimeoutRef.current = setTimeout(() => {
				updateMarkers()
			}, 150) // 150мс дебаунс для плавности

			return () => {
				if (updateTimeoutRef.current) {
					clearTimeout(updateTimeoutRef.current)
				}
			}
		}, [updateMarkers])

		// Cleanup при размонтировании компонента
		useEffect(() => {
			return () => {
				if (map) {
					// Очищаем интервалы ротации
					const allContainers = document.querySelectorAll(
						'[data-rotation-interval]'
					)
					allContainers.forEach(container => {
						const intervalId = container.getAttribute('data-rotation-interval')
						if (intervalId) {
							clearInterval(parseInt(intervalId))
						}
					})

					// Удаляем маркеры
					for (const marker of markersRef.current.values()) {
						map.removeLayer(marker)
					}
					for (const marker of clustersRef.current.values()) {
						map.removeLayer(marker)
					}
					markersRef.current.clear()
					clustersRef.current.clear()
					userDataRef.current.clear()
				}
			}
		}, [map])

		return null // Этот компонент не рендерит React элементы
	},
	(prevProps, nextProps) => {
		return (
			prevProps.users === nextProps.users &&
			prevProps.admins === nextProps.admins &&
			prevProps.map === nextProps.map
		)
	}
)

const UserMap = ({
	userId,
	admins,
	isGuestMode = false,
	onRequireAuth = null,
}) => {

	const user = useTelegramUser()
	const isGuestView = isGuestMode || !userId
	const canModifyMap = Boolean(userId)
	const requireAuth = useCallback(() => {
		if (typeof onRequireAuth === 'function') {
			onRequireAuth()
			return
		}
		if (typeof window !== 'undefined') {
			window.location.replace('#/auth')
		}
	}, [onRequireAuth])

	const buttonMotion = {
		...motionButtonProps,
	}

	const today = new Date().toISOString().split('T')[0]
	const [routesState, dispatch] = useReducer(routesReducer, {
		data: {},
		distances: {},
		metadata: {},
		visibleSessions: {},
	})
	const [selectedDate, setSelectedDate] = useState(today)
	const [trackStatus, setTrackStatus] = useState({
		loading: false,
		error: null,
	})

	const [chargingStations, setChargingStations] = useState([])
	const [showChargingStations, setShowChargingStations] = useState(() => {
		return JSON.parse(localStorage.getItem('showChargingStations') || 'false')
	})
	const [isEditMode, setIsEditMode] = useState(false)
	const [showHeatmap, setShowHeatmap] = useState(false)
	const [heatmapData, setHeatmapData] = useState([])
	const [heatmapStatus, setHeatmapStatus] = useState({
		loading: false,
		error: null,
	})
	const [heatmapPeriod, setHeatmapPeriod] = useState('this_month')
	const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear())
	const [heatmapMonth, setHeatmapMonth] = useState(new Date().getMonth() + 1)
	const [selectedTrackIds, setSelectedTrackIds] = useState([])
	const [lastFocusedTrackId, setLastFocusedTrackId] = useState(null)
	const [recentTracks, setRecentTracks] = useState([])
	const [recentTracksStatus, setRecentTracksStatus] = useState({
		loading: false,
		error: null,
	})
	const [recentTracksLoaded, setRecentTracksLoaded] = useState(false)
	const [recentTrackRoutes, setRecentTrackRoutes] = useState({})
const [profile, setProfile] = useState(null)
const [profileStatus, setProfileStatus] = useState({
	loading: false,
	saving: false,
	error: null,
})
	const authorName = useMemo(() => {
		const profileName = profile?.username || profile?.name || profile?.displayName
		const tgUsername = user?.username
		const fullName = [user?.firstName, user?.lastName]
			.filter(Boolean)
			.join(' ')
			.trim()
		const fallbackId =
			typeof userId === 'string' || typeof userId === 'number'
				? String(userId)
				: ''

		return (
			profileName ||
			tgUsername ||
			fullName ||
		fallbackId
	)
}, [
	profile?.username,
	profile?.name,
	profile?.displayName,
	user?.username,
	user?.firstName,
	user?.lastName,
	userId,
])
	const resolveSharedRouteAuthor = useCallback(
		item =>
			resolveRouteAuthor(item, {
				currentUserId: userId,
				currentUserName: authorName,
			}),
		[authorName, userId]
	)
const [savedRoutes, setSavedRoutes] = useState([])
const [savedRoutesStatus, setSavedRoutesStatus] = useState({
	loading: true,
	error: null,
})
	const { setPublishedRoutesMap, setVisibleSavedRouteIds } = useUIStore()
	const publishedRoutesMap = useUISelector(state => state.publishedRoutesMap)
	const visibleSavedRouteIds = useUISelector(
		state => state.visibleSavedRouteIds || []
	)
	useEffect(() => {
		setVisibleSavedRouteIds(prevIds => {
			if (!savedRoutes || savedRoutes.length === 0) {
				return prevIds.length ? [] : prevIds
			}

			const validIds = new Set(
				savedRoutes.map(route => route.routeId).filter(Boolean)
			)
			const filtered = prevIds.filter(id => validIds.has(id))
			if (filtered.length === prevIds.length) {
				const unchanged = filtered.every((id, index) => id === prevIds[index])
				return unchanged ? prevIds : filtered
			}
			return filtered
		})
	}, [savedRoutes, setVisibleSavedRouteIds])

	const {
		data: activeUsers,
		isLoading: isActiveUsersLoading,
		error: activeUsersError,
	} = useActiveUsers()

	// Мемоизированный список активных пользователей для предотвращения ненужных ре-рендеров
	const memoizedActiveUsers = useMemo(() => {
		return activeUsers || []
	}, [activeUsers])

	const [showActiveUsers, setShowActiveUsers] = useState(false)

	// Состояния для погоды
	

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
		position: floatingControlsPosition,
		handlePointerDown: handleFloatingControlsPointerDown,
	} = useFloatingControlsPosition()
	const {
		isOpen: isDrawerOpen,
		onOpen: onDrawerOpen,
		onClose: onDrawerClose,
	} = useDisclosure()
	const toast = useToast()
	const isAdmin = admins.includes(userId)
	const mapRef = useRef(null)
	const preferredCityCoords = useUISelector(state => state.preferredCityCoords)
	const mapLayer = useUISelector(state => state.mapLayer)
	const [mapCenter, setMapCenter] = useState(() => {
		const stored = loadPreferredCityCoords()
		return stored ? [stored.lat, stored.lng] : DEFAULT_MAP_CENTER
	})

	const [selectedWorkshop, setSelectedWorkshop] = useState(null)
	const {
		isOpen: isWorkshopModalOpen,
		onOpen: onWorkshopModalOpen,
		onClose: onWorkshopModalClose,
	} = useDisclosure()

	const [mapBounds, setMapBounds] = useState(null)
	const [mapInstance, setMapInstance] = useState(null)
	const {
		manualRouteMode,
		setManualRouteMode,
		manualRoutePoints,
		setManualRoutePoints,
		manualRouteMeta,
		setManualRouteMeta,
		manualRouteStatus,
		setManualRouteStatus,
		manualRouteFollowRoads,
		setManualRouteFollowRoads,
		manualRoutePath,
		setManualRoutePath,
		manualRouteRoutingStatus,
		setManualRouteRoutingStatus,
		manualRouteLegDistances,
		setManualRouteLegDistances,
		manualRouteEditingRouteId,
		setManualRouteEditingRouteId,
		manualRouteProfile,
	setManualRouteProfile,
	} = useManualRouteState({ defaultColor: DEFAULT_MANUAL_ROUTE_COLOR })
	const resetManualRouteFeedback = useCallback(() => {
		setManualRouteStatus(prev => {
			if (!prev.error && !prev.success) return prev
			return { ...prev, error: null, success: false }
		})
	}, [setManualRouteStatus])
const {
	sharedRoutePreview,
	sharedRouteError,
	sharedRouteFetchStatus,
	handleSharedRouteClear,
} = useSharedRoutePreview()
	const {
		showSharedRoutesCatalog,
		setShowSharedRoutesCatalog,
		sharedRoutesCatalog,
		sharedRoutesCatalogStatus,
		loadSharedRoutesCatalog,
		ensureSharedRoutesCatalogVisible,
		handleRefreshSharedRoutesCatalog,
	} = useSharedRoutesCatalog(toast)
	const isCompactManualPanel = false
	const isDesktopSidebar = useBreakpointValue({ base: false, md: true }) || false
	const manualRoutePanelRef = useRef(null)
	const manualRoutePanelDefaultLeft = useBreakpointValue({ base: 70, md: 90 })
	const {
		manualRoutePanelCollapsed,
		manualRoutePanelPosition,
		manualRoutePanelIsCollapsed,
		handleManualRoutePanelToggle,
		handleManualRoutePanelPointerDown,
	} = useManualRoutePanelState({
		manualRoutePanelDefaultLeft,
		isCompactManualPanel,
		manualRouteMode,
		panelRef: manualRoutePanelRef,
	})
	const { sidebarPosition, handleSidebarPointerDown } = useSidebarPosition(
		isDesktopSidebar
	)

const normalizeCoordinatePoint = point => {
	if (!point) return [NaN, NaN]
	if (Array.isArray(point) && point.length >= 2) {
		return [Number(point[0]), Number(point[1])]
	}
	if (typeof point === 'object') {
		if ('latitude' in point && 'longitude' in point) {
			return [Number(point.latitude), Number(point.longitude)]
		}
		if ('lat' in point && 'lng' in point) {
			return [Number(point.lat), Number(point.lng)]
		}
	}
	return [NaN, NaN]
}
	const manualRoutePointDragLockRef = useRef(false)
	const {
		addManualRoutePoint,
		updateManualRoutePoint,
		removeManualRoutePoint,
		insertManualRoutePoint,
		handleManualRoutePolylineClick,
	} = useManualRouteEditing({
		manualRouteMode,
		manualRoutePoints,
		resetManualRouteFeedback,
		setManualRoutePoints,
	})

	useEffect(() => {
		const defaults = DEFAULT_SURFACE_BY_PROFILE[manualRouteProfile] || []
		setManualRouteMeta(prev => ({
			...prev,
			surfaceTypes:
				Array.isArray(prev.surfaceTypes) && prev.surfaceTypes.length > 0
					? prev.surfaceTypes
					: defaults,
		}))
	}, [manualRouteProfile, setManualRouteMeta])

	const { setMapLayer, setPreferredCityCoords } = useUIStore()
	useEffect(() => {
		if (
			preferredCityCoords &&
			typeof preferredCityCoords.lat === 'number' &&
			typeof preferredCityCoords.lng === 'number'
		) {
			const nextCenter = [preferredCityCoords.lat, preferredCityCoords.lng]
			setMapCenter(nextCenter)
			if (mapRef.current) {
				mapRef.current.setView(nextCenter, 12)
			}
		}
	}, [preferredCityCoords])

	useEffect(() => {
		const handlePreferredCityStorage = event => {
			if (event.key === PREFERRED_CITY_STORAGE_KEY) {
				setPreferredCityCoords(loadPreferredCityCoords())
			}
		}
		const handlePreferredCityEvent = event => {
			const detail = event.detail
			if (
				detail &&
				typeof detail.lat === 'number' &&
				typeof detail.lng === 'number'
			) {
				setPreferredCityCoords(detail)
			}
		}
		window.addEventListener('storage', handlePreferredCityStorage)
		window.addEventListener('preferredCityChange', handlePreferredCityEvent)
		return () => {
			window.removeEventListener('storage', handlePreferredCityStorage)
			window.removeEventListener('preferredCityChange', handlePreferredCityEvent)
		}
	}, [setPreferredCityCoords])

	const handleMapLayerChange = useCallback(
		newLayer => {
			setMapLayer(newLayer || 'default')
		},
		[setMapLayer]
	)

	const toggleActiveUsers = useCallback(() => {
		setShowActiveUsers(prev => !prev)
	}, [])

	

	const loadProfile = useCallback(async () => {
		if (!userId) return
		setProfileStatus(prev => ({ ...prev, loading: true, error: null }))
		try {
			const data = await fetchUserProfile(userId)
			setProfile(data)
			setSavedRoutes(Array.isArray(data?.routes) ? data.routes : [])
			setProfileStatus(prev => ({ ...prev, loading: false }))
		} catch (error) {
			console.error('Error fetching profile:', error)
			setProfileStatus(prev => ({
				...prev,
				loading: false,
				error: error.message || 'Не удалось загрузить профиль',
			}))
		}
	}, [userId])

	const enhanceRoutesWithPaths = useCallback(async routes => {
		return Promise.all(
			routes.map(async route => {
				const followRoads =
					typeof route.followRoads === 'boolean' ? route.followRoads : true
				if (
					followRoads &&
					(!Array.isArray(route.pathCoordinates) ||
						route.pathCoordinates.length < 2) &&
					Array.isArray(route.waypoints) &&
					route.waypoints.length >= 2
				) {
					const cached = getCachedRoutePath(route.routeId)
					if (cached && cached.length >= 2) {
						return { ...route, pathCoordinates: cached }
					}
					try {
						const coords = await buildPathCoordinatesForWaypoints(
							route.waypoints,
							route.routingProfile
						)
						if (coords.length >= 2) {
							setCachedRoutePath(route.routeId, coords)
							return { ...route, pathCoordinates: coords }
						}
					} catch (error) {
						console.error('Error rebuilding route path:', route.routeId, error)
					}
				}
				return route
			})
		)
	}, [])

	const loadSavedRoutes = useCallback(async () => {
		if (!userId) return
		setSavedRoutesStatus({ loading: true, error: null })
		try {
			const data = await fetchUserRoutes(userId)
			if (Array.isArray(data)) {
				const enhanced = await enhanceRoutesWithPaths(data)
				setSavedRoutes(enhanced)
			} else if (Array.isArray(data?.routes)) {
				const enhanced = await enhanceRoutesWithPaths(data.routes)
				setSavedRoutes(enhanced)
			} else {
				setSavedRoutes([])
			}
			setSavedRoutesStatus({ loading: false, error: null })
		} catch (error) {
			console.error('Error loading saved routes:', error)
			setSavedRoutesStatus({
				loading: false,
				error: error.message || 'Не удалось загрузить маршруты',
			})
		}
	}, [userId, enhanceRoutesWithPaths])

	useEffect(() => {
		const missingRoutes = savedRoutes.filter(route => {
			const followRoads =
				typeof route.followRoads === 'boolean' ? route.followRoads : true
			return (
				followRoads &&
				(!Array.isArray(route.pathCoordinates) ||
					route.pathCoordinates.length < 2) &&
				Array.isArray(route.waypoints) &&
				route.waypoints.length >= 2
			)
		})

		if (!missingRoutes.length) {
			return
		}

		let cancelled = false

		const rebuildPaths = async () => {
			const enhanced = await enhanceRoutesWithPaths(missingRoutes)
			if (cancelled) return
			const updates = new Map()
			enhanced.forEach(route => {
				if (
					route?.routeId &&
					Array.isArray(route.pathCoordinates) &&
					route.pathCoordinates.length >= 2
				) {
					updates.set(route.routeId, route.pathCoordinates)
					setCachedRoutePath(route.routeId, route.pathCoordinates)
				}
			})
			if (!updates.size) {
				return
			}
			setSavedRoutes(prev =>
				prev.map(route =>
					updates.has(route.routeId)
						? { ...route, pathCoordinates: updates.get(route.routeId) }
						: route
				)
			)
		}

		rebuildPaths()

		return () => {
			cancelled = true
		}
	}, [savedRoutes, enhanceRoutesWithPaths])

	const handleProfileSave = useCallback(
		async updates => {
			if (!userId) return
			setProfileStatus(prev => ({ ...prev, saving: true, error: null }))
			try {
				const data = await updateUserProfile(userId, updates)
				if (data) {
					setProfile(data)
					if (Array.isArray(data.routes)) {
						setSavedRoutes(data.routes)
					}
				}
				setProfileStatus(prev => ({
					...prev,
					saving: false,
					error: null,
				}))
				toast({
					position: 'top-right',
					title: 'Профиль сохранён',
					status: 'success',
					duration: 3000,
					isClosable: true,
				})
			} catch (error) {
				console.error('Error updating profile:', error)
				setProfileStatus(prev => ({
					...prev,
					saving: false,
					error: error.message || 'Не удалось сохранить профиль',
				}))
				toast({
					position: 'top-right',
					title: error.message || 'Не удалось сохранить профиль',
					status: 'error',
					duration: 3000,
					isClosable: true,
				})
			}
		},
		[userId, toast]
	)

	useEffect(() => {
		if (userId) {
			loadProfile()
		}
	}, [userId, loadProfile])


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

	const {
		manualRoutePositions,
		manualRouteDistanceKm,
		manualRouteProfileLabel,
		manualRouteSummaryDistance,
		manualRouteControlSize,
		manualRouteActionButtonSize,
		manualRouteHasUndo,
		manualRouteHasExistingRoute,
		manualRouteSaveDisabled,
		shouldShowManualRoutePanel,
	} = useManualRouteDerived({
		manualRoutePoints,
		manualRoutePath,
		manualRouteMeta,
		manualRouteMode,
		manualRouteStatus,
		manualRouteProfile,
		manualRouteFollowRoads,
		canModifyMap,
	})

	useEffect(() => {
		if ((manualRouteMode || isAddingStation) && !isEditMode) {
			setIsEditMode(true)
		}
	}, [isAddingStation, isEditMode, manualRouteMode])

	const canDragManualPoints = manualRouteMode || manualRouteEditingRouteId !== null
	const manualRouteDistanceLabels = useMemo(() => {
		if (!manualRoutePoints.length) return []
		const color = manualRouteMeta.color || DEFAULT_MANUAL_ROUTE_COLOR
		let cumulativeMeters = 0
		return manualRoutePoints.map((point, index) => {
		if (index > 0) {
			cumulativeMeters += manualRouteLegDistances[index - 1] || 0
		}
		const label = formatDistanceLabel(cumulativeMeters)
		return {
			id: `manual-distance-${index}`,
			position: [point.lat, point.lng],
			icon: createDistanceLabelIcon(color, label),
		}
		})
	}, [manualRoutePoints, manualRouteMeta.color, manualRouteLegDistances])

	const manualRouteStartIcon = useMemo(
		() => createRouteStartMarker(manualRouteMeta.color || DEFAULT_MANUAL_ROUTE_COLOR),
		[manualRouteMeta.color]
	)
	const manualRouteEndIcon = useMemo(
		() => createRouteEndMarker(manualRouteMeta.color || DEFAULT_MANUAL_ROUTE_COLOR),
		[manualRouteMeta.color]
	)
	const manualRoutePointIcon = useMemo(
		() => createManualRoutePointIcon(manualRouteMeta.color || DEFAULT_MANUAL_ROUTE_COLOR),
		[manualRouteMeta.color]
	)
	useEffect(() => {
		if (!mapInstance || !manualRouteMode) return
		const handleMapClick = event => {
			if (manualRoutePointDragLockRef.current) {
				manualRoutePointDragLockRef.current = false
				return
			}
			const { latlng } = event
			if (!latlng) return
			addManualRoutePoint(latlng)
		}
		mapInstance.on('click', handleMapClick)
		return () => {
			mapInstance.off('click', handleMapClick)
		}
	}, [addManualRoutePoint, manualRouteMode, mapInstance])

	useEffect(() => {
		if (!manualRouteMode && manualRoutePoints.length === 0) {
			setManualRoutePath([])
			setManualRouteLegDistances([])
			setManualRouteRoutingStatus({ loading: false, error: null })
			return
		}

		if (!manualRouteFollowRoads || manualRoutePoints.length < 2) {
			setManualRoutePath(manualRoutePoints.map(point => [point.lat, point.lng]))
			const fallbackLegs = manualRoutePoints.slice(1).map((point, index) =>
				haversine(
					{ lat: manualRoutePoints[index].lat, lon: manualRoutePoints[index].lng },
					{ lat: point.lat, lon: point.lng }
				)
			)
			setManualRouteLegDistances(fallbackLegs)
			setManualRouteRoutingStatus({ loading: false, error: null })
			return
		}

		const query = manualRoutePoints
			.map(point => `${point.lng},${point.lat}`)
			.join(';')

		const controller = new AbortController()
		setManualRouteRoutingStatus({ loading: true, error: null })

		const profileConfig = getManualRouteProfileConfig(manualRouteProfile)
		const requestUrl = `${profileConfig.baseUrl}/route/v1/${profileConfig.apiProfile}/${query}?overview=full&geometries=geojson`

		fetch(requestUrl, {
			signal: controller.signal,
		})
			.then(response => {
				if (!response.ok) {
					throw new Error('Маршрут недоступен')
				}
				return response.json()
			})
			.then(data => {
				const route = data?.routes?.[0]
				const geometry = route?.geometry?.coordinates
				if (Array.isArray(geometry) && geometry.length >= 2) {
					const positions = geometry.map(([lon, lat]) => [lat, lon])
					setManualRoutePath(positions)
					let legDistances = []
					if (
						Array.isArray(route?.legs) &&
						route.legs.length === manualRoutePoints.length - 1
					) {
						legDistances = route.legs.map(leg => leg?.distance || 0)
					} else {
						legDistances = computeWaypointDistancesFromPath(
							positions,
							manualRoutePoints
						)
					}
					setManualRouteLegDistances(legDistances)
					setManualRouteRoutingStatus({ loading: false, error: null })
				} else {
					throw new Error('Не удалось построить маршрут')
				}
			})
			.catch(error => {
				if (controller.signal.aborted) return
				console.error('Routing error:', error)
				setManualRoutePath(manualRoutePoints.map(point => [point.lat, point.lng]))
				const fallbackLegs = manualRoutePoints.slice(1).map((point, index) =>
					haversine(
						{ lat: manualRoutePoints[index].lat, lon: manualRoutePoints[index].lng },
						{ lat: point.lat, lon: point.lng }
					)
				)
				setManualRouteLegDistances(fallbackLegs)
				setManualRouteRoutingStatus({
					loading: false,
					error: error.message || 'Не удалось проложить маршрут',
				})
			})

		return () => {
			controller.abort()
		}
		return () => {
			controller.abort()
		}
	}, [
		manualRoutePoints,
		manualRouteFollowRoads,
		manualRouteMode,
		manualRouteProfile,
	])

	useEffect(() => {
		if (!mapRef.current) return
		const container = mapRef.current.getContainer()
		if (!container) return
		container.style.cursor = manualRouteMode ? 'crosshair' : ''
		return () => {
			if (container) {
				container.style.cursor = ''
			}
		}
	}, [manualRouteMode])

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
			return data
		} catch (error) {
			console.error('Error fetching charging stations:', error)
			toast({
				title: 'Ошибка загрузки станций',
				description: error.message,
				status: 'error',
				duration: 5000,
				isClosable: true,
			})
			throw error
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

		const distances = {}
		const metadata = {}

		Object.keys(groupedRoutes).forEach(sessionId => {
			const sessionPoints = groupedRoutes[sessionId]
			if (!sessionPoints || sessionPoints.length === 0) {
				distances[sessionId] = 0
				metadata[sessionId] = {
					startTimestamp: null,
					endTimestamp: null,
					durationMinutes: 0,
					pointsCount: 0,
				}
				return
			}

			const orderedPoints = [...sessionPoints].sort(
				(a, b) => (a.timestamp || 0) - (b.timestamp || 0)
			)

			let sessionDistance = 0
			for (let i = 1; i < orderedPoints.length; i++) {
				const prevPoint = orderedPoints[i - 1]
				const currentPoint = orderedPoints[i]
				sessionDistance += haversine(
					{ lat: prevPoint.latitude, lon: prevPoint.longitude },
					{ lat: currentPoint.latitude, lon: currentPoint.longitude }
				)
			}

			const startTimestamp = orderedPoints[0].timestamp
				? orderedPoints[0].timestamp * 1000
				: null
			const endTimestamp =
				orderedPoints[orderedPoints.length - 1].timestamp
					? orderedPoints[orderedPoints.length - 1].timestamp * 1000
					: null
			const durationMinutes =
				startTimestamp && endTimestamp
					? (endTimestamp - startTimestamp) / (1000 * 60)
					: 0

			distances[sessionId] = sessionDistance
			metadata[sessionId] = {
				startTimestamp,
				endTimestamp,
				durationMinutes,
				pointsCount: orderedPoints.length,
			}
		})

	return { groupedRoutes, distances, metadata }
	}, [])

useEffect(() => {
	if (!userId) {
		setRecentTracks([])
		setRecentTrackRoutes({})
		setRecentTracksStatus({ loading: false, error: null })
		setRecentTracksLoaded(false)
		return
	}

	if (!recentTracksLoaded) {
		return
	}

		let isMounted = true
	const fetchRecentTracks = async () => {
			setRecentTracksStatus({ loading: true, error: null })
			try {
				const endDate = new Date()
				const startDate = new Date()
				startDate.setMonth(endDate.getMonth() - 3)

				const data = await fetchRoute(userId, startDate, endDate)
				if (!isMounted) return

				if (!Array.isArray(data) || data.length === 0) {
					setRecentTracks([])
					setRecentTrackRoutes({})
					setRecentTracksStatus({ loading: false, error: null })
					return
				}

				const { metadata, distances, groupedRoutes } = processRouteData(data)
				const recentList = Object.entries(metadata)
					.map(([sessionId, meta]) => ({
						sessionId,
						...meta,
						distance: distances[sessionId] || 0,
					}))
					.sort((a, b) => (b.endTimestamp || 0) - (a.endTimestamp || 0))

				const routesMap = recentList.reduce((acc, track) => {
					acc[track.sessionId] = groupedRoutes[track.sessionId] || []
					return acc
				}, {})

				setRecentTracks(recentList)
				setRecentTrackRoutes(routesMap)
				setRecentTracksStatus({ loading: false, error: null })
			} catch (error) {
				if (!isMounted) return
				console.error('Error fetching recent tracks:', error)
				setRecentTracks([])
				setRecentTrackRoutes({})
				setRecentTracksStatus({
					loading: false,
					error: 'Не удалось загрузить последние треки',
				})
			}
		}

		fetchRecentTracks()

		return () => {
			isMounted = false
		}
	}, [userId, processRouteData, recentTracksLoaded])

	const fetchRouteData = useCallback(
		async targetDate => {
			if (!userId) {
				setTrackStatus({ loading: false, error: null })
				dispatch({ type: 'CLEAR_ROUTES' })
				setSelectedTrackIds([])
				setLastFocusedTrackId(null)
				return
			}
			const dateString = targetDate || selectedDate
			setTrackStatus({ loading: true, error: null })
			dispatch({ type: 'CLEAR_ROUTES' })

			try {
				const startDate = new Date(dateString)
				const endDate = new Date(dateString)
				endDate.setHours(23, 59, 59, 999)

				const data = await fetchRoute(userId, startDate, endDate)
				if (data.length === 0) {
					setTrackStatus({
						loading: false,
						error: 'Треки не найдены за выбранную дату',
					})
					setSelectedTrackIds([])
					setLastFocusedTrackId(null)
				} else {
					const { groupedRoutes, distances, metadata } = processRouteData(data)
					dispatch({
						type: 'SET_ROUTES',
						payload: { data: groupedRoutes, distances, metadata },
					})
					setSelectedTrackIds([])
					setLastFocusedTrackId(null)
					setTrackStatus({ loading: false, error: null })
				}
			} catch (error) {
				console.error('Error fetching route:', error)
				setTrackStatus({ loading: false, error: error.message })
				dispatch({ type: 'CLEAR_ROUTES' })
				setSelectedTrackIds([])
				setLastFocusedTrackId(null)
			}
		},
		[userId, selectedDate, processRouteData]
	)

	useEffect(() => {
		if (selectedDate) {
			fetchRouteData(selectedDate)
		}
	}, [selectedDate, fetchRouteData])

	const handleDateChange = useCallback(e => {
		if (e.target.value) {
			setSelectedDate(e.target.value)
		}
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
		if (!canModifyMap) {
			requireAuth()
			return
		}
		setIsEditMode(true)
		setIsAddingStation(true)
	}, [canModifyMap, requireAuth])

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
			formData.append(
				'isOffline',
				typeof stationData.isOffline !== 'undefined'
					? stationData.isOffline
					: false
			)
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
			formData.append(
				'isOffline',
				typeof updatedData.isOffline !== 'undefined'
					? updatedData.isOffline
					: editingStation.isOffline || false
			)
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

	const normalizeStationId = useCallback(
		station => station?._id ?? station?.id ?? station?.stationId,
		[]
	)

	const computeIsOffline = useCallback(station => {
		return (
			station?.isOffline === true ||
			station?.isOffline === 'true' ||
			station?.isOffline === 1 ||
			station?.isOffline === '1'
		)
	}, [])

	const handleStationStatusChange = useCallback(
		async (stationId, updatedStationData = null) => {
			const targetId = stationId || normalizeStationId(updatedStationData)

			if (updatedStationData && targetId) {
				setChargingStations(prev =>
					prev.map(station =>
						normalizeStationId(station) === targetId
							? { ...station, ...updatedStationData, _id: targetId }
							: station
					)
				)
				setSelectedStation({ ...updatedStationData, _id: targetId })
				// Перезагружаем данные станций, чтобы Leaflet получил обновленные иконки
				fetchChargingStationsData().catch(error =>
					console.error('Error refetching stations:', error)
				)
				return
			}

			if (!targetId) return
			try {
				const updatedStations = await fetchChargingStationsData()
				if (Array.isArray(updatedStations)) {
					const updatedStation = updatedStations.find(
						station => normalizeStationId(station) === targetId
					)
					if (updatedStation) {
						setSelectedStation(updatedStation)
					}
				}
			} catch (error) {
				console.error('Error refreshing station status:', error)
			}
		},
		[
			fetchChargingStationsData,
			setChargingStations,
			setSelectedStation,
			normalizeStationId,
		]
	)

	const toggleHeatmapVisibility = useCallback(() => {
		setShowHeatmap(prev => !prev)
	}, [])

	const startIcon = useMemo(() => createRouteStartMarker('#4285f4'), [])
	const endIcon = useMemo(() => createRouteEndMarker('#EA4335'), [])
	const availableTracks = useMemo(() => {
		if (!routesState.metadata) return []
		return Object.entries(routesState.metadata)
			.map(([sessionId, meta]) => ({
				sessionId,
				...meta,
				distance: routesState.distances[sessionId] || 0,
			}))
			.sort((a, b) => (b.endTimestamp || 0) - (a.endTimestamp || 0))
	}, [routesState.metadata, routesState.distances])

	const trackMetadataMap = useMemo(() => {
		const map = new Map()
		availableTracks.forEach(track => map.set(track.sessionId, track))
		recentTracks.forEach(track => map.set(track.sessionId, track))
		return map
	}, [availableTracks, recentTracks])

	const handleManualRouteMetaChange = useCallback(
		(field, value) => {
			resetManualRouteFeedback()
			setManualRouteMeta(prev => {
				if (field === 'surfaceTypes') {
					const nextList = Array.isArray(value) ? value.filter(Boolean) : []
					const unique = Array.from(new Set(nextList))
					return { ...prev, surfaceTypes: unique }
				}
				return {
					...prev,
					[field]: value,
				}
			})
		},
		[resetManualRouteFeedback, setManualRouteMeta]
	)
	const {
		handleManualRouteClear,
		handleManualRouteResetPoints,
		handleManualRouteToggle,
		handleManualRouteUndo,
		handleManualRouteEdit,
	} = useManualRouteActions({
		canModifyMap,
		requireAuth,
		manualRouteMode,
		manualRoutePath,
		manualRoutePoints,
		setManualRouteMode,
		setManualRoutePoints,
		setManualRouteLegDistances,
		setManualRoutePath,
		setManualRouteEditingRouteId,
		setManualRouteStatus,
		manualRoutePointDragLockRef,
		resetManualRouteFeedback,
	})

	const handleEditModeToggle = useCallback(() => {
		setIsEditMode(prev => {
			const next = !prev
			if (!next) {
				handleManualRouteClear()
				setIsAddingStation(false)
				setNewStation(null)
				onAddClose()
			}
			return next
		})
	}, [handleManualRouteClear, onAddClose, setIsAddingStation, setNewStation])

	const { handleManualRouteSave } = useManualRouteSaving({
		userId,
		manualRoutePoints,
		manualRoutePositions,
		manualRouteMeta,
		mapLayer,
		manualRouteProfile,
		manualRouteFollowRoads,
		manualRouteDistanceKm,
		manualRouteEditingRouteId,
		saveUserRoute,
		setSavedRoutes,
		setVisibleSavedRouteIds,
		setManualRouteEditingRouteId,
		setManualRouteStatus,
		resetManualRouteFeedback,
	})

const handleManualRouteComplete = useCallback(async () => {
		const saved = await handleManualRouteSave()
		if (saved) {
			handleManualRouteClear()
			setManualRouteMeta({
				name: '',
				description: '',
				color: DEFAULT_MANUAL_ROUTE_COLOR,
				mapProvider: '',
				difficulty: '',
				surfaceTypes: [],
			})
		}
	}, [handleManualRouteSave, handleManualRouteClear, manualRouteProfile])

	const handleOpenSharedRouteFromCatalog = useCallback(sharedId => {
		if (!sharedId || typeof window === 'undefined') return
		const hash = window.location.hash || '#/'
		const queryIndex = hash.indexOf('?')
		const basePath =
			queryIndex === -1 ? hash || '#/' : hash.substring(0, queryIndex) || '#/'
		const params = new URLSearchParams(
			queryIndex === -1 ? '' : hash.substring(queryIndex + 1)
		)
		params.set(SHARED_ROUTE_ID_QUERY_KEY, sharedId)
		params.delete(SHARED_ROUTE_QUERY_KEY)
		const nextHash = `${basePath}?${params.toString()}`
		window.location.hash = nextHash
	}, [])

	useEffect(() => {
		if (!canModifyMap) {
			handleManualRouteClear()
			setManualRouteMeta({
				name: '',
				description: '',
				color: DEFAULT_MANUAL_ROUTE_COLOR,
				mapProvider: '',
				difficulty: '',
				surfaceTypes: [],
			})
		}
	}, [canModifyMap, handleManualRouteClear, manualRouteProfile])

	const handleRefreshSavedRoutes = useCallback(() => {
		loadSavedRoutes()
	}, [loadSavedRoutes])

	const handleEditSavedRoute = useCallback(
		route => {
			if (!route || !Array.isArray(route.waypoints) || route.waypoints.length < 2) {
				return
			}

			const nextPoints = route.waypoints
				.map(point => ({
					lat: Number(point.latitude),
					lng: Number(point.longitude),
				}))
				.filter(
					point =>
						!Number.isNaN(point.lat) &&
						!Number.isNaN(point.lng)
				)

			if (nextPoints.length < 2) {
				return
			}

			onDrawerClose()
			manualRoutePointDragLockRef.current = false
			setManualRouteMode(true)

			setManualRouteMeta(prev => ({
				...prev,
				name: route.name || '',
				description: route.description || '',
				color: route.color || DEFAULT_MANUAL_ROUTE_COLOR,
				mapProvider: route.mapProvider || '',
				difficulty: route.difficulty || '',
				surfaceTypes: Array.isArray(route.surfaceTypes) ? route.surfaceTypes : [],
			}))
			setManualRoutePoints(nextPoints)
			const cachedPath = route.routeId ? getCachedRoutePath(route.routeId) : null
			const pathSource =
				(Array.isArray(route.pathCoordinates) && route.pathCoordinates.length >= 2
					? route.pathCoordinates
					: Array.isArray(cachedPath) && cachedPath.length >= 2
					? cachedPath
					: nextPoints.map(point => ({
							latitude: point.lat,
							longitude: point.lng,
					  })))
			const pathPositions = pathSource
				.map(normalizeCoordinatePoint)
				.filter(point => !Number.isNaN(point[0]) && !Number.isNaN(point[1]))
			setManualRoutePath(pathPositions)
			const legDistances = computeWaypointDistancesFromPath(
				pathPositions,
				nextPoints
			)
			setManualRouteLegDistances(legDistances)
			setManualRouteFollowRoads(
				typeof route.followRoads === 'boolean' ? route.followRoads : true
			)
			setManualRouteProfile(route.routingProfile || 'driving')
			setManualRouteEditingRouteId(route.routeId || null)
			resetManualRouteFeedback()
		},
		[resetManualRouteFeedback, onDrawerClose]
	)

	const handleDeleteSavedRoute = useCallback(
		async routeId => {
			if (!routeId || !userId) return
			try {
				let sharedId = null
				try {
					const route = savedRoutes.find(item => item?.routeId === routeId)
					if (route?.sharedId) {
						sharedId = route.sharedId
					}
				} catch (lookupError) {
					console.warn('Failed to read sharedId from savedRoutes:', lookupError)
				}
				if (!sharedId && publishedRoutesMap && publishedRoutesMap[routeId]) {
					sharedId = publishedRoutesMap[routeId]
				}
				if (sharedId) {
					try {
						await deleteSharedRouteRecord(sharedId)
					} catch (error) {
						console.warn('Failed to remove shared route on delete:', error)
					}
					setPublishedRoutesMap(prev => {
						if (!prev || typeof prev !== 'object') return prev
						const next = { ...prev }
						delete next[routeId]
						return next
					})
					if (typeof window !== 'undefined') {
						window.dispatchEvent(
							new CustomEvent('shared-route-published', {
								detail: { sharedId, routeId, removed: true },
							})
						)
					}
				}

				await deleteUserRoute(userId, routeId)
				setSavedRoutes(prev => prev.filter(route => route.routeId !== routeId))
				setVisibleSavedRouteIds(prev => prev.filter(id => id !== routeId))
				removeCachedRoutePath(routeId)
			} catch (error) {
				console.error('Error deleting route:', error)
			}
		},
		[userId, savedRoutes, publishedRoutesMap, setPublishedRoutesMap]
	)

	const handleToggleSavedRouteVisibility = useCallback(routeId => {
		if (!routeId) return
		setVisibleSavedRouteIds(prev =>
			prev.includes(routeId)
				? prev.filter(id => id !== routeId)
				: [routeId, ...prev]
		)
	}, [setVisibleSavedRouteIds])

	const selectedTrackRenderList = useMemo(() => {
		return selectedTrackIds
			.map(sessionId => {
				const track = trackMetadataMap.get(sessionId)
				if (!track) return null
				const routePoints =
					routesState.data[sessionId] || recentTrackRoutes[sessionId] || []
				if (!routePoints.length) return null
				const positions = routePoints.map(point => [
					point.latitude,
					point.longitude,
				])
				return { sessionId, track, positions }
			})
			.filter(Boolean)
	}, [selectedTrackIds, trackMetadataMap, routesState.data, recentTrackRoutes])

	const savedRouteRenderList = useMemo(() => {
		return savedRoutes
			.filter(route => {
				if (!visibleSavedRouteIds.includes(route.routeId)) {
					return false
				}
				if (
					manualRouteEditingRouteId &&
					route.routeId === manualRouteEditingRouteId
				) {
					return false
				}
				return true
			})
			.map(route => {
				const cachedPath = route.routeId ? getCachedRoutePath(route.routeId) : null

				const rawPositionsSource =
					(Array.isArray(route.pathCoordinates) &&
						route.pathCoordinates.length >= 2 &&
						route.pathCoordinates) ||
					(Array.isArray(cachedPath) && cachedPath.length >= 2 && cachedPath) ||
					(Array.isArray(route.waypoints) ? route.waypoints : [])

				if (rawPositionsSource.length < 2) return null
				const positions = rawPositionsSource
					.map(normalizeCoordinatePoint)
					.filter(
						point => !Number.isNaN(point[0]) && !Number.isNaN(point[1])
					)
				if (positions.length < 2) return null

				const waypointPositions =
					Array.isArray(route.waypoints) && route.waypoints.length >= 2
						? route.waypoints
								.map(normalizeCoordinatePoint)
								.filter(
									point => !Number.isNaN(point[0]) && !Number.isNaN(point[1])
								)
						: []

				const color = route.color || '#6366F1'

				const waypointObjects = waypointPositions.map(([lat, lng]) => ({
					lat,
					lng,
				}))
				const legDistances = computeWaypointDistancesFromPath(
					positions,
					waypointObjects
				)
				let cumulative = 0
				const distanceLabels = waypointObjects.map((point, index) => {
					if (index > 0) {
						cumulative += legDistances[index - 1] || 0
					}
					return {
						id: `saved-route-distance-${route.routeId}-${index}`,
						position: [point.lat, point.lng],
						icon: createDistanceLabelIcon(color, formatDistanceLabel(cumulative)),
					}
				})

				return {
					routeId: route.routeId,
					name: route.name,
					color,
					positions,
					waypoints: waypointPositions,
					waypointIcon: createManualRoutePointIcon(
						color || DEFAULT_MANUAL_ROUTE_COLOR
					),
					distanceLabels,
					startIcon: createRouteStartMarker(color),
					endIcon: createRouteEndMarker(color),
				}
			})
			.filter(Boolean)
	}, [savedRoutes, visibleSavedRouteIds, manualRouteEditingRouteId])

	const sharedRouteRenderItem = useMemo(() => {
		if (
			!sharedRoutePreview ||
			!Array.isArray(sharedRoutePreview.path) ||
			sharedRoutePreview.path.length < 2
		) {
			return null
		}
		const positions = sharedRoutePreview.path
			.map(pair => {
				if (Array.isArray(pair) && pair.length >= 2) {
					return [Number(pair[0]), Number(pair[1])]
				}
				if (typeof pair === 'object') {
					const lat = Number(pair.lat ?? pair.latitude)
					const lng = Number(pair.lng ?? pair.longitude)
					return [lat, lng]
				}
				return [NaN, NaN]
			})
			.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]))
		if (positions.length < 2) {
			return null
		}
		const toWaypointObject = point => {
			if (!point) return null
			if (Array.isArray(point) && point.length >= 2) {
				const lat = Number(point[0])
				const lng = Number(point[1])
				return Number.isFinite(lat) && Number.isFinite(lng)
					? { lat, lng }
					: null
			}
			if (typeof point === 'object') {
				const lat = Number(point.lat ?? point.latitude)
				const lng = Number(point.lng ?? point.longitude)
				return Number.isFinite(lat) && Number.isFinite(lng)
					? { lat, lng }
					: null
			}
			return null
		}
		const waypointObjects = Array.isArray(sharedRoutePreview.waypoints)
			? sharedRoutePreview.waypoints.map(toWaypointObject).filter(Boolean)
			: []
		const legDistances = computeWaypointDistancesFromPath(
			positions,
			waypointObjects
		)
		let cumulative = 0
		const color = sharedRoutePreview.color || '#3182CE'
		const distanceLabels = waypointObjects.map((point, index) => {
			if (index > 0) {
				cumulative += legDistances[index - 1] || 0
			}
			return {
				id: `shared-route-distance-${index}`,
				position: [point.lat, point.lng],
				icon: createDistanceLabelIcon(color, formatDistanceLabel(cumulative)),
			}
		})

		return {
			routeId: sharedRoutePreview.routeId || 'shared-route',
			name:
				sharedRoutePreview.name ||
				sharedRoutePreview.routeId ||
				'Маршрут по ссылке',
			color,
			positions,
			waypoints: waypointObjects,
			startIcon: createRouteStartMarker(color),
			endIcon: createRouteEndMarker(color),
			waypointIcon: createManualRoutePointIcon(color),
			distanceLabels,
		}
	}, [sharedRoutePreview])

	const visibleSharedRoutesCatalog = useMemo(() => {
		if (!Array.isArray(sharedRoutesCatalog) || !sharedRoutesCatalog.length) {
			return []
		}
		const withCoords = sharedRoutesCatalog.filter(item => {
			const lat = Number(item?.startPoint?.latitude ?? item?.startPoint?.lat)
			const lng = Number(item?.startPoint?.longitude ?? item?.startPoint?.lng)
			return Number.isFinite(lat) && Number.isFinite(lng)
		})
		if (!mapBounds) {
			return withCoords
		}
		return withCoords.filter(item => {
			const lat = Number(item?.startPoint?.latitude ?? item?.startPoint?.lat)
			const lng = Number(item?.startPoint?.longitude ?? item?.startPoint?.lng)
			return mapBounds.contains(L.latLng(lat, lng))
		})
	}, [sharedRoutesCatalog, mapBounds])

	const sharedRoutesCatalogMarkers = useMemo(() => {
		const catalogSource = Array.isArray(visibleSharedRoutesCatalog)
			? visibleSharedRoutesCatalog
			: sharedRoutesCatalog
		if (!showSharedRoutesCatalog || !catalogSource.length) {
			return null
		}
		return catalogSource
			.map(item => {
				if (!item) return null
				const lat = Number(item.startPoint?.latitude ?? item.startPoint?.lat)
				const lng = Number(item.startPoint?.longitude ?? item.startPoint?.lng)
				if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
					return null
				}
				const color = item.color || '#7C3AED'
				const icon = createRouteStartMarker(color)
				return (
					<Marker
						key={`shared-route-pin-${item.sharedId || `${lat}-${lng}`}`}
						position={[lat, lng]}
						icon={icon}
					>
						<Popup>
							<div style={{ minWidth: '150px' }}>
								<strong>{item.name || 'Маршрут'}</strong>
								{typeof item.distanceKm === 'number' && (
									<div style={{ fontSize: '12px', color: '#4a5568' }}>
										Дистанция: {item.distanceKm.toFixed(2)} км
									</div>
								)}
								{resolveSharedRouteAuthor(item) && (
									<div style={{ fontSize: '12px', color: '#4a5568' }}>
										Автор: {resolveSharedRouteAuthor(item)}
									</div>
								)}
								{item.createdAt && (
									<div style={{ fontSize: '12px', color: '#718096' }}>
										Дата: {new Date(item.createdAt).toLocaleDateString('ru-RU')}
									</div>
								)}
								<button
									style={{
										marginTop: '8px',
										padding: '4px 8px',
										background: '#4c51bf',
										color: '#fff',
										border: 'none',
										borderRadius: '4px',
										cursor: 'pointer',
									}}
									onClick={() =>
										handleOpenSharedRouteFromCatalog(item.sharedId)
									}
								>
									Открыть
								</button>
							</div>
						</Popup>
					</Marker>
				)
			})
			.filter(Boolean)
	}, [
		showSharedRoutesCatalog,
		sharedRoutesCatalog,
		visibleSharedRoutesCatalog,
		handleOpenSharedRouteFromCatalog,
		resolveSharedRouteAuthor,
	])

	// Локации для отображения погоды (районы и пригороды Санкт-Петербурга)

	const [workshops, setWorkshops] = useState([])

	// Добавляем загрузку мастерских
	useEffect(() => {
		const fetchWorkshops = async () => {
			try {
				const response = await fetch(`${API_BASE_URL}/workshops`)
				if (!response.ok) {
					throw new Error('Не удалось загрузить мастерские')
				}
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

	const getMarkerIcon = useCallback(
		station => {
			const isStationOffline = computeIsOffline(station)
			const markerType =
				station.markerType === 'charging' && station.is24Hours
					? 'charging24'
					: station.markerType

			if (isStationOffline && markerType !== 'workshop') {
				const offlineOptions = {
					badgeLabel: 'OFF',
					badgeColor: '#1f2937',
					badgeTextColor: '#fff',
					className: 'offline-marker',
				}

				switch (markerType) {
					case 'charging24':
						return createCharging24Marker(offlineOptions)
					case 'chargingAuto':
						return createChargingAutoMarker(offlineOptions)
					case 'interesting':
						return createInterestingMarker(offlineOptions)
					case 'danger':
						return createDangerMarker(offlineOptions)
					case 'chat':
						return createChatMarker(offlineOptions)
					default:
						return createChargingMarker(offlineOptions)
				}
			}

			return icons[markerType] || icons.charging
		},
		[icons, computeIsOffline]
	)

	const getMarkerKey = useCallback(
		station => {
			const id = normalizeStationId(station)
			const offline = computeIsOffline(station) ? 'offline' : 'online'
			return `${id}-${offline}`
		},
		[normalizeStationId, computeIsOffline]
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

	// Состояние для зума и связанные хуки
	const [currentZoom, setCurrentZoom] = useState(DEFAULT_MAP_ZOOM)
	const [layersControlOffset, setLayersControlOffset] = useState(0)

	// Дебаунсим обновление зума для предотвращения частых перерендеров
	const debouncedSetZoom = useMemo(
		() => debounce(zoom => setCurrentZoom(zoom), 100),
		[]
	)

	useEffect(() => {
		if (!mapInstance || !lastFocusedTrackId) return
		const target = selectedTrackRenderList.find(
			item => item.sessionId === lastFocusedTrackId
		)
		if (!target || !target.positions.length) return
		const bounds = L.latLngBounds(target.positions)
		mapInstance.fitBounds(bounds, { padding: [40, 40] })
	}, [mapInstance, lastFocusedTrackId, selectedTrackRenderList])

	useEffect(() => {
		if (!sharedRouteRenderItem || !mapInstance) return
		try {
			const bounds = L.latLngBounds(sharedRouteRenderItem.positions)
			mapInstance.fitBounds(bounds, { padding: [40, 40] })
		} catch (error) {
			console.error('Failed to focus shared route:', error)
		}
	}, [sharedRouteRenderItem, mapInstance])

	const handleTrackToggle = useCallback(sessionId => {
		setSelectedTrackIds(prev => {
			if (prev.includes(sessionId)) {
				const next = prev.filter(id => id !== sessionId)
				setLastFocusedTrackId(current =>
					current === sessionId ? next[next.length - 1] || null : current
				)
				return next
			}
			setLastFocusedTrackId(sessionId)
			return [...prev, sessionId]
		})
	}, [])

	// Очищаем дебаунс при размонтировании
	useEffect(() => {
		return () => {
			debouncedSetZoom.cancel()
		}
	}, [debouncedSetZoom])

	// Смещаем кнопки на правой панели ниже переключателя слоев карты
	useEffect(() => {
		if (!mapInstance) return

		const layersControl = document.querySelector('.leaflet-control-layers')
		if (!layersControl) {
			setLayersControlOffset(0)
			return
		}

		const applyOffset = height => {
			const offsetValue = Math.round(height + 16) // добавляем небольшой отступ
			setLayersControlOffset(prev =>
				prev !== offsetValue ? offsetValue : prev
			)
		}

		const updateOffsetFromElement = () => {
			if (layersControl.classList.contains('leaflet-control-layers-expanded')) {
				return
			}
			const rect = layersControl.getBoundingClientRect()
			applyOffset(rect.height)
		}

		const resizeHandler = () => {
			if (layersControl.classList.contains('leaflet-control-layers-expanded')) {
				return
			}
			updateOffsetFromElement()
		}

		updateOffsetFromElement()

		let resizeObserver = null
		let mutationObserver = null
		let hasWindowListener = false

		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(entries => {
				if (layersControl.classList.contains('leaflet-control-layers-expanded')) {
					return
				}
				const entry = entries[0]
				if (entry?.contentRect) {
					applyOffset(entry.contentRect.height)
				} else {
					updateOffsetFromElement()
				}
			})
			resizeObserver.observe(layersControl)
		} else if (typeof MutationObserver !== 'undefined') {
			mutationObserver = new MutationObserver(() => {
				if (
					layersControl.classList.contains('leaflet-control-layers-expanded')
				) {
					return
				}
				updateOffsetFromElement()
			})
			mutationObserver.observe(layersControl, {
				attributes: true,
				childList: true,
				subtree: true,
			})
			window.addEventListener('resize', resizeHandler)
			hasWindowListener = true
		} else {
			window.addEventListener('resize', resizeHandler)
			hasWindowListener = true
		}

			return () => {
			if (resizeObserver) {
				resizeObserver.disconnect()
			}
			if (mutationObserver) {
				mutationObserver.disconnect()
			}
			if (hasWindowListener) {
				window.removeEventListener('resize', resizeHandler)
			}
		}
	}, [mapInstance])

	// Определяем, нужно ли использовать кластеризацию в зависимости от зума и количества маркеров
	const shouldUseClustering = useMemo(() => {
		// Используем кластеризацию при зуме меньше 14 или при большом количестве маркеров
		const clustering = currentZoom < 14 || filteredMarkers.length > 100
		// Логируем только в dev режиме
		if (process.env.NODE_ENV === 'development') {
			console.log(
				`🗺️ Map Performance - Zoom: ${currentZoom}, Total: ${filteredMarkers.length}, Clustering: ${clustering}`
			)
		}
		return clustering
	}, [currentZoom, filteredMarkers.length])

	// Мемоизируем настройки кластера для лучшей производительности
	const clusterOptions = useMemo(
		() => ({
			maxClusterRadius: currentZoom < 10 ? 90 : currentZoom < 12 ? 60 : 40,
			disableClusteringAtZoom: 15,
			spiderfyOnMaxZoom: true,
			showCoverageOnHover: false,
			zoomToBoundsOnClick: true,
			removeOutsideVisibleBounds: true,
			animateAddingMarkers: false,
			chunkedLoading: true,
			chunkDelay: currentZoom < 8 ? 50 : 10,
			chunkProgress: null,
		}),
		[currentZoom]
	)

	// Отфильтрованные маркеры, видимые в текущей области карты
	// Исключаем активных пользователей из фильтрации по границам, чтобы избежать мерцания
	const visibleMarkers = useMemo(() => {
		let markers = filteredMarkers

		// Фильтруем по границам карты если они определены
		if (mapBounds) {
			markers = markers.filter(isMarkerInBounds)
		}

		// На очень низких уровнях зума ограничиваем количество маркеров для производительности
		if (currentZoom < 10 && markers.length > 500) {
			const originalCount = markers.length

			// Используем более агрессивную фильтрацию на низких зумах
			if (currentZoom < 6) {
				// На очень низком зуме показываем только самые важные маркеры
				markers = markers.filter((_, index) => index % 20 === 0).slice(0, 100)
			} else if (currentZoom < 8) {
				// На низком зуме показываем каждый 10-й маркер
				markers = markers.filter((_, index) => index % 10 === 0).slice(0, 250)
			} else if (currentZoom < 9) {
				// На среднем зуме показываем каждый 5-й маркер
				markers = markers.filter((_, index) => index % 5 === 0).slice(0, 400)
			} else {
				// На высоком зуме показываем каждый 3-й маркер
				markers = markers.filter((_, index) => index % 3 === 0)
			}

			// Логируем только в dev режиме
			if (process.env.NODE_ENV === 'development') {
				console.log(
					`📍 Zoom Optimization - ${originalCount} → ${markers.length} markers (zoom: ${currentZoom})`
				)
			}
		}

		return markers
	}, [filteredMarkers, mapBounds, isMarkerInBounds, currentZoom])

	const MapEvents = () => {
		const map = useMapEvents({
			click: e => {
				if (isAddingStation) {
					handleMapClick(e.latlng)
				}
			},
			moveend: handleMapMoveEnd,
			zoomend: e => {
				debouncedSetZoom(e.target.getZoom())
			},
		})

		// Сохраняем экземпляр карты и инициализируем границы
		useEffect(() => {
			if (map) {
				setMapInstance(map)
				if (!mapBounds) {
					setMapBounds(map.getBounds())
				}
			}
		}, [map, mapBounds])

		return null
	}

	const userIcon = createUserMarker()
	const actionButtonsTop = Math.max(layersControlOffset, 10) + WEATHER_BUTTON_OFFSET

		const drawerMenuProps = useDrawerMenuProps({
			selectedDate,
			onDateChange: handleDateChange,
			trackList: availableTracks,
			trackStatus,
			onToggleTrack: handleTrackToggle,
			selectedTrackIds,
			recentTracks,
			recentTracksStatus,
			savedRoutes,
			savedRoutesStatus,
			visibleSavedRouteIds,
			onToggleSavedRouteVisibility: handleToggleSavedRouteVisibility,
			onRefreshSavedRoutes: handleRefreshSavedRoutes,
			onEditSavedRoute: handleEditSavedRoute,
			onDeleteSavedRoute: handleDeleteSavedRoute,
			userId,
			authorName,
			isGuestMode: isGuestView,
			onRequireAuth: requireAuth,
			onRecentTracksToggle: setRecentTracksLoaded,
			sharedRoutesCatalog,
			sharedRoutesCatalogStatus,
			onOpenSharedRouteFromCatalog: handleOpenSharedRouteFromCatalog,
			onRefreshSharedRoutesCatalog: handleRefreshSharedRoutesCatalog,
			onEnsureCatalogVisible: ensureSharedRoutesCatalogVisible,
			visibleSharedRoutesCatalog,
		})

	return (
		<Box
			position='relative'
			display='flex'
			flexDirection='column'
	height='100vh'
	paddingBottom='50px'
>
		<Box
			position='absolute'
			top={{ base: '8px', md: '10px' }}
			left='11px'
			zIndex={1100}
		>
			<MapTopControls
				isDesktopSidebar={isDesktopSidebar}
				isDrawerOpen={isDrawerOpen}
				onDrawerOpen={onDrawerOpen}
				manualRouteMode={manualRouteMode}
				onManualRouteToggle={handleManualRouteToggle}
				isEditMode={isEditMode}
				onEditModeToggle={handleEditModeToggle}
				onAddStation={handleAddStationClick}
				isAddingStation={isAddingStation}
				showSharedRoutesCatalog={showSharedRoutesCatalog}
				isGuestView={isGuestView}
				onRequireAuth={requireAuth}
				sharedRoutePreview={sharedRoutePreview}
				onSharedRouteClear={handleSharedRouteClear}
				sharedRouteFetchStatus={sharedRouteFetchStatus}
				sharedRouteError={sharedRouteError}
				sharedRoutesCatalogStatus={sharedRoutesCatalogStatus}
			/>
		</Box>

				<ManualRoutePanel
					isVisible={shouldShowManualRoutePanel}
					panelRef={manualRoutePanelRef}
					position={manualRoutePanelPosition}
					isCompact={isCompactManualPanel}
					isCollapsed={manualRoutePanelIsCollapsed}
					actionButtonSize={manualRouteActionButtonSize}
					controlSize={manualRouteControlSize}
					followRoads={manualRouteFollowRoads}
					profile={manualRouteProfile}
					profileOptions={MANUAL_ROUTE_PROFILES}
					profileLabel={manualRouteProfileLabel}
					summaryDistance={manualRouteSummaryDistance}
					mode={manualRouteMode}
					saveDisabled={manualRouteSaveDisabled}
					hasExistingRoute={manualRouteHasExistingRoute}
					hasUndo={manualRouteHasUndo}
					meta={manualRouteMeta}
					routingStatus={manualRouteRoutingStatus}
					status={manualRouteStatus}
					onPointerDown={handleManualRoutePanelPointerDown}
					onToggleCollapse={handleManualRoutePanelToggle}
					onComplete={handleManualRouteComplete}
					onClear={handleManualRouteClear}
					onUndo={handleManualRouteUndo}
					onReset={handleManualRouteResetPoints}
					onProfileChange={setManualRouteProfile}
					onFollowRoadsChange={setManualRouteFollowRoads}
					onMetaChange={handleManualRouteMetaChange}
					onEdit={handleManualRouteEdit}
				/>

				<DrawerMenuContainer
					isDesktop={isDesktopSidebar}
					sidebarPosition={sidebarPosition}
					onSidebarPointerDown={handleSidebarPointerDown}
					drawerIsOpen={isDrawerOpen}
					onDrawerClose={onDrawerClose}
			menuProps={drawerMenuProps}
		/>

				<Box
					position='absolute'
					top={`${floatingControlsPosition.top}px`}
					left={`${floatingControlsPosition.left}px`}
					zIndex={1100}
					onPointerDown={handleFloatingControlsPointerDown}
					display='flex'
					flexDirection='column'
					gap='4px'
					cursor='grab'
					data-drag-area
				>
					<Box
						data-drag-handle
						width='50px'
						height='10px'
						borderRadius='full'
						bg='gray.200'
						alignSelf='flex-start'
						ml='5px'
						boxShadow='sm'
					/>
					<Box
						bg='rgba(238, 231, 231, 0.4)'
						borderRadius='md'
						boxShadow='md'
						p='8px'
						display='flex'
						flexDirection='column'
						gap='10px'
						cursor='default'
						data-no-drag
						
					>
						<Box
							display='flex'
							flexDirection='column'
							gap='10px'
							alignItems='center'
						>
							<MobileTooltip label={showChargingStations ? 'Скрыть станции' : 'Показать станции'}>
								<IconButton
									as={motion.button}
									{...buttonMotion}
									onClick={toggleChargingStations}
									variant='solid'
									icon={<HiLocationMarker />}
									colorScheme={showChargingStations ? 'blue' : 'gray'}
									size='md'
									borderRadius={3}
									borderColor='gray'
									borderWidth={2}
									width='34px'
									padding='0'
									sx={baseIconButtonStyles}
									data-no-drag
								/>
							</MobileTooltip>
							<MobileTooltip
								label={
									showSharedRoutesCatalog
										? 'Скрыть каталог маршрутов'
										: 'Показать каталог маршрутов'
								}
							>
								<IconButton
									as={motion.button}
									{...buttonMotion}
									onClick={() => setShowSharedRoutesCatalog(prev => !prev)}
									variant='solid'
									icon={<FaMapMarkedAlt />}
									colorScheme={showSharedRoutesCatalog ? 'purple' : 'gray'}
									size='md'
									borderRadius={3}
									borderColor='gray'
									borderWidth={2}
									width='34px'
									padding='0'
									sx={baseIconButtonStyles}
									aria-label='Каталог маршрутов'
									data-no-drag
								/>
							</MobileTooltip>
							<MobileTooltip label='Моё местоположение'>
								<IconButton
									as={motion.button}
									{...buttonMotion}
									onClick={centerOnUser}
									icon={<FaLocationArrow />}
									colorScheme='blue'
									size='md'
									borderRadius={3}
									borderColor='gray'
									borderWidth={2}
									width='34px'
									padding='0'
									sx={baseIconButtonStyles}
									data-no-drag
								/>
							</MobileTooltip>
							<MobileTooltip label={showActiveUsers ? 'Скрыть пользователей' : 'Показать пользователей'}>
								<IconButton
									as={motion.button}
									{...buttonMotion}
									onClick={toggleActiveUsers}
									variant='solid'
									icon={<FaUsers />}
									colorScheme={showActiveUsers ? 'green' : 'gray'}
									size='md'
									borderRadius={3}
									borderColor='gray'
									borderWidth={2}
									width='34px'
									padding='0'
									sx={baseIconButtonStyles}
									data-no-drag
								/>
							</MobileTooltip>
							<HeatmapControl
								inline
								showHeatmap={showHeatmap}
								onToggleHeatmap={toggleHeatmapVisibility}
								heatmapStatus={heatmapStatus}
								heatmapPeriod={heatmapPeriod}
								handleHeatmapPeriodChange={handleHeatmapPeriodChange}
								heatmapMonth={heatmapMonth}
								setHeatmapMonth={setHeatmapMonth}
								heatmapYear={heatmapYear}
								setHeatmapYear={setHeatmapYear}
							/>
							<MarkerFilterControl
								inline
								filters={markerFilters}
								onFilterChange={setMarkerFilters}
							/>
						</Box>
					</Box>
				</Box>

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
					center={mapCenter}
					zoom={DEFAULT_MAP_ZOOM}
					attributionControl={false}
					zoomControl={false}
					style={{ height: '100%', width: '100%' }}
					whenCreated={mapInstance => {
						mapRef.current = mapInstance
						setMapInstance(mapInstance)
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
							{shouldUseClustering ? (
								<ModernMarkerClusterGroup {...clusterOptions}>
									{visibleMarkers.map(marker => (
										<OptimizedMarker
											key={getMarkerKey(marker)}
											marker={marker}
										/>
									))}
								</ModernMarkerClusterGroup>
							) : (
								<>
									{visibleMarkers.map(marker => (
										<OptimizedMarker
											key={getMarkerKey(marker)}
											marker={marker}
										/>
									))}
								</>
							)}
						</>
					)}

					{selectedTrackRenderList.map((item, idx) => {
						if (!item || !item.positions || item.positions.length === 0)
							return null
						const color = RECENT_TRACK_COLORS[idx % RECENT_TRACK_COLORS.length]

						return (
							<React.Fragment key={`selected-track-${item.sessionId}`}>
								<Polyline
									positions={item.positions}
									color={color}
									weight={4}
									opacity={0.85}
								/>
								<Marker position={item.positions[0]} icon={startIcon}>
									<Popup>
										{`Начало трека: ${
											item.track.startTimestamp
												? new Date(item.track.startTimestamp).toLocaleString()
												: 'Неизвестно'
										}`}
									</Popup>
								</Marker>
								{item.positions.length > 1 && (
									<Marker
										position={item.positions[item.positions.length - 1]}
										icon={endIcon}
									>
										<Popup>
											{`Конец трека: ${
												item.track.endTimestamp
													? new Date(item.track.endTimestamp).toLocaleString()
													: 'Неизвестно'
											}\nПробег: ${(item.track.distance / 1000).toFixed(2)} км`}
										</Popup>
									</Marker>
								)}
							</React.Fragment>
						)
					})}

					{savedRouteRenderList.map(route => (
						<React.Fragment key={`saved-route-${route.routeId}`}>
							<Polyline
								positions={route.positions}
								color={route.color}
								weight={5}
								opacity={0.85}
							/>
							<Marker position={route.positions[0]} icon={route.startIcon}>
								<Popup>{`Начало маршрута: ${route.name || route.routeId}`}</Popup>
							</Marker>
							<Marker
								position={route.positions[route.positions.length - 1]}
								icon={route.endIcon}
							>
								<Popup>{`Конец маршрута: ${route.name || route.routeId}`}</Popup>
							</Marker>
							{route.waypoints &&
								route.waypoints.length > 2 &&
								route.waypoints.slice(1, -1).map((point, index) => (
									<Marker
										key={`saved-route-waypoint-${route.routeId}-${index}`}
										position={point}
										icon={route.waypointIcon}
										interactive={false}
									/>
								))}
							{route.distanceLabels?.map(label => (
								<Marker
									key={label.id}
									position={label.position}
									icon={label.icon}
									interactive={false}
								/>
							))}
						</React.Fragment>
					))}

					{sharedRouteRenderItem && (
						<React.Fragment key='shared-route-preview'>
							<Polyline
								positions={sharedRouteRenderItem.positions}
								color={sharedRouteRenderItem.color}
								weight={5}
								opacity={0.85}
							/>
							<Marker
								position={sharedRouteRenderItem.positions[0]}
								icon={sharedRouteRenderItem.startIcon}
							>
								<Popup>
									{`Начало маршрута: ${
										sharedRouteRenderItem.name ||
										sharedRouteRenderItem.routeId
									}`}
								</Popup>
							</Marker>
							<Marker
								position={
									sharedRouteRenderItem.positions[
										sharedRouteRenderItem.positions.length - 1
									]
								}
								icon={sharedRouteRenderItem.endIcon}
							>
								<Popup>
									{`Конец маршрута: ${
										sharedRouteRenderItem.name ||
										sharedRouteRenderItem.routeId
									}`}
								</Popup>
							</Marker>
							{sharedRouteRenderItem.waypoints &&
								sharedRouteRenderItem.waypoints.length > 2 &&
								sharedRouteRenderItem.waypoints
									.slice(1, -1)
									.map((point, index) => (
										<Marker
											key={`shared-route-waypoint-${index}`}
											position={[point.lat, point.lng]}
											icon={sharedRouteRenderItem.waypointIcon}
											interactive={false}
										/>
									))}
							{sharedRouteRenderItem.distanceLabels?.map(label => (
								<Marker
									key={label.id}
									position={label.position}
									icon={label.icon}
									interactive={false}
								/>
							))}
						</React.Fragment>
					)}

					{showSharedRoutesCatalog && sharedRoutesCatalogMarkers}

					{manualRoutePositions.length > 0 && (
						<React.Fragment>
							<Polyline
								positions={manualRoutePositions}
								color={manualRouteMeta.color || DEFAULT_MANUAL_ROUTE_COLOR}
								weight={6}
								opacity={0.95}
								eventHandlers={{
									click: handleManualRoutePolylineClick,
								}}
							/>
							{manualRouteDistanceLabels.map(label => (
								<Marker
									key={label.id}
									position={label.position}
									icon={label.icon}
									interactive={false}
								/>
							))}
							{manualRoutePoints.map((point, index) => {
								const icon =
									index === 0
										? manualRouteStartIcon
										: index === manualRoutePoints.length - 1
										? manualRouteEndIcon
										: manualRoutePointIcon
								const draggable = canDragManualPoints
								const markerProps = {
									position: [point.lat, point.lng],
									icon,
									draggable,
								}

								const eventHandlers = draggable
									? {
											dragstart: () => {
												manualRoutePointDragLockRef.current = true
											},
											drag: event => {
												const newLatLng = event.target.getLatLng()
												updateManualRoutePoint(index, newLatLng)
											},
											dragend: event => {
												const newLatLng = event.target.getLatLng()
												updateManualRoutePoint(index, newLatLng)
												requestAnimationFrame(() => {
													manualRoutePointDragLockRef.current = false
												})
											},
											contextmenu: () => removeManualRoutePoint(index),
									  }
									: undefined

								return (
									<Marker
										key={`manual-point-${index}`}
										{...markerProps}
										eventHandlers={eventHandlers}
									>
										{draggable && (
											<Popup>
												<Text fontSize='sm'>
													Точка {index + 1}. Перетащите для коррекции, правый
													клик – удалить.
												</Text>
											</Popup>
										)}
									</Marker>
								)
							})}
						</React.Fragment>
					)}

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
						mapInstance && (
							<PersistentUserMarkers
								users={memoizedActiveUsers}
								admins={admins}
								map={mapInstance}
							/>
						)}

					<MapEvents />
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
					onStatusChange={handleStationStatusChange}
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
