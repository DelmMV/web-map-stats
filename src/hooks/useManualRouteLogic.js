import { useCallback, useRef } from 'react'
import haversine from 'haversine-distance'

export function useManualRouteLogic({
	manualRouteMode,
	manualRoutePoints,
	manualRoutePath,
	setManualRoutePoints,
	setManualRoutePath,
	setManualRouteLegDistances,
	setManualRouteRoutingStatus,
	setManualRouteStatus,
	manualRoutePointDragLockRef,
	addManualRoutePoint,
	updateManualRoutePoint,
	removeManualRoutePoint,
	resetManualRouteFeedback,
}) {
	const routeClickLockRef = useRef(false)

	const handleManualRoutePolylineClick = useCallback(
		event => {
			if (!manualRouteMode || manualRoutePoints.length < 2) return
			const isShift = event.originalEvent?.shiftKey
			if (!isShift) return
			const latlng = event.latlng
			if (!latlng) return
			const p = toXY({ lat: latlng.lat, lng: latlng.lng })
			let closestIndex = 0
			let bestDistance = Number.POSITIVE_INFINITY
			for (let i = 0; i < manualRoutePoints.length - 1; i++) {
				const segStart = toXY(manualRoutePoints[i])
				const segEnd = toXY(manualRoutePoints[i + 1])
				const dist = pointToSegmentDistance(p, segStart, segEnd)
				if (dist < bestDistance) {
					bestDistance = dist
					closestIndex = i + 1
				}
			}
			const insertLatLng = { lat: latlng.lat, lng: latlng.lng }
			addManualRoutePoint(insertLatLng, closestIndex)
		},
		[manualRouteMode, manualRoutePoints, addManualRoutePoint]
	)

	const handleManualRoutePointDrag = useCallback(
		(index, newLatLng) => {
			if (manualRoutePointDragLockRef.current) return
			updateManualRoutePoint(index, newLatLng)
		},
		[manualRoutePointDragLockRef, updateManualRoutePoint]
	)

	const handleManualRoutePointDragEnd = useCallback(
		index => {
			manualRoutePointDragLockRef.current = false
			updateManualRoutePoint(index, manualRoutePoints[index])
		},
		[manualRoutePointDragLockRef, manualRoutePoints, updateManualRoutePoint]
	)

	const handleManualRouteSave = useCallback(
		async (
			onSave,
			{
				manualRouteMeta,
				manualRouteFollowRoads,
				manualRoutePositions,
				manualRouteDistanceKm,
				mapLayer,
				manualRouteEditingRouteId,
				userId,
				routingProfile,
				visibleSavedRouteIds,
				setVisibleSavedRouteIds,
				savedRoutes,
			}
		) => {
			resetManualRouteFeedback()
			if (manualRoutePositions.length < 2) {
				setManualRouteStatus({
					saving: false,
					error: 'Добавьте минимум две точки',
					success: false,
				})
				return false
			}
			if (!manualRouteMeta.name.trim()) {
				setManualRouteStatus({
					saving: false,
					error: 'Введите название',
					success: false,
				})
				return false
			}
			setManualRouteStatus({ saving: true, error: null, success: false })
			try {
				const payload = {
					name: manualRouteMeta.name,
					description: manualRouteMeta.description,
					color: manualRouteMeta.color,
					mapProvider: manualRouteMeta.mapProvider,
					followRoads: manualRouteFollowRoads,
					path: manualRoutePositions.map(([lat, lng]) => ({
						lat,
						lng,
					})),
					waypoints: manualRoutePoints.map(point => ({
						latitude: point.lat,
						longitude: point.lng,
					})),
					routeId: manualRouteEditingRouteId,
					distanceKm: manualRouteDistanceKm || undefined,
					routingProfile,
					mapLayer,
				}
				const savedRoute = await onSave(payload)
				if (savedRoute) {
					setManualRouteEditingRouteId(savedRoute.routeId || null)
					setVisibleSavedRouteIds(prev => {
						if (!savedRoute.routeId) return prev
						const filtered = Array.isArray(prev) ? prev.filter(Boolean) : []
						return savedRoute.routeId && !filtered.includes(savedRoute.routeId)
							? [savedRoute.routeId, ...filtered]
							: filtered
					})
					setManualRouteStatus({ saving: false, error: null, success: true })
				} else {
					setManualRouteStatus({
						saving: false,
						error: 'Не удалось сохранить маршрут',
						success: false,
					})
				}
				return true
			} catch (error) {
				setManualRouteStatus({
					saving: false,
					error: error.message || 'Не удалось сохранить маршрут',
					success: false,
				})
				return false
			}
		},
		[
			resetManualRouteFeedback,
			setManualRouteStatus,
			setManualRouteEditingRouteId,
			setVisibleSavedRouteIds,
		]
	)

	return {
		handleManualRoutePolylineClick,
		handleManualRoutePointDrag,
		handleManualRoutePointDragEnd,
		handleManualRouteSave,
		routeClickLockRef,
	}
}

// Helpers
const toXY = ({ lat, lng }) => {
	return { x: lng, y: lat }
}

const pointToSegmentDistance = (p, v, w) => {
	const l2 = distance2(v, w)
	if (l2 === 0) return distance2(p, v)
	const t =
		((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) /
		l2
	if (t < 0) return distance2(p, v)
	if (t > 1) return distance2(p, w)
	return distance2(p, {
		x: v.x + t * (w.x - v.x),
		y: v.y + t * (w.y - v.y),
	})
}

const distance2 = (v, w) => {
	return (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y)
}
