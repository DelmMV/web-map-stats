import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Box,
	Button,
	HStack,
	Text,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	useBreakpointValue,
	useDisclosure,
	useToast,
	VStack,
	Wrap,
	Tag,
} from '@chakra-ui/react'
import {
	buildSharedRouteIdUrl,
	buildSharedRouteUrl,
	prepareRoutePayload,
} from '../utils/sharedRoute'
import { API_CONFIG } from '../utils/config'
import { motion } from 'framer-motion'
import {
	subtleButtonStyles,
} from '../styles/buttonStyles'
import RouteDetailsDrawer from './RouteDetailsDrawer'
import RouteDetailsModal from './RouteDetailsModal'
import {
	createSharedRouteRecord,
	deleteSharedRouteRecord,
	fetchSharedRouteById,
} from '../services/sharedRouteService'
import { shareUserRoute } from '../services/profileService'
import { formatRouteDate, resolveRouteAuthor } from '../utils/routeFormatters'
import {
	computeRouteDistanceKmValue,
	computeRouteDistanceText,
	extractDescription,
	extractDifficulty,
	extractRouteDateText,
	extractSurfaceTypes,
	normalizeCoordinates,
	formatDifficulty,
	UNKNOWN_DATE_LABEL,
} from '../utils/routeHelpers'
import SavedRoutesSection from './drawerMenu/SavedRoutesSection.jsx'
import TracksSection from './drawerMenu/TracksSection.jsx'
import SharedRoutesCatalogSection from './drawerMenu/SharedRoutesCatalogSection.jsx'
import { useUISelector, useUIStore } from '../state/uiStore.jsx'

const SURFACE_LABELS = {
	forest: 'Лесные дороги',
	sidewalks: 'Тротуары',
	bike_lanes: 'Велодорожки',
	road: 'Проезжая часть',
}

const DrawerMenu = ({
	selectedDate,
	onDateChange,
	trackList = [],
	trackStatus = { loading: false, error: null },
	onToggleTrack = () => {},
	selectedTrackIds = [],
	recentTracks = [],
	recentTracksStatus = { loading: false, error: null },
	savedRoutes = [],
	savedRoutesStatus = { loading: false, error: null },
	visibleSavedRouteIds = [],
	onToggleSavedRouteVisibility = () => {},
	onRefreshSavedRoutes = () => {},
	onEditSavedRoute = () => {},
	onDeleteSavedRoute = () => {},
	userId = null,
	isGuestMode = false,
	onRequireAuth = null,
	onRecentTracksToggle = () => {},
	authorName = '',
	sharedRoutesCatalog = [],
	sharedRoutesCatalogStatus = { loading: false, error: null },
	visibleSharedRoutesCatalog = null,
	onOpenSharedRouteFromCatalog = () => {},
	onRefreshSharedRoutesCatalog = () => {},
	onEnsureCatalogVisible = () => {},
}) => {
	const toast = useToast()
	const ITEMS_PER_PAGE = 4
	const MotionBox = motion(Box)
	const cardMotionProps = {
		whileHover: {
			translateY: -2,
			boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
		},
		transition: { duration: 0.15, ease: 'easeOut' },
	}
	const CATALOG_ITEMS_PER_PAGE = 4
	const [activeTab, setActiveTab] = useState(0)
	const isMobile = useBreakpointValue({ base: true, md: false })
	const { setFlag, setPublishedRoutesMap, setSelectedRoute } = useUIStore()
	const showDailyTracks = useUISelector(state => state.showDailyTracks)
	const showRecentTracks = useUISelector(state => state.showRecentTracks)
	const [savedRoutesPage, setSavedRoutesPage] = useState(1)
	const [sharedRoutesPage, setSharedRoutesPage] = useState(1)
	const [sharedRouteDetails, setSharedRouteDetails] = useState({})
	const sharedRouteDetailsLoadingRef = useRef(new Set())
	const sharedRouteDetailsFetchedRef = useRef(new Set())
	const validatedPublishedSharedIdsRef = useRef(new Set())
	const [expandedDescriptions, setExpandedDescriptions] = useState(() => new Set())
	const selectedRouteDetail = useUISelector(state => state.selectedRouteDetail)
	const selectedRouteActions = useUISelector(state => state.selectedRouteActions)
	const isDesktop = useBreakpointValue({ base: false, md: true })
	const {
		isOpen: isRouteModalOpen,
		onOpen: onRouteModalOpen,
		onClose: onRouteModalClose,
	} = useDisclosure({ defaultIsOpen: false })
	const publishedRoutesMap = useUISelector(state => state.publishedRoutesMap)
	const savedRoutesLoadedRef = useRef(false)

	const setShowDailyTracks = useCallback(
		updater => {
			const next =
				typeof updater === 'function' ? updater(showDailyTracks) : updater
			setFlag('showDailyTracks', next)
		},
		[setFlag, showDailyTracks]
	)

	const setShowRecentTracks = useCallback(
		updater => {
			const next =
				typeof updater === 'function' ? updater(showRecentTracks) : updater
			setFlag('showRecentTracks', next)
		},
		[setFlag, showRecentTracks]
	)

	useEffect(() => {
		if (showRecentTracks) {
			onRecentTracksToggle(true)
		}
	}, [showRecentTracks, onRecentTracksToggle])

	useEffect(() => {
		setSharedRoutesPage(1)
	}, [sharedRoutesCatalog.length, visibleSharedRoutesCatalog])

	const catalogRoutesList = useMemo(() => {
		if (Array.isArray(visibleSharedRoutesCatalog)) {
			return visibleSharedRoutesCatalog
		}
		if (!Array.isArray(sharedRoutesCatalog)) return []
		const filtered = sharedRoutesCatalog.filter(item => {
			const lat = Number(item?.startPoint?.latitude ?? item?.startPoint?.lat)
			const lng = Number(item?.startPoint?.longitude ?? item?.startPoint?.lng)
			return Number.isFinite(lat) && Number.isFinite(lng)
		})
		const deduped = []
		const seen = new Set()
		filtered.forEach(item => {
			if (!item) return
			const key =
				item.sharedId ||
				item.routeId ||
				item.route?.routeId ||
				item.slug ||
				item.name
			const safeKey = key ? String(key) : null
			if (safeKey && seen.has(safeKey)) return
			if (safeKey) seen.add(safeKey)
			deduped.push(item)
		})
		return deduped
	}, [visibleSharedRoutesCatalog, sharedRoutesCatalog])
	const catalogRoutesCount = catalogRoutesList.length || 0
	const visibleRoutesCount = catalogRoutesCount

	const totalSharedRoutesPages = useMemo(() => {
		return Math.max(
			1,
			Math.ceil(catalogRoutesCount / CATALOG_ITEMS_PER_PAGE)
		)
	}, [catalogRoutesCount])

	useEffect(() => {
		setSharedRoutesPage(prev =>
			Math.min(prev, totalSharedRoutesPages || 1)
		)
	}, [totalSharedRoutesPages])

	const paginatedSharedRoutes = useMemo(() => {
		const start = (sharedRoutesPage - 1) * CATALOG_ITEMS_PER_PAGE
		return catalogRoutesList.slice(start, start + CATALOG_ITEMS_PER_PAGE)
	}, [catalogRoutesList, sharedRoutesPage])

	const ensureSharedRecordAlive = useCallback(async sharedId => {
		if (!sharedId) return false
		try {
			const response = await fetch(
				`${API_CONFIG.BASE_URL}/shared-routes/${encodeURIComponent(sharedId)}`
			)
			if (response.status === 404) return false
			return response.ok
		} catch (error) {
			console.warn('Failed to validate shared route', sharedId, error)
			// сервер может быть временно недоступен — не считаем запись удаленной
			return null
		}
	}, [])

	// Доп. валидация статуса публикации — очищаем локальную карту, если на сервере записи уже нет
	useEffect(() => {
		const entries = Object.entries(publishedRoutesMap || {})
		if (!entries.length) return undefined
		let cancelled = false
		const validate = async () => {
			const toRemove = []
			for (const [routeId, sharedId] of entries) {
				if (!sharedId) continue
				// защищаемся от лавины повторных запросов при множественных рендерах
				if (validatedPublishedSharedIdsRef.current.has(sharedId)) continue
				validatedPublishedSharedIdsRef.current.add(sharedId)
				const alive = await ensureSharedRecordAlive(sharedId)
				if (alive === false) {
					toRemove.push(routeId)
					validatedPublishedSharedIdsRef.current.delete(sharedId)
				}
			}
			if (cancelled || !toRemove.length) return
			setPublishedRoutesMap(prev => {
				const next = { ...prev }
				toRemove.forEach(id => delete next[id])
				return next
			})
		}
		validate()
		return () => {
			cancelled = true
		}
	}, [publishedRoutesMap, ensureSharedRecordAlive, setPublishedRoutesMap])

	useEffect(() => {
		const idsToFetch = paginatedSharedRoutes
			.map(item => item?.sharedId)
			.filter(
				id =>
					id &&
					!sharedRouteDetailsLoadingRef.current.has(id) &&
					!sharedRouteDetailsFetchedRef.current.has(id)
			)
		if (!idsToFetch.length) return undefined
		let isMounted = true
		idsToFetch.forEach(id => {
			sharedRouteDetailsLoadingRef.current.add(id)
			sharedRouteDetailsFetchedRef.current.add(id) // mark early to avoid loops
			fetchSharedRouteById(id)
				.then(data => {
					if (!isMounted) return
					const routePayload = data?.route || data
					if (!routePayload) return
					const mergedPayload = {
						...routePayload,
						createdAt:
							data?.createdAt ??
							routePayload.createdAt ??
							data?.sharedAt ??
							data?.updatedAt,
						updatedAt: data?.updatedAt ?? routePayload.updatedAt,
						sharedAt: data?.sharedAt ?? routePayload.sharedAt ?? data?.createdAt,
						expiresAt: data?.expiresAt ?? routePayload.expiresAt,
						sharedId: data?.sharedId ?? routePayload.sharedId ?? id,
						authorName: data?.authorName ?? routePayload.authorName ?? data?.author,
						author: data?.author ?? routePayload.author ?? data?.authorName,
						authorId: data?.authorId ?? routePayload.authorId,
						ownerName: data?.ownerName ?? routePayload.ownerName,
						createdBy: data?.createdBy ?? routePayload.createdBy,
						username: data?.username ?? routePayload.username,
						userName: data?.userName ?? routePayload.userName,
						user: data?.user ?? routePayload.user,
					}
					setSharedRouteDetails(prev => ({
						...prev,
						[id]: mergedPayload,
					}))
				})
				.catch(error => {
					console.error('Failed to load shared route detail:', id, error)
					sharedRouteDetailsFetchedRef.current.delete(id)
				})
				.finally(() => {
					sharedRouteDetailsLoadingRef.current.delete(id)
				})
		})
		return () => {
			isMounted = false
		}
	}, [paginatedSharedRoutes])

	const renderRouteMetaTags = useCallback(
		({ distanceText, difficultyLabel, surfaceTypes }) => {
			const hasSurfaces = Array.isArray(surfaceTypes) && surfaceTypes.length > 0
			return (
				<Wrap spacing={1} mt={1} shouldWrapChildren>
					{distanceText ? (
						<Tag size='sm' variant='subtle' colorScheme='blue'>
							{distanceText}
						</Tag>
					) : null}
					<Tag
						size='sm'
						variant='subtle'
						colorScheme={difficultyLabel ? 'orange' : 'gray'}
					>
						Сложность: {difficultyLabel || 'не указана'}
					</Tag>
					{hasSurfaces ? (
						surfaceTypes.map(surface => (
							<Tag
								key={surface}
								size='sm'
								variant='subtle'
								colorScheme='gray'
							>
								{SURFACE_LABELS[surface] || surface}
							</Tag>
						))
					) : (
						<Tag size='sm' variant='subtle' colorScheme='gray'>
							Покрытие: не указано
						</Tag>
					)}
				</Wrap>
			)
		},
		[]
	)

	useEffect(() => {
		if (activeTab === 2) {
			onEnsureCatalogVisible()
		}
	}, [activeTab, onEnsureCatalogVisible])

	useEffect(() => {
		const handleRouteUpdate = event => {
			const detail = event?.detail || {}
			const { oldRouteId, newRouteId, sharedId } = detail
			if (!oldRouteId || !newRouteId) return
			setPublishedRoutesMap(prev => {
				const next = { ...prev }
				const existing = sharedId || next[oldRouteId]
				if (existing) {
					delete next[oldRouteId]
					next[newRouteId] = existing
				}
				return next
			})
			if (sharedId) {
				setSharedRouteDetails(prev => {
					if (!prev || !prev[sharedId]) return prev
					const next = { ...prev }
					delete next[sharedId]
					return next
				})
			}
		}
		window.addEventListener('manual-route-updated', handleRouteUpdate)
		return () => {
			window.removeEventListener('manual-route-updated', handleRouteUpdate)
		}
	}, [setPublishedRoutesMap])

	const formatTrackDate = timestamp => {
		if (!timestamp) return 'Неизвестная дата'
		return new Date(timestamp).toLocaleString('ru-RU', {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	const renderTracks = tracks => (
		<VStack spacing={2} align='stretch' mt={2}>
			{tracks.map(track => {
				const isSelected = selectedTrackIds.includes(track.sessionId)
				return (
					<Button
						key={track.sessionId}
						onClick={() => onToggleTrack(track.sessionId)}
						variant={isSelected ? 'solid' : 'outline'}
						colorScheme={isSelected ? 'orange' : 'gray'}
						justifyContent='flex-start'
						height='auto'
						py={2}
						px={3}
						sx={subtleButtonStyles}
					>
						<Box textAlign='left'>
							<Text fontWeight='semibold' fontSize='sm'>
								{formatTrackDate(track.endTimestamp)}
							</Text>
							<Text fontSize='xs' color='gray.600'>
								Дистанция: {(track.distance / 1000).toFixed(2)} км
							</Text>
							{track.durationMinutes > 0 && (
								<Text fontSize='xs' color='gray.600'>
									Длительность: {Math.round(track.durationMinutes)} мин
								</Text>
							)}
							<Text fontSize='xs' color='gray.500'>
								Сессия: {track.sessionId}
							</Text>
						</Box>
					</Button>
				)
			})}
		</VStack>
	)

	const savedRoutesSorted = useMemo(() => {
		const unique = []
		const seen = new Set()
		// идём с конца, чтобы сохранять последнюю версию маршрута при совпадении ключа
		for (let i = savedRoutes.length - 1; i >= 0; i -= 1) {
			const route = savedRoutes[i]
			if (!route) continue
			const key =
				route.routeId ||
				(route.name ? `name:${route.name}` : null) ||
				JSON.stringify(route.waypoints || route.pathCoordinates || [])
			if (!key) continue
			if (seen.has(key)) continue
			seen.add(key)
			unique.push(route)
		}
		return unique
			.reverse()
			.sort((a, b) => {
				const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
				const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
				return bDate - aDate
			})
	}, [savedRoutes])

	const totalSavedRoutesPages = Math.max(
		1,
		Math.ceil(savedRoutesSorted.length / ITEMS_PER_PAGE)
	)

useEffect(() => {
	setSavedRoutesPage(prev =>
		prev > totalSavedRoutesPages ? totalSavedRoutesPages : prev
	)
}, [totalSavedRoutesPages])

useEffect(() => {
	setSavedRoutesPage(1)
	}, [savedRoutesSorted.length])

	useEffect(() => {
		// ждем окончания загрузки маршрутов, чтобы не сбрасывать флаги раньше времени
		if (savedRoutesStatus?.loading) return
		savedRoutesLoadedRef.current = true
		setPublishedRoutesMap(prev => {
			if (!prev || typeof prev !== 'object') return prev
			const routeIds = new Set(
				savedRoutes.map(route => route?.routeId).filter(Boolean)
			)
			const serverMap = {}
			savedRoutes.forEach(route => {
				const routeId = route?.routeId
				if (!routeId) return
				const sharedId = route.sharedId || route.slug || null
				if (sharedId) {
					serverMap[routeId] = sharedId
				} else if (route.isShared === true && prev[routeId]) {
					// сервер сказал, что маршрут опубликован, но id не прислал — оставляем старое значение
					serverMap[routeId] = prev[routeId]
				}
			})

			const next = {}
			let changed = false
			routeIds.forEach(routeId => {
				const sharedId = serverMap[routeId]
				if (sharedId) {
					next[routeId] = sharedId
					if (prev[routeId] !== sharedId) {
						changed = true
					}
				} else if (prev[routeId]) {
					changed = true
				}
			})
			Object.keys(prev).forEach(routeId => {
				if (!routeIds.has(routeId)) {
					changed = true
				}
			})

			// если маршрутов не осталось после полной загрузки — сбрасываем карту публикаций
			if (savedRoutesLoadedRef.current && savedRoutes.length === 0) {
				if (typeof window !== 'undefined') {
					window.dispatchEvent(
						new CustomEvent('shared-route-published', {
							detail: { cleared: true },
						})
					)
				}
				return {}
			}
			return changed ? next : prev
		})
	}, [savedRoutes, savedRoutesStatus?.loading, setPublishedRoutesMap])

	const paginatedSavedRoutes = useMemo(() => {
		const start = (savedRoutesPage - 1) * ITEMS_PER_PAGE
		return savedRoutesSorted.slice(start, start + ITEMS_PER_PAGE)
	}, [savedRoutesSorted, savedRoutesPage])

	const openRouteDetails = useCallback(
		(detail, actions = null) => {
			if (!detail) return
			setSelectedRoute(detail, actions)
			onRouteModalOpen()
		},
		[onRouteModalOpen, setSelectedRoute]
	)

	const handleRouteModalClose = useCallback(() => {
		setSelectedRoute(null, null)
		onRouteModalClose()
	}, [onRouteModalClose, setSelectedRoute])

	useEffect(() => {
		if (selectedRouteDetail) {
			onRouteModalOpen()
		} else {
			onRouteModalClose()
		}
	}, [selectedRouteDetail, onRouteModalClose, onRouteModalOpen])

	const handleRouteCardKeyDown = (event, action) => {
		if (!action) return
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			action()
		}
	}

	const toggleDescription = useCallback(cardKey => {
		if (!cardKey) return
		setExpandedDescriptions(prev => {
			const next = new Set(prev)
			if (next.has(cardKey)) {
				next.delete(cardKey)
			} else {
				next.add(cardKey)
			}
			return next
		})
	}, [])

	const copyTextToClipboard = useCallback(async text => {
		if (!text) return false
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(text)
				return true
			}
		} catch (error) {
			console.warn('Clipboard API error:', error)
		}

		if (typeof document === 'undefined') {
			return false
		}
		const textarea = document.createElement('textarea')
		textarea.value = text
		textarea.setAttribute('readonly', '')
		textarea.style.position = 'absolute'
		textarea.style.left = '-9999px'
		document.body.appendChild(textarea)
		textarea.select()
		let successful = false
		try {
			successful = document.execCommand('copy')
		} catch (error) {
			console.warn('Fallback clipboard copy failed:', error)
		} finally {
			document.body.removeChild(textarea)
		}
		return successful
	}, [])

	const buildRouteDetailPayload = useCallback(
		(route, { source = '', sharedId = null } = {}) => {
			if (!route) return null
			const distanceKm = computeRouteDistanceKmValue(route)
			const coords = normalizeCoordinates(route)
			const waypointsCount = coords.length
			const surfaceTypes = extractSurfaceTypes(route)
			const difficulty = extractDifficulty(route)
			return {
				source,
				sharedId,
				routeId: route.routeId,
				title: route.name || 'Маршрут',
				description: route.description || '',
				distanceKm,
				distanceText:
					typeof distanceKm === 'number' && Number.isFinite(distanceKm)
						? `${distanceKm.toFixed(2)} км`
						: '—',
				waypointsCount,
				points: coords,
				color: route.color || '#6366F1',
				author: resolveRouteAuthor(route, {
					currentUserId: userId,
					currentUserName: authorName,
				}),
				createdAtText: extractRouteDateText(route),
				dateText: extractRouteDateText(route),
				followRoads: route.followRoads,
				routingProfile: route.routingProfile,
				mapProvider: route.mapProvider,
				difficulty: formatDifficulty(difficulty),
				surfaceTypes,
				meta: route,
			}
		},
		[
			authorName,
			extractDifficulty,
			extractRouteDateText,
			extractSurfaceTypes,
			formatDifficulty,
			userId,
		]
	)

	const handleSharedRouteCardClick = useCallback(
		item => {
			if (!item) return
			const detailedRoute =
				(item.sharedId && sharedRouteDetails[item.sharedId]) ||
				item.route ||
				item
			const description =
				extractDescription(detailedRoute) ||
				extractDescription(item) ||
				extractDescription(item.route) ||
				''
			const authorText =
				resolveRouteAuthor(detailedRoute || item.route || item, {
					currentUserId: userId,
					currentUserName: authorName,
				}) || ''
			const baseDetail = buildRouteDetailPayload(
				{
					...detailedRoute,
					description,
					name: detailedRoute.name || item.name,
					createdAt: detailedRoute.createdAt || item.createdAt,
					color: detailedRoute.color || item.color,
					author: detailedRoute?.author || authorText,
				},
				{ source: 'Каталог маршрутов', sharedId: item.sharedId }
			)
			openRouteDetails(baseDetail, null)
		},
		[buildRouteDetailPayload, extractDescription, openRouteDetails, sharedRouteDetails]
	)

	const handleShareRoute = useCallback(
		async route => {
			if (!route) return

			if (isGuestMode && typeof onRequireAuth === 'function') {
				onRequireAuth()
				return
			}

			try {
				let shareUrl = ''
				const normalizedAuthor = (authorName || '').trim()
				const authorIdValue =
					typeof userId === 'number' || typeof userId === 'string'
						? Number(userId) || userId
						: undefined

				if (route.routeId && userId) {
					try {
						const response = await shareUserRoute(userId, route.routeId)
						const slug = response?.slug || response?.sharedId
						shareUrl =
							response?.shareUrl ||
							(slug ? buildSharedRouteIdUrl(slug) : '')
						if (!shareUrl && response?.route) {
							shareUrl = buildSharedRouteUrl(response.route)
						}
					} catch (shareError) {
						console.warn(
							'shareUserRoute failed, fallback to shared pool:',
							shareError
						)
					}
				}

				if (!shareUrl) {
					const payload = {
						...prepareRoutePayload(route),
						authorName: normalizedAuthor || undefined,
						authorId: authorIdValue,
						visibility: 'private',
					}
					const shared = await createSharedRouteRecord(payload)
					if (shared?.sharedId) {
						shareUrl = buildSharedRouteIdUrl(shared.sharedId)
					}
				}

				if (!shareUrl) {
					throw new Error('Не удалось сформировать ссылку')
				}

				const copied = await copyTextToClipboard(shareUrl)
				if (!copied) {
					throw new Error('Не удалось скопировать ссылку')
				}

				toast({
					title: 'Ссылка скопирована',
					status: 'success',
					duration: 3000,
					isClosable: true,
				})
			} catch (error) {
				console.error('Error creating share link:', error)
				toast({
					title: 'Не удалось создать ссылку',
					description: error.message || undefined,
					status: 'error',
					duration: 4000,
					isClosable: true,
				})
			}
		},
		[
			copyTextToClipboard,
			isGuestMode,
			onRequireAuth,
			userId,
			authorName,
			toast,
		]
	)

	const RECENT_ITEMS_PER_PAGE = 5
	const [recentTracksPage, setRecentTracksPage] = useState(1)

	useEffect(() => {
		setRecentTracksPage(1)
	}, [recentTracks.length])

	const totalRecentTracksPages = Math.max(
		1,
		Math.ceil(recentTracks.length / RECENT_ITEMS_PER_PAGE)
	)

	useEffect(() => {
		setRecentTracksPage(prev =>
			prev > totalRecentTracksPages ? totalRecentTracksPages : prev
		)
	}, [totalRecentTracksPages])

	const paginatedRecentTracks = useMemo(() => {
		const start = (recentTracksPage - 1) * RECENT_ITEMS_PER_PAGE
		return recentTracks.slice(start, start + RECENT_ITEMS_PER_PAGE)
	}, [recentTracks, recentTracksPage])

	const handlePublishRoute = useCallback(
		async route => {
			if (!route) return

			if (isGuestMode && typeof onRequireAuth === 'function') {
				onRequireAuth()
				return
			}

			try {
				let sharedId = null
				const normalizedAuthor = (authorName || '').trim()
				const authorIdValue =
					typeof userId === 'number' || typeof userId === 'string'
						? Number(userId) || userId
						: undefined

				if (route.routeId && publishedRoutesMap[route.routeId]) {
					sharedId = publishedRoutesMap[route.routeId]
					const exists = await ensureSharedRecordAlive(sharedId)
					if (exists) {
						await deleteSharedRouteRecord(sharedId)
					}
					setPublishedRoutesMap(prev => {
						const next = { ...prev }
						delete next[route.routeId]
						return next
					})
					toast({
						title: exists ? 'Маршрут скрыт из каталога' : 'Запись каталога обновлена',
						status: 'info',
						duration: 3000,
						isClosable: true,
					})
					if (typeof window !== 'undefined') {
						window.dispatchEvent(
							new CustomEvent('shared-route-published', {
								detail: { sharedId, routeId: route.routeId, removed: true },
							})
						)
					}
					// если записи не было, продолжаем публикацию заново
					if (exists) return
					sharedId = null
				}

				if (route.routeId && userId) {
					try {
						const response = await shareUserRoute(userId, route.routeId)
						sharedId = response?.slug || response?.sharedId || null
					} catch (shareError) {
						console.warn(
							'shareUserRoute failed, fallback to shared pool:',
							shareError
						)
					}
				}

				if (!sharedId) {
					const payload = {
						...prepareRoutePayload(route),
						authorName: normalizedAuthor || undefined,
						authorId: authorIdValue,
						visibility: 'public',
					}
					const shared = await createSharedRouteRecord(payload)
					if (shared?.sharedId) {
						sharedId = shared.sharedId
					}
				}

				if (!sharedId) {
					throw new Error('Не удалось опубликовать маршрут')
				}

				setPublishedRoutesMap(prev => {
					if (!route.routeId) return prev
					return { ...prev, [route.routeId]: sharedId }
				})
				toast({
					title: 'Маршрут опубликован',
					description:
						'Включите каталог маршрутов, чтобы увидеть пин на карте.',
					status: 'success',
					duration: 4000,
					isClosable: true,
				})
				if (typeof window !== 'undefined') {
					window.dispatchEvent(
						new CustomEvent('shared-route-published', {
							detail: { sharedId, routeId: route.routeId },
						})
					)
				}
			} catch (error) {
				console.error('Error publishing route:', error)
				toast({
					title: 'Не удалось опубликовать маршрут',
					description: error.message || undefined,
					status: 'error',
					duration: 4000,
					isClosable: true,
				})
			}
		},
		[
			isGuestMode,
			onRequireAuth,
			userId,
			publishedRoutesMap,
			authorName,
			toast,
			setPublishedRoutesMap,
		]
	)

	const handleDeleteRoute = useCallback(
		async route => {
			if (!route || !route.routeId) {
				onDeleteSavedRoute(route?.routeId || route)
				return
			}

			const sharedId = publishedRoutesMap[route.routeId]
			if (sharedId) {
				try {
					await deleteSharedRouteRecord(sharedId)
					setPublishedRoutesMap(prev => {
						const next = { ...prev }
						delete next[route.routeId]
						return next
					})
					if (typeof window !== 'undefined') {
						window.dispatchEvent(
							new CustomEvent('shared-route-published', {
								detail: { sharedId, routeId: route.routeId, removed: true },
							})
						)
					}
				} catch (error) {
					console.error('Failed to remove shared route on delete:', error)
				}
			}

			onDeleteSavedRoute(route.routeId)
		},
		[publishedRoutesMap, onDeleteSavedRoute, setPublishedRoutesMap]
	)

	useEffect(() => {
		if (!selectedRouteDetail) return
		if (selectedRouteDetail.source !== 'Мой маршрут') {
			setSelectedRoute(selectedRouteDetail, null)
			return
		}
		const routeId = selectedRouteDetail.routeId || selectedRouteDetail.meta?.routeId
		const currentRoute =
			savedRoutes.find(item => item?.routeId === routeId) ||
			selectedRouteDetail.meta ||
			selectedRouteDetail

		const isVisible = routeId ? visibleSavedRouteIds.includes(routeId) : false
		const isPublished = routeId ? Boolean(publishedRoutesMap[routeId]) : false

		const actions = {
			isVisible,
			isPublished,
			onToggleVisibility: routeId
				? () => onToggleSavedRouteVisibility(routeId)
				: null,
			onShare: currentRoute ? () => handleShareRoute(currentRoute) : null,
			onPublish: currentRoute ? () => handlePublishRoute(currentRoute) : null,
			onEdit: currentRoute ? () => onEditSavedRoute(currentRoute) : null,
			onDelete: currentRoute ? () => handleDeleteRoute(currentRoute) : null,
		}

		setSelectedRoute(selectedRouteDetail, actions)
	}, [
		handleDeleteRoute,
		handlePublishRoute,
		handleShareRoute,
		onEditSavedRoute,
		onToggleSavedRouteVisibility,
		publishedRoutesMap,
		savedRoutes,
		selectedRouteDetail,
		setSelectedRoute,
		visibleSavedRouteIds,
	])

	const handleSavedRouteCardClick = useCallback(
		route => {
			if (!route) return
			const detail = buildRouteDetailPayload(route, { source: 'Мой маршрут' })
			openRouteDetails(detail)
		},
		[
			buildRouteDetailPayload,
			openRouteDetails,
		]
	)

	return (
		<>
			<Tabs
				variant='unstyled'
				colorScheme='purple'
				size='sm'
				index={activeTab}
				onChange={setActiveTab}
				isLazy
			>
			<TabList
				mb={3}
				w='100%'
				maxW='360px'
				mx='auto'
				px={2}
				gap={3}
				flexWrap='nowrap'
				justifyContent='center'
				borderBottomWidth='1px'
				borderColor='gray.200'
				overflowX='auto'
				sx={{ scrollbarWidth: 'none' }}
			>
				<Tab
					fontWeight='semibold'
					py={2}
					px={4}
					borderRadius='md'
					fontSize='sm'
					_selected={{
						bg: 'purple.50',
						color: 'purple.700',
						boxShadow: 'none',
						borderBottom: '2px solid',
						borderColor: 'purple.500',
					}}
				>
					Мои
				</Tab>
				<Tab
					fontWeight='semibold'
					py={2}
					px={4}
					borderRadius='md'
					fontSize='sm'
					_selected={{
						bg: 'purple.50',
						color: 'purple.700',
						boxShadow: 'none',
						borderBottom: '2px solid',
						borderColor: 'purple.500',
					}}
				>
					Телега
				</Tab>
				<Tab
					fontWeight='semibold'
					py={2}
					px={3}
					borderRadius='md'
					fontSize='sm'
					whiteSpace='nowrap'
					_selected={{
						bg: 'purple.50',
						color: 'purple.700',
						boxShadow: 'none',
						borderBottom: '2px solid',
						borderColor: 'purple.500',
					}}
				>
					Маршруты 
					({visibleRoutesCount})
				</Tab>
			</TabList>
			<TabPanels>
				<TabPanel px={0}>
					<SavedRoutesSection
						savedRoutesStatus={savedRoutesStatus}
						savedRoutesSorted={savedRoutesSorted}
						paginatedSavedRoutes={paginatedSavedRoutes}
						visibleSavedRouteIds={visibleSavedRouteIds}
						publishedRoutesMap={publishedRoutesMap}
						expandedDescriptions={expandedDescriptions}
						onToggleDescription={toggleDescription}
						extractRouteDateText={extractRouteDateText}
						renderRouteMetaTags={renderRouteMetaTags}
						computeRouteDistanceText={computeRouteDistanceText}
						extractSurfaceTypes={extractSurfaceTypes}
						formatDifficulty={formatDifficulty}
						extractDifficulty={extractDifficulty}
						handleSavedRouteCardClick={handleSavedRouteCardClick}
						handleRouteCardKeyDown={handleRouteCardKeyDown}
						onToggleSavedRouteVisibility={onToggleSavedRouteVisibility}
						handleShareRoute={handleShareRoute}
						handlePublishRoute={handlePublishRoute}
						onEditSavedRoute={onEditSavedRoute}
						handleDeleteRoute={handleDeleteRoute}
						totalSavedRoutesPages={totalSavedRoutesPages}
						savedRoutesPage={savedRoutesPage}
						setSavedRoutesPage={setSavedRoutesPage}
						MotionBox={MotionBox}
						cardMotionProps={cardMotionProps}
					/>
				</TabPanel>
				<TabPanel px={0}>
					<TracksSection
						showDailyTracks={showDailyTracks}
						setShowDailyTracks={setShowDailyTracks}
						selectedDate={selectedDate}
						onDateChange={onDateChange}
						trackStatus={trackStatus}
						trackList={trackList}
						renderTracks={renderTracks}
						showRecentTracks={showRecentTracks}
						setShowRecentTracks={setShowRecentTracks}
						recentTracksStatus={recentTracksStatus}
						recentTracks={recentTracks}
						paginatedRecentTracks={paginatedRecentTracks}
						totalRecentTracksPages={totalRecentTracksPages}
						recentTracksPage={recentTracksPage}
						setRecentTracksPage={setRecentTracksPage}
					/>
				</TabPanel>
				<TabPanel px={0}>
					<SharedRoutesCatalogSection
						sharedRoutesCatalogStatus={sharedRoutesCatalogStatus}
						catalogRoutesList={catalogRoutesList}
						paginatedSharedRoutes={paginatedSharedRoutes}
						sharedRouteDetails={sharedRouteDetails}
						extractDescription={extractDescription}
						userId={userId}
						authorName={authorName}
						extractRouteDateText={extractRouteDateText}
						formatRouteDate={formatRouteDate}
						renderRouteMetaTags={renderRouteMetaTags}
						extractSurfaceTypes={extractSurfaceTypes}
						formatDifficulty={formatDifficulty}
						extractDifficulty={extractDifficulty}
						handleSharedRouteCardClick={handleSharedRouteCardClick}
						handleRouteCardKeyDown={handleRouteCardKeyDown}
						onOpenSharedRouteFromCatalog={onOpenSharedRouteFromCatalog}
						expandedDescriptions={expandedDescriptions}
						onToggleDescription={toggleDescription}
						UNKNOWN_DATE_LABEL={UNKNOWN_DATE_LABEL}
						MotionBox={MotionBox}
						cardMotionProps={cardMotionProps}
						totalSharedRoutesPages={totalSharedRoutesPages}
						sharedRoutesPage={sharedRoutesPage}
						setSharedRoutesPage={setSharedRoutesPage}
					/>
				</TabPanel>
			</TabPanels>
			</Tabs>
			{isDesktop ? (
				<RouteDetailsModal
					isOpen={isRouteModalOpen}
					onClose={handleRouteModalClose}
					route={selectedRouteDetail}
					actions={selectedRouteActions}
					draggable
				/>
			) : (
				<RouteDetailsDrawer
					isOpen={isRouteModalOpen}
					onClose={handleRouteModalClose}
					route={selectedRouteDetail}
					actions={selectedRouteActions}
				/>
			)}
		</>
	)
}

export default DrawerMenu
