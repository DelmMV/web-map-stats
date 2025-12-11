import {
	Avatar,
	Badge,
	Box,
	Button,
	Card,
	CardBody,
	FormControl,
	HStack,
	Input,
	Spinner,
	Stack,
	Text,
	useToast,
	VStack,
	IconButton,
	Tooltip,
} from '@chakra-ui/react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useTelegramUser } from './hooks/useTelegramUser'
import {
	deleteUserAvatar,
	deleteUserRoute,
	fetchUserProfile,
	fetchUserRoutes,
	updateUserProfile,
	uploadUserAvatar,
	shareUserRoute,
} from './services/profileService'
import { searchCityCoordinates } from './services/geocodeService'
import { API_CONFIG } from './utils/config'
import {
	buildSharedRouteIdUrl,
	buildSharedRouteUrl,
	prepareRoutePayload,
} from './utils/sharedRoute'
import {
	createSharedRouteRecord,
	deleteSharedRouteRecord,
} from './services/sharedRouteService'
import { FaMapMarkedAlt } from 'react-icons/fa'
import { LinkIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons'

const API_BASE_URL = API_CONFIG.BASE_URL
const PREFERRED_CITY_STORAGE_KEY = 'preferredCityCoords'
const CITY_LOOKUP_MIN_CHARS = 3
const CITY_LOOKUP_DEBOUNCE = 400
const PUBLISHED_ROUTES_STORAGE_KEY = 'publishedRoutesMap'

const buildProfileFormState = (profile, fallback = {}) => ({
	username: profile?.username || fallback.username || '',
	avatarUrl: profile?.avatarUrl || fallback.avatarUrl || '',
	city: profile?.city || '',
	wheelModel: profile?.wheelModel || '',
})

const WeeklyStats = ({ userId, onLogout }) => {
	const toast = useToast()
	const telegramProfile = useTelegramUser()
	const telegramDisplayName = useMemo(() => {
		if (!telegramProfile) return ''
		if (telegramProfile.username) return telegramProfile.username
		const parts = [telegramProfile.firstName, telegramProfile.lastName].filter(
			Boolean
		)
		return parts.join(' ')
	}, [
		telegramProfile?.username,
		telegramProfile?.firstName,
		telegramProfile?.lastName,
	])
	const telegramFallback = useMemo(
		() => ({
			username: telegramDisplayName || '',
			avatarUrl: telegramProfile?.photoUrl || '',
		}),
		[telegramDisplayName, telegramProfile?.photoUrl]
	)

	const [stats, setStats] = useState(null)
	const [distanceCategory, setDistanceCategory] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [todayDistance, setTodayDistance] = useState(null)

	const [profile, setProfile] = useState(null)
	const [profileForm, setProfileForm] = useState(() =>
		buildProfileFormState(null, telegramFallback)
	)
	const [profileStatus, setProfileStatus] = useState({
		loading: false,
		saving: false,
		error: null,
	})
	const [avatarUploadStatus, setAvatarUploadStatus] = useState({
		uploading: false,
		deleting: false,
		error: null,
	})
	const [cityLookupStatus, setCityLookupStatus] = useState({
		loading: false,
		error: null,
	})
	const [citySuggestions, setCitySuggestions] = useState([])
	const [cityQuery, setCityQuery] = useState('')
	const resolvedCityRef = useRef('')
	const [isEditingProfile, setIsEditingProfile] = useState(false)

	const [savedRoutes, setSavedRoutes] = useState([])
	const [savedRoutesStatus, setSavedRoutesStatus] = useState({
		loading: false,
		error: null,
	})
	const [routeActionState, setRouteActionState] = useState({
		deletingRouteId: null,
	})
	const [publishedRoutesMap, setPublishedRoutesMap] = useState(() => {
		if (typeof window === 'undefined') return {}
		try {
			const stored = localStorage.getItem(PUBLISHED_ROUTES_STORAGE_KEY)
			return stored ? JSON.parse(stored) : {}
		} catch (error) {
			console.error('Failed to read published routes map:', error)
			return {}
		}
	})
	const cityDatalistId = useMemo(
		() => `city-suggestions-${userId || 'default'}`,
		[userId]
	)
	const updatePreferredCity = useCallback((cityName, coordsOverride) => {
		if (typeof window === 'undefined') return
		if (
			!coordsOverride ||
			typeof coordsOverride.lat !== 'number' ||
			typeof coordsOverride.lng !== 'number'
		) {
			return
		}
		const payload = {
			city: cityName,
			lat: coordsOverride.lat,
			lng: coordsOverride.lng,
			isCustom: true,
		}
		try {
			localStorage.setItem(
				PREFERRED_CITY_STORAGE_KEY,
				JSON.stringify(payload)
			)
		} catch (error) {
			console.error('Error saving preferred city:', error)
		}
		try {
			window.dispatchEvent(new CustomEvent('preferredCityChange', { detail: payload }))
		} catch {
			// ignore if CustomEvent unsupported
		}
	}, [])
	const [visibleSavedRouteIds, setVisibleSavedRouteIds] = useState(() => {
		try {
			const stored = localStorage.getItem('visibleSavedRouteIds')
			return stored ? JSON.parse(stored) : []
		} catch (storageError) {
			console.error('Error reading visible routes from storage', storageError)
			return []
		}
	})

	useEffect(() => {
		try {
			localStorage.setItem(
				'visibleSavedRouteIds',
				JSON.stringify(visibleSavedRouteIds)
			)
		} catch (storageError) {
			console.error('Error persisting visible routes', storageError)
		}
	}, [visibleSavedRouteIds])

	useEffect(() => {
		if (!savedRoutes.length) {
			setVisibleSavedRouteIds([])
			return
		}

		const validIds = new Set(savedRoutes.map(route => route.routeId))
		setVisibleSavedRouteIds(prev => prev.filter(id => validIds.has(id)))
	}, [savedRoutes])

	useEffect(() => {
		try {
			localStorage.setItem(
				PUBLISHED_ROUTES_STORAGE_KEY,
				JSON.stringify(publishedRoutesMap)
			)
		} catch (error) {
			console.error('Failed to persist published routes map:', error)
		}
	}, [publishedRoutesMap])

	useEffect(() => {
		if (!userId) return

		const fetchData = async () => {
			setLoading(true)
			setError(null)
			try {
				const [weeklyStatsResponse, distanceCategoryResponse] =
					await Promise.all([
						fetch(`${API_BASE_URL}/user-stats/week/${userId}`),
						fetch(`${API_BASE_URL}/user-category-by-distance/${userId}`),
					])

				if (!weeklyStatsResponse.ok || !distanceCategoryResponse.ok) {
					throw new Error(
						`HTTP error! Status: ${weeklyStatsResponse.status} ${distanceCategoryResponse.status}`
					)
				}

				const [weeklyData, categoryData] = await Promise.all([
					weeklyStatsResponse.json(),
					distanceCategoryResponse.json(),
				])

				setStats(weeklyData)
				setDistanceCategory(categoryData)

				const daysOfWeek = [
					'Воскресенье',
					'Понедельник',
					'Вторник',
					'Среда',
					'Четверг',
					'Пятница',
					'Суббота',
				]
				const todayIndex = new Date().getDay()
				const today = daysOfWeek[todayIndex]
				const todayStat = weeklyData.dailyStats.find(stat => stat.day === today)
				setTodayDistance(todayStat ? todayStat.distance.toFixed(2) : '0.00')
			} catch (fetchError) {
				console.error('Error fetching stats:', fetchError)
				setError('Failed to load data')
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [userId])

	const loadProfile = useCallback(async () => {
		if (!userId) return
		setProfileStatus(prev => ({ ...prev, loading: true, error: null }))
		try {
			const data = await fetchUserProfile(userId)
			setProfile(data)
			setProfileForm(buildProfileFormState(data, telegramFallback))
			if (Array.isArray(data?.routes)) {
				setSavedRoutes(data.routes)
			}
			setProfileStatus(prev => ({ ...prev, loading: false }))
		} catch (fetchError) {
			console.error('Error loading profile:', fetchError)
			setProfileStatus(prev => ({
				...prev,
				loading: false,
				error: fetchError.message || 'Не удалось загрузить профиль',
			}))
		}
	}, [userId, telegramFallback])

	const loadSavedRoutes = useCallback(async () => {
		if (!userId) return
		setSavedRoutesStatus({ loading: true, error: null })
		try {
			const data = await fetchUserRoutes(userId)
			if (Array.isArray(data)) {
				setSavedRoutes(data)
			} else if (Array.isArray(data?.routes)) {
				setSavedRoutes(data.routes)
			} else {
				setSavedRoutes([])
			}
			setSavedRoutesStatus({ loading: false, error: null })
		} catch (fetchError) {
			console.error('Error loading routes:', fetchError)
			setSavedRoutes([])
			setSavedRoutesStatus({
				loading: false,
				error: fetchError.message || 'Не удалось загрузить маршруты',
			})
		}
	}, [userId])

	useEffect(() => {
		loadProfile()
		loadSavedRoutes()
	}, [loadProfile, loadSavedRoutes])

	const profileName = useMemo(() => {
		return (
			profile?.username ||
			profileForm.username ||
			telegramDisplayName ||
			'Без имени'
		)
	}, [profile?.username, profileForm.username, telegramDisplayName])

	const resolveProfileFromResponse = data => {
		if (!data || typeof data !== 'object') return {}
		if (data.profile && typeof data.profile === 'object') {
			return data.profile
		}
		return data
	}

	const handleProfileSave = async () => {
		const payload = {
			username: profileForm.username?.trim() || '',
			city: profileForm.city?.trim() || '',
			wheelModel: profileForm.wheelModel?.trim() || '',
		}

		setProfileStatus(prev => ({ ...prev, saving: true, error: null }))

		try {
			const data = await updateUserProfile(userId, payload)
			const safeData = resolveProfileFromResponse(data)
			const nextProfile = {
				...(profile || {}),
				...payload,
				...safeData,
			}
			setProfile(nextProfile)
			setProfileForm(buildProfileFormState(nextProfile, telegramFallback))
			const routes = Array.isArray(safeData?.routes)
				? safeData.routes
				: Array.isArray(data?.routes)
				? data.routes
				: null
			if (Array.isArray(routes)) {
				setSavedRoutes(routes)
			}
			toast({
				position: 'top-right',
				title: 'Профиль обновлён',
				status: 'success',
				duration: 3000,
				isClosable: true,
			})
			setIsEditingProfile(false)
			// Перечитываем профиль с сервера, чтобы выбить любые рассинхроны
			await loadProfile()
		} catch (saveError) {
			console.error('Error updating profile:', saveError)
			toast({
				position: 'top-right',
				title: saveError.message || 'Не удалось сохранить профиль',
				status: 'error',
				duration: 3000,
				isClosable: true,
			})
			setProfileStatus(prev => ({
				...prev,
				error: saveError.message || 'Не удалось сохранить профиль',
			}))
		} finally {
			setProfileStatus(prev => ({ ...prev, saving: false }))
		}
	}

	const handleToggleSavedRoute = routeId => {
		if (!routeId) return
		setVisibleSavedRouteIds(prev =>
			prev.includes(routeId)
				? prev.filter(id => id !== routeId)
				: [routeId, ...prev]
		)
	}

	const handleShareRoute = useCallback(
		async route => {
			if (!route) return
			try {
				let shareUrl = ''
				const normalizedAuthor = (profileName || '').trim()
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
						console.warn('shareUserRoute failed, fallback to shared pool:', shareError)
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

				await navigator.clipboard?.writeText?.(shareUrl)
				toast({
					title: 'Ссылка скопирована',
					status: 'success',
					duration: 3000,
					isClosable: true,
					position: 'top-right',
				})
			} catch (error) {
				console.error('Error creating share link:', error)
				toast({
					title: 'Не удалось создать ссылку',
					description: error.message || undefined,
					status: 'error',
					duration: 4000,
					isClosable: true,
					position: 'top-right',
				})
			}
		},
		[userId, profileName, toast]
	)

	const handlePublishRoute = useCallback(
		async route => {
			if (!route) return
			try {
				let sharedId = null
				const normalizedAuthor = (profileName || '').trim()
				const authorIdValue =
					typeof userId === 'number' || typeof userId === 'string'
						? Number(userId) || userId
						: undefined

				if (route.routeId && publishedRoutesMap[route.routeId]) {
					sharedId = publishedRoutesMap[route.routeId]
					try {
						await deleteSharedRouteRecord(sharedId)
					} catch (error) {
						console.warn('Failed to remove shared route on unpublish:', error)
					}
					setPublishedRoutesMap(prev => {
						const next = { ...prev }
						delete next[route.routeId]
						return next
					})
					toast({
						title: 'Маршрут скрыт из каталога',
						status: 'info',
						duration: 3000,
						isClosable: true,
						position: 'top-right',
					})
					if (typeof window !== 'undefined') {
						window.dispatchEvent(
							new CustomEvent('shared-route-published', {
								detail: { sharedId, routeId: route.routeId, removed: true },
							})
						)
					}
					return
				}

				if (route.routeId && userId) {
					try {
						const response = await shareUserRoute(userId, route.routeId)
						sharedId = response?.slug || response?.sharedId || null
					} catch (shareError) {
						console.warn('shareUserRoute failed, fallback to shared pool:', shareError)
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
					status: 'success',
					duration: 3000,
					isClosable: true,
					position: 'top-right',
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
					position: 'top-right',
				})
			}
		},
		[userId, profileName, toast, publishedRoutesMap]
	)

const handleDeleteSavedRoute = async routeId => {
	if (!routeId) return
	setRouteActionState(prev => ({ ...prev, deletingRouteId: routeId }))
	try {
		const route = savedRoutes.find(r => r.routeId === routeId)
		let sharedId =
			publishedRoutesMap[routeId] ||
			route?.sharedId ||
			route?.slug ||
			null
		if (!sharedId && typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem(PUBLISHED_ROUTES_STORAGE_KEY)
				const map = stored ? JSON.parse(stored) : null
				if (map && typeof map === 'object') {
					sharedId = map[routeId] || null
				}
			} catch (err) {
				console.warn('Failed to read publishedRoutesMap for delete:', err)
			}
		}
		if (sharedId) {
			try {
				await deleteSharedRouteRecord(sharedId)
			} catch (error) {
				console.warn('Failed to remove shared route on delete:', error)
			}
			setPublishedRoutesMap(prev => {
				const next = { ...prev }
				delete next[routeId]
				return next
			})
			if (typeof window !== 'undefined') {
				try {
					const stored = localStorage.getItem(PUBLISHED_ROUTES_STORAGE_KEY)
					const map = stored ? JSON.parse(stored) : null
					if (map && typeof map === 'object') {
						delete map[routeId]
						localStorage.setItem(
							PUBLISHED_ROUTES_STORAGE_KEY,
							JSON.stringify(map)
						)
					}
				} catch (err) {
					console.warn('Failed to persist publishedRoutesMap after delete:', err)
				}
			}
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
		toast({
			position: 'top-right',
			title: 'Маршрут удалён',
			status: 'success',
			duration: 3000,
				isClosable: true,
			})
		} catch (deleteError) {
			console.error('Error deleting route:', deleteError)
			toast({
				position: 'top-right',
				title: deleteError.message || 'Не удалось удалить маршрут',
				status: 'error',
				duration: 3000,
				isClosable: true,
			})
		} finally {
			setRouteActionState(prev => ({ ...prev, deletingRouteId: null }))
		}
	}

	const avatarSrc = useMemo(() => {
		return (
			profile?.avatarUrl ||
			profileForm.avatarUrl ||
			telegramProfile?.photoUrl ||
			''
		)
	}, [profile?.avatarUrl, profileForm.avatarUrl, telegramProfile?.photoUrl])
	const handleCityInputChange = useCallback(
		event => {
			const value = event.target.value
			setCityLookupStatus(prev =>
				prev.error ? { ...prev, error: null } : prev
			)
			setProfileForm(prev => ({ ...prev, city: value }))
			const matchedSuggestion = citySuggestions.find(
				suggestion =>
					suggestion.name.toLowerCase() === value.trim().toLowerCase()
			)
			if (matchedSuggestion) {
			updatePreferredCity(matchedSuggestion.name, {
				lat: matchedSuggestion.lat,
				lng: matchedSuggestion.lng,
			})
			}
		},
		[citySuggestions, updatePreferredCity]
	)
	const resolveCityCoordinates = useCallback(
		async cityName => {
			const normalized = cityName?.trim()
			if (!normalized) return
			const lowered = normalized.toLowerCase()
			if (resolvedCityRef.current === lowered) return
			resolvedCityRef.current = lowered
			try {
				const results = await searchCityCoordinates(normalized)
				const bestMatch = results[0]
				if (
					bestMatch &&
					!Number.isNaN(bestMatch.lat) &&
					!Number.isNaN(bestMatch.lng)
				) {
					updatePreferredCity(bestMatch.name || normalized, {
						lat: bestMatch.lat,
						lng: bestMatch.lng,
					})
				}
			} catch (error) {
				console.warn('Unable to resolve city coordinates:', error)
			}
		},
		[updatePreferredCity]
	)

	useEffect(() => {
		const cityValue = profileForm.city || ''
		setCityQuery(cityValue)
	}, [profileForm.city])

	useEffect(() => {
		const trimmed = cityQuery.trim()
		if (!trimmed || trimmed.length < CITY_LOOKUP_MIN_CHARS) {
			setCitySuggestions([])
			setCityLookupStatus(prev => ({ ...prev, loading: false }))
			return
		}

		let isCancelled = false
		setCityLookupStatus({ loading: true, error: null })
		const timeoutId = setTimeout(async () => {
			try {
				const results = await searchCityCoordinates(trimmed)
				if (isCancelled) return
				setCitySuggestions(results)
				setCityLookupStatus({ loading: false, error: null })
			} catch (lookupError) {
				if (isCancelled) return
				setCitySuggestions([])
				setCityLookupStatus({
					loading: false,
					error:
						lookupError?.message ||
						'Не удалось найти город. Попробуйте уточнить запрос.',
				})
			}
		}, CITY_LOOKUP_DEBOUNCE)

		return () => {
			isCancelled = true
			clearTimeout(timeoutId)
		}
	}, [cityQuery])

	const handleToggleEditing = () => {
		if (isEditingProfile) {
			setProfileForm(buildProfileFormState(profile, telegramFallback))
			setAvatarUploadStatus({ uploading: false, deleting: false, error: null })
		}
		setIsEditingProfile(prev => !prev)
	}

useEffect(() => {
	if (
		isEditingProfile ||
		!telegramProfile?.username ||
		profile?.username ||
		profileForm.username
	) {
		return
	}
	setProfileForm(prev => {
		if (prev.username) {
			return prev
		}
		return {
			...prev,
			username: telegramProfile.username,
		}
	})
}, [
	isEditingProfile,
	telegramProfile?.username,
	profile?.username,
	profileForm.username,
])

useEffect(() => {
	if (profile?.city) {
		resolveCityCoordinates(profile.city)
	}
}, [profile?.city, resolveCityCoordinates])

	const handleLogoutClick = () => {
		if (typeof onLogout === 'function') {
			onLogout()
		}
	}

	const handleAvatarFileChange = async event => {
		const file = event.target.files?.[0]
		if (!file) return

		setAvatarUploadStatus({ uploading: true, deleting: false, error: null })

		try {
			const data = await uploadUserAvatar(userId, file)
			const nextAvatarUrl = data?.avatarUrl
			const updatedProfile = {
				...(profile || {}),
				avatarUrl: nextAvatarUrl || profile?.avatarUrl || '',
			}
			setProfile(updatedProfile)
			setProfileForm(buildProfileFormState(updatedProfile, telegramFallback))
			setAvatarUploadStatus({ uploading: false, deleting: false, error: null })
			toast({
				position: 'top-right',
				title: 'Аватар обновлён',
				status: 'success',
				duration: 3000,
				isClosable: true,
			})
		} catch (uploadError) {
			console.error('Error uploading avatar:', uploadError)
			const message =
				uploadError?.message || 'Не удалось загрузить аватар. Попробуйте позже.'
			setAvatarUploadStatus({ uploading: false, deleting: false, error: message })
			toast({
				position: 'top-right',
				title: message,
				status: 'error',
				duration: 3000,
				isClosable: true,
			})
		} finally {
			event.target.value = ''
		}
	}

	const handleAvatarDelete = async () => {
		if (!profile?.avatarUrl && !profileForm.avatarUrl) {
			return
		}

		setAvatarUploadStatus({ uploading: false, deleting: true, error: null })

		try {
			await deleteUserAvatar(userId)
			const updatedProfile = {
				...(profile || {}),
				avatarUrl: '',
			}
			setProfile(updatedProfile)
			setProfileForm(buildProfileFormState(updatedProfile, telegramFallback))
			toast({
				position: 'top-right',
				title: 'Аватар удалён',
				status: 'success',
				duration: 3000,
				isClosable: true,
			})
		} catch (deleteError) {
			console.error('Error deleting avatar:', deleteError)
			const message = deleteError?.message || 'Не удалось удалить аватар'
			setAvatarUploadStatus({ uploading: false, deleting: false, error: message })
			toast({
				position: 'top-right',
				title: message,
				status: 'error',
				duration: 3000,
				isClosable: true,
			})
			return
		}

		setAvatarUploadStatus({ uploading: false, deleting: false, error: null })
		await loadProfile()
	}

	useEffect(() => {
		if (
			isEditingProfile ||
			(!telegramFallback.username && !telegramFallback.avatarUrl)
		) {
			return
		}

		setProfileForm(prev => {
			if (!prev) return prev
			let changed = false
			const next = { ...prev }

			if (!next.username && telegramFallback.username) {
				next.username = telegramFallback.username
				changed = true
			}

			if (
				!next.avatarUrl &&
				!profile?.avatarUrl &&
				telegramFallback.avatarUrl
			) {
				next.avatarUrl = telegramFallback.avatarUrl
				changed = true
			}

			return changed ? next : prev
		})
	}, [
		isEditingProfile,
		telegramFallback.username,
		telegramFallback.avatarUrl,
		profile?.avatarUrl,
	])

	if (!userId) {
		return (
			<Box display='flex' justifyContent='center' alignItems='center' height='100vh'>
				Loading user data...
			</Box>
		)
	}

	return (
		<Box p={5} maxW='900px' mx='auto' mb='40px'>
			<VStack spacing={6} align='stretch'>
				<Box>
					<Box align='center' mb={3}>
						<Badge bgColor='gray.100' borderRadius={10} fontSize={20}>
							Профиль
						</Badge>
					</Box>
					<Card>
						<CardBody>
							<HStack justify='space-between' align='flex-start' mb={4} flexWrap='wrap' gap={3}>
								<HStack spacing={4} align='center'>
									<Avatar name={profileName} src={avatarSrc} size='lg' />
									<Box>
										<Text fontWeight='bold' fontSize='lg'>
											{profileName}
										</Text>
										<Text fontSize='sm' color='gray.500'>
											ID: {profile?.userId || userId}
										</Text>
									</Box>
								</HStack>
								<HStack spacing={2}>
									<Button
										size='sm'
										variant='outline'
										onClick={loadProfile}
										isLoading={profileStatus.loading}
									>
										Обновить
									</Button>
									<Button
										size='sm'
										variant='outline'
										colorScheme={isEditingProfile ? 'gray' : 'blue'}
										onClick={handleToggleEditing}
									>
										{isEditingProfile ? 'Отмена' : 'Редактировать'}
									</Button>
									{typeof onLogout === 'function' && (
										<Button size='sm' colorScheme='red' onClick={handleLogoutClick}>
											Выйти
										</Button>
									)}
								</HStack>
							</HStack>
							{profileStatus.error && (
								<Text fontSize='sm' color='red.500' mb={2}>
									{profileStatus.error}
								</Text>
							)}

							{isEditingProfile ? (
								<>
									<VStack spacing={3} align='stretch'>
										<FormControl>
											<Text fontSize='xs' color='gray.500'>
												Имя
											</Text>
											<Input
												size='sm'
												value={profileForm.username}
												onChange={e =>
													setProfileForm(prev => ({ ...prev, username: e.target.value }))
												}
											/>
										</FormControl>
										<FormControl>
											<Text fontSize='xs' color='gray.500'>
												Город
											</Text>
											<VStack spacing={1} align='stretch'>
												<Input
													size='sm'
													autoComplete='off'
													list={cityDatalistId}
													value={profileForm.city}
													onChange={handleCityInputChange}
												/>
												{cityLookupStatus.loading && (
													<Text fontSize='xs' color='gray.500'>
														Ищем города...
													</Text>
												)}
												{cityLookupStatus.error && (
													<Text fontSize='xs' color='red.500'>
														{cityLookupStatus.error}
													</Text>
												)}
											</VStack>
											<datalist id={cityDatalistId}>
												{citySuggestions.map(suggestion => (
													<option
														key={`${suggestion.name}-${suggestion.lat}-${suggestion.lng}`}
														value={suggestion.name}
													/>
												))}
											</datalist>
											{!profileForm.city && (
												<Text fontSize='xs' color='gray.500'>
													Начните вводить название (от 3 символов), чтобы получить
													варианты
												</Text>
											)}
										</FormControl>
										<FormControl>
											<Text fontSize='xs' color='gray.500'>
												Модель моноколеса
											</Text>
											<Input
												size='sm'
												value={profileForm.wheelModel}
												onChange={e =>
													setProfileForm(prev => ({
														...prev,
														wheelModel: e.target.value,
													}))
												}
											/>
										</FormControl>
										<FormControl>
											<Text fontSize='xs' color='gray.500'>
												Аватар
											</Text>
												<VStack align='flex-start' spacing={2}>
													<HStack spacing={3}>
														<Avatar src={avatarSrc} name={profileName} size='md' />
														<Button
															as='label'
														size='sm'
														variant='outline'
														cursor='pointer'
														colorScheme='blue'
															isDisabled={avatarUploadStatus.uploading}
														>
															Выбрать файл
														<input
															type='file'
															accept='image/*'
															style={{ display: 'none' }}
															onChange={handleAvatarFileChange}
														/>
														</Button>
														<Button
															size='sm'
															variant='outline'
															colorScheme='red'
															onClick={handleAvatarDelete}
															isDisabled={
																avatarUploadStatus.uploading ||
																avatarUploadStatus.deleting ||
																(!profile?.avatarUrl && !profileForm.avatarUrl)
															}
														>
															Удалить
														</Button>
													</HStack>
													<Text fontSize='xs' color='gray.500'>
														Поддерживаются изображения до 5 МБ
													</Text>
													{avatarUploadStatus.uploading && (
														<Text fontSize='xs' color='gray.500'>
															Загружаем аватар...
														</Text>
													)}
													{avatarUploadStatus.deleting && (
														<Text fontSize='xs' color='gray.500'>
															Удаляем аватар...
														</Text>
													)}
												{avatarUploadStatus.error && (
													<Text fontSize='xs' color='red.500'>
														{avatarUploadStatus.error}
													</Text>
												)}
											</VStack>
										</FormControl>
									</VStack>
									<Button
										mt={4}
										colorScheme='blue'
										onClick={handleProfileSave}
										isLoading={profileStatus.saving}
									>
										Сохранить профиль
									</Button>
								</>
							) : (
								<VStack spacing={2} align='stretch'>
									<Text fontSize='sm' color='gray.600'>
							<Text as='span' fontWeight='semibold'>
								Имя:{' '}
							</Text>
							{profile?.username ||
								profileForm.username ||
								telegramDisplayName ||
								'—'}
									</Text>
									<Text fontSize='sm' color='gray.600'>
										<Text as='span' fontWeight='semibold'>
											Город:{' '}
										</Text>
										{profile?.city || '—'}
									</Text>
									<Text fontSize='sm' color='gray.600'>
										<Text as='span' fontWeight='semibold'>
											Модель моноколеса:{' '}
										</Text>
										{profile?.wheelModel || '—'}
									</Text>
									<Text fontSize='xs' color='gray.500'>
										{profile?.avatarUrl
											? 'Используется загруженный аватар.'
											: telegramProfile?.photoUrl
											? 'Нет загруженного аватара — используем фото Telegram.'
											: 'Аватар отсутствует.'}
									</Text>
								</VStack>
							)}
						</CardBody>
					</Card>
				</Box>

				<Box>
					<Box align='center' mb={3}>
						<Badge bgColor='gray.100' borderRadius={10} fontSize={20}>
							Сохранённые маршруты
						</Badge>
					</Box>
					<Card>
						<CardBody>
							<HStack justify='space-between' mb={3}>
								<Text fontSize='sm' color='gray.600'>
									Всего: {savedRoutes.length}
								</Text>
								<Button
									size='sm'
									variant='outline'
									onClick={loadSavedRoutes}
									isLoading={savedRoutesStatus.loading}
								>
									Обновить
								</Button>
							</HStack>
							{savedRoutesStatus.error && (
								<Text fontSize='sm' color='red.500' mb={2}>
									{savedRoutesStatus.error}
								</Text>
							)}
							{savedRoutes.length === 0 ? (
								<Text fontSize='sm' color='gray.500'>
									Нет сохранённых маршрутов
								</Text>
							) : (
								<VStack spacing={3} align='stretch'>
									{savedRoutes.map((route, index) => {
										const isVisible = visibleSavedRouteIds.includes(route.routeId)
										return (
											<Box
												key={route.routeId || route.name || index}
												borderWidth='1px'
												borderRadius='lg'
												p={3}
											>
												<HStack justify='space-between' align='flex-start'>
													<Box>
														<Text fontWeight='semibold'>
															{route.name || 'Без названия'}
														</Text>
														<Text fontSize='xs' color='gray.500'>
															{route.createdAt
																? new Date(route.createdAt).toLocaleString('ru-RU')
																: 'Дата неизвестна'}
														</Text>
														<Text fontSize='xs' color='gray.600' mt={1}>
															Дистанция:{' '}
															<Text as='span'>
																{typeof route.distanceKm === 'number'
																	? `${route.distanceKm.toFixed(2)} km`
																	: '—'}
															</Text>
														</Text>
														{route.durationMinutes && (
															<Text fontSize='xs' color='gray.600'>
																Длительность:{' '}
																<Text as='span'>
																	{Math.round(route.durationMinutes)} мин
																</Text>
															</Text>
														)}
														{route.description && (
															<Text fontSize='xs' color='gray.500' mt={1}>
																{route.description}
															</Text>
														)}
													</Box>
													<VStack spacing={2}>
														<Tooltip label='Показать/скрыть на карте'>
														<Button
															size='xs'
															variant={isVisible ? 'solid' : 'outline'}
															colorScheme={isVisible ? 'green' : 'blue'}
															onClick={() => handleToggleSavedRoute(route.routeId)}
														>
															{isVisible ? 'Скрыть' : 'Показать'}
														</Button>
														</Tooltip>
														<Tooltip label='Поделиться ссылкой'>
															<IconButton
																size='xs'
																variant='ghost'
																colorScheme='teal'
																icon={<LinkIcon />}
																onClick={() => handleShareRoute(route)}
																aria-label='Поделиться ссылкой'
															/>
														</Tooltip>
														<Tooltip
															label={
																publishedRoutesMap[route.routeId]
																	? 'Убрать из каталога'
																	: 'Опубликовать в каталоге'
															}
														>
															<IconButton
																size='xs'
																variant={
																	publishedRoutesMap[route.routeId]
																		? 'solid'
																		: 'outline'
																}
																colorScheme={
																	publishedRoutesMap[route.routeId]
																		? 'purple'
																		: 'gray'
																}
																icon={<FaMapMarkedAlt />}
																onClick={() => handlePublishRoute(route)}
																aria-label='Опубликовать маршрут'
															/>
														</Tooltip>
														<Button
															size='xs'
															variant='ghost'
															colorScheme='red'
															onClick={() => handleDeleteSavedRoute(route.routeId)}
															isLoading={
																routeActionState.deletingRouteId === route.routeId
															}
														>
															Удалить
														</Button>
													</VStack>
												</HStack>
											</Box>
										)
									})}
								</VStack>
							)}
						</CardBody>
					</Card>
				</Box>

				<Box>
					<Box align='center'>
						<Badge bgColor='gray.100' borderRadius={10} fontSize={23}>
							Общая статистика
						</Badge>
					</Box>
					{loading ? (
						<Box align='center' mt={4}>
							<Spinner size='xl' />
						</Box>
					) : error ? (
						<Text color='red.500'>{error}</Text>
					) : (
						stats &&
						distanceCategory && (
							<Box>
								<Card my={3}>
									<CardBody p={2}>
										<Text>
											Общее расстояние:{' '}
											<Text as='span'>{distanceCategory.totalDistance} km</Text>
										</Text>
										<Text>
											Недельный пробег:{' '}
											<Text as='span'>{stats.totalDistance.toFixed(2)} km</Text>
										</Text>
										<Text>
											Дневной пробег: <Text as='span'>{todayDistance} km</Text>
										</Text>
									</CardBody>
								</Card>
								<Card mb={3}>
									<CardBody p={2}>
										{distanceCategory.category === 'north' ? (
											<Text>
												<Text as='span' color='blue.400' fontWeight='bold'>
													Братство Северного Бублика:
												</Text>
											</Text>
										) : (
											<Text>
												<Text as='span' color='red' fontWeight='bold'>
													Южный СКА Сквад:
												</Text>
											</Text>
										)}
										<Text>
											Пробег на севере:{' '}
											<Text as='span' color='blue.400'>
												{distanceCategory.northDistance} km (
												{distanceCategory.percentageInNorth}%)
											</Text>
										</Text>
										<Text>
											Пробег на юге:{' '}
											<Text as='span' color='red'>
												{distanceCategory.southDistance} km (
												{distanceCategory.percentageInSouth}%)
											</Text>
										</Text>
									</CardBody>
								</Card>

								<Box align='center'>
									<Badge bgColor='gray.100' borderRadius={10} fontSize={20}>
										Недельный пробег
									</Badge>
								</Box>

								<Stack spacing={3} mt={3}>
									{stats.dailyStats.map((dayStat, index) => (
										<Box
											key={index}
											p={1.5}
											borderWidth='1px'
											borderRadius='lg'
											bg='gray.100'
										>
											<Text fontWeight='bold'>{dayStat.day}</Text>
											<Text>
												Расстояние:{' '}
												<Text as='span'>{dayStat.distance.toFixed(2)} km</Text>
											</Text>
											<Text>
												Средняя скорость:{' '}
												<Text as='span'>
													{dayStat.averageSpeed.toFixed(2)} km/h
												</Text>
											</Text>
										</Box>
									))}
								</Stack>
							</Box>
						)
					)}
				</Box>
			</VStack>
		</Box>
	)
}

export default WeeklyStats
