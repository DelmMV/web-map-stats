import { useCallback } from 'react'

const toXY = ({ lat, lng }) => ({ x: lng, y: lat })

const pointSegmentDistanceSquared = (p, v, w) => {
	const l2 = (w.x - v.x) * (w.x - v.x) + (w.y - v.y) * (w.y - v.y)
	if (l2 === 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y)
	const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
	if (t < 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y)
	if (t > 1) return (p.x - w.x) * (p.x - w.x) + (p.y - w.y) * (p.y - w.y)
	const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }
	return (p.x - proj.x) * (p.x - proj.x) + (p.y - proj.y) * (p.y - proj.y)
}

export function useManualRouteEditing({
	manualRouteMode,
	manualRoutePoints,
	resetManualRouteFeedback,
	setManualRoutePoints,
}) {
	const addManualRoutePoint = useCallback(
		(latlng, insertIndex = null) => {
			resetManualRouteFeedback()
			setManualRoutePoints(prev => {
				const next = Array.isArray(prev) ? [...prev] : []
				const payload = { lat: latlng.lat, lng: latlng.lng }
				if (
					Number.isNaN(payload.lat) ||
					Number.isNaN(payload.lng) ||
					!Number.isFinite(payload.lat) ||
					!Number.isFinite(payload.lng)
				) {
					return prev
				}
				if (typeof insertIndex === 'number') {
					next.splice(insertIndex, 0, payload)
				} else {
					next.push(payload)
				}
				return next
			})
		},
		[resetManualRouteFeedback, setManualRoutePoints]
	)

	const updateManualRoutePoint = useCallback(
		(index, latlng) => {
			resetManualRouteFeedback()
			setManualRoutePoints(prev => {
				const next = [...prev]
				next[index] = { lat: latlng.lat, lng: latlng.lng }
				return next
			})
		},
		[resetManualRouteFeedback, setManualRoutePoints]
	)

	const removeManualRoutePoint = useCallback(
		index => {
			resetManualRouteFeedback()
			setManualRoutePoints(prev => prev.filter((_, pointIndex) => pointIndex !== index))
		},
		[resetManualRouteFeedback, setManualRoutePoints]
	)

	const insertManualRoutePoint = useCallback(
		(latlng, afterIndex) => {
			resetManualRouteFeedback()
			setManualRoutePoints(prev => {
				const next = [...prev]
				next.splice(afterIndex + 1, 0, { lat: latlng.lat, lng: latlng.lng })
				return next
			})
		},
		[resetManualRouteFeedback, setManualRoutePoints]
	)

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
				const a = toXY(manualRoutePoints[i])
				const b = toXY(manualRoutePoints[i + 1])
				const dist = pointSegmentDistanceSquared(p, a, b)
				if (dist < bestDistance) {
					bestDistance = dist
					closestIndex = i
				}
			}
			insertManualRoutePoint(latlng, closestIndex)
		},
		[insertManualRoutePoint, manualRouteMode, manualRoutePoints]
	)

	return {
		addManualRoutePoint,
		updateManualRoutePoint,
		removeManualRoutePoint,
		insertManualRoutePoint,
		handleManualRoutePolylineClick,
	}
}
