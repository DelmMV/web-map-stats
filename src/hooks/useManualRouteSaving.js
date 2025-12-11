import { useCallback } from 'react'
import { DEFAULT_MANUAL_ROUTE_COLOR } from '../utils/manualRouteProfiles'
import { createSharedRouteRecord } from '../services/sharedRouteService'

const PUBLISHED_ROUTES_STORAGE_KEY = 'publishedRoutesMap'

export function useManualRouteSaving({
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
}) {
	const handleManualRouteSave = useCallback(async () => {
		if (!userId) return false
		if (manualRoutePoints.length < 2 && manualRoutePositions.length < 2) return false

		resetManualRouteFeedback()
		setManualRouteStatus({ saving: true, error: null, success: false })

		const serializedPositions =
			manualRoutePositions.length >= 2
				? manualRoutePositions
				: manualRoutePoints.map(point => [point.lat, point.lng])

		const serializedPositionsObjects = serializedPositions.map(([lat, lng]) => ({
			latitude: lat,
			longitude: lng,
		}))

		const manualWaypoints = manualRoutePoints.map(point => ({
			latitude: point.lat,
			longitude: point.lng,
		}))

		const payload = {
			name: manualRouteMeta.name?.trim() || 'Безымянный',
		description: manualRouteMeta.description?.trim() || undefined,
		color: manualRouteMeta.color || DEFAULT_MANUAL_ROUTE_COLOR,
		mapProvider: manualRouteMeta.mapProvider || mapLayer,
		routingProfile: manualRouteProfile,
		followRoads: manualRouteFollowRoads,
		difficulty:
			typeof manualRouteMeta.difficulty === 'string' &&
			manualRouteMeta.difficulty.trim().length > 0
				? manualRouteMeta.difficulty.trim()
				: undefined,
		surfaceTypes:
			Array.isArray(manualRouteMeta.surfaceTypes) &&
			manualRouteMeta.surfaceTypes.length > 0
				? Array.from(
						new Set(
							manualRouteMeta.surfaceTypes
								.map(item => (item == null ? '' : String(item).trim()))
								.filter(Boolean)
						)
				  )
				: undefined,
			waypoints: manualWaypoints,
			pathCoordinates: serializedPositionsObjects,
		}
		const distanceKmValue = Number(manualRouteDistanceKm.toFixed(2))
		if (distanceKmValue > 0) {
			payload.distanceKm = distanceKmValue
		}

		const editingRouteId = manualRouteEditingRouteId

		try {
			const savedRouteRaw = await saveUserRoute(userId, payload)
			const savedRoute = savedRouteRaw
				? {
						...payload,
						routeId: savedRouteRaw.routeId || editingRouteId,
					}
				: null

			if (savedRoute) {
				// если маршрут был расшарен и сменился routeId — переносим связь
				if (
					editingRouteId &&
					savedRoute.routeId &&
					savedRoute.routeId !== editingRouteId &&
					typeof window !== 'undefined'
				) {
					try {
						const raw = window.localStorage.getItem(PUBLISHED_ROUTES_STORAGE_KEY)
						const parsed = raw ? JSON.parse(raw) : {}
						const existingSharedId = parsed?.[editingRouteId]
						if (existingSharedId) {
							delete parsed[editingRouteId]
							parsed[savedRoute.routeId] = existingSharedId
							window.localStorage.setItem(
								PUBLISHED_ROUTES_STORAGE_KEY,
								JSON.stringify(parsed)
							)
							window.dispatchEvent(
								new CustomEvent('manual-route-updated', {
									detail: {
										oldRouteId: editingRouteId,
										newRouteId: savedRoute.routeId,
										sharedId: existingSharedId,
									},
								})
							)
						}
					} catch (error) {
						console.warn('Failed to migrate shared route mapping:', error)
					}
				}

				// если маршрут был расшарен, обновляем запись по существующему sharedId
				if (typeof window !== 'undefined') {
					try {
						const raw = window.localStorage.getItem(PUBLISHED_ROUTES_STORAGE_KEY)
						const publishedMap = raw ? JSON.parse(raw) : {}
						const sharedIdToUpdate =
							publishedMap?.[savedRoute.routeId] ||
							(editingRouteId ? publishedMap?.[editingRouteId] : null)
						if (sharedIdToUpdate) {
							await createSharedRouteRecord({
								...payload,
								routeId: savedRoute.routeId || editingRouteId || null,
								sharedId: sharedIdToUpdate,
							})
							window.dispatchEvent(
								new CustomEvent('shared-route-published', {
									detail: {
										sharedId: sharedIdToUpdate,
										routeId: savedRoute.routeId || editingRouteId,
										updated: true,
									},
								})
							)
							window.dispatchEvent(
								new CustomEvent('manual-route-updated', {
									detail: {
										oldRouteId: savedRoute.routeId || editingRouteId,
										newRouteId: savedRoute.routeId || editingRouteId,
										sharedId: sharedIdToUpdate,
									},
								})
							)
						}
					} catch (error) {
						console.warn('Failed to update shared route after edit:', error)
					}
				}

				setSavedRoutes(prev => {
					if (editingRouteId) {
						const filtered = Array.isArray(prev)
							? prev.filter(
									route =>
										route.routeId !== editingRouteId &&
										(!savedRoute.routeId || route.routeId !== savedRoute.routeId)
							  )
							: []
						return [...filtered, savedRoute]
					}
					return [...prev, savedRoute]
				})
				setManualRouteStatus({ saving: false, error: null, success: true })
				setVisibleSavedRouteIds(prev => {
					const filtered = Array.isArray(prev)
						? prev
								.filter(Boolean)
								.filter(id => id !== editingRouteId && id !== savedRoute.routeId)
						: []
					return savedRoute.routeId ? [savedRoute.routeId, ...filtered] : filtered
				})
				setManualRouteEditingRouteId(savedRoute.routeId || editingRouteId || null)
			} else {
				setManualRouteStatus({
					saving: false,
					error: 'Не удалось сохранить маршрут',
					success: false,
				})
			}
			return true
		} catch (error) {
			console.error('Error saving manual route:', error)
			setManualRouteStatus({
				saving: false,
				error: error.message || 'Не удалось сохранить маршрут',
				success: false,
			})
			return false
		}
	}, [
		userId,
		manualRoutePoints,
		manualRoutePositions,
		manualRouteMeta.name,
		manualRouteMeta.description,
		manualRouteMeta.color,
		manualRouteMeta.mapProvider,
		manualRouteMeta.difficulty,
		manualRouteMeta.surfaceTypes,
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
	])

	return { handleManualRouteSave }
}
