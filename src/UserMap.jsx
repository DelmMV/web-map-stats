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
import PerformanceStats from './components/PerformanceStats'
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
				<div class="avatar-container" style="position: relative; width: 45px; height: 45px;">
					${isUserAdmin ? `<div class="staff-badge">STAFF</div>` : ''}
										<img 
							src="/masked-icon.svg" 
							data-avatar="${user.avatarUrl || ''}"
							alt="${user.username}" 
							class="${isUserAdmin ? 'user-marker-admin' : 'user-marker-regular'} ${
					isRecentlyActive ? 'user-marker-active' : ''
				} user-avatar"
							style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; opacity: 1; transition: opacity 0.3s; background: transparent;"
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
							iconSize: [60, 75],
							iconAnchor: [30, 75],
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
									iconSize: [70, 80],
									iconAnchor: [35, 80],
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
							iconSize: [70, 80],
							iconAnchor: [35, 80],
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

	// Мемоизированный список активных пользователей для предотвращения ненужных ре-рендеров
	const memoizedActiveUsers = useMemo(() => {
		return activeUsers || []
	}, [activeUsers])

	const [showActiveUsers, setShowActiveUsers] = useState(false)

	// Состояния для погоды
	const [showWeather, setShowWeather] = useState(() => {
		return JSON.parse(localStorage.getItem('showWeather') || 'false')
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

	// Состояние для зума и связанные хуки
	const [mapInstance, setMapInstance] = useState(null)
	const [currentZoom, setCurrentZoom] = useState(DEFAULT_MAP_ZOOM)
	const [showPerfStats, setShowPerfStats] = useState(false) // По умолчанию отключаем для production

	// Дебаунсим обновление зума для предотвращения частых перерендеров
	const debouncedSetZoom = useMemo(
		() => debounce(zoom => setCurrentZoom(zoom), 100),
		[]
	)

	// Очищаем дебаунс при размонтировании
	useEffect(() => {
		return () => {
			debouncedSetZoom.cancel()
		}
	}, [debouncedSetZoom])

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
			maxClusterRadius: currentZoom < 10 ? 120 : currentZoom < 12 ? 80 : 50,
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
							{shouldUseClustering ? (
								<ModernMarkerClusterGroup {...clusterOptions}>
									{visibleMarkers.map(marker => (
										<OptimizedMarker key={marker._id} marker={marker} />
									))}
								</ModernMarkerClusterGroup>
							) : (
								<>
									{visibleMarkers.map(marker => (
										<OptimizedMarker key={marker._id} marker={marker} />
									))}
								</>
							)}
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
						mapInstance && (
							<PersistentUserMarkers
								users={memoizedActiveUsers}
								admins={admins}
								map={mapInstance}
							/>
						)}

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
				{showWeather && userPosition && (
					<WeatherWidget
						lat={userPosition[0]}
						lon={userPosition[1]}
						isVisible={showWeather}
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
					aria-label='Показать погоду на карте и виджет'
				/>
			</Box>

			<Box position='absolute' top='380px' left='11px' zIndex={1000}>
				<IconButton
					onClick={() => setShowPerfStats(!showPerfStats)}
					variant='solid'
					icon={<span style={{ fontSize: '14px' }}>📊</span>}
					colorScheme={showPerfStats ? 'green' : 'gray'}
					size='md'
					borderRadius={3}
					borderColor='gray'
					borderWidth={2}
					width='30px'
					padding='0'
					aria-label='Показать статистику производительности'
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

			{/* Статистика производительности */}
			<PerformanceStats
				totalMarkers={filteredMarkers.length}
				visibleMarkers={visibleMarkers.length}
				currentZoom={currentZoom}
				shouldUseClustering={shouldUseClustering}
				isVisible={showPerfStats}
			/>
		</Box>
	)
}

export default React.memo(UserMap)
