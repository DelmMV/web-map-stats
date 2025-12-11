import { useEffect } from 'react'
import haversine from 'haversine-distance'

export function useManualRoutePath({
	manualRouteMode,
	manualRoutePoints,
	manualRouteFollowRoads,
	setManualRoutePath,
	setManualRouteLegDistances,
	setManualRouteRoutingStatus,
	manualRoutePointDragLockRef,
	requestRouting,
}) {
	useEffect(() => {
		if (!manualRouteMode) {
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

		let isCancelled = false
		setManualRouteRoutingStatus({ loading: true, error: null })
		requestRouting(manualRoutePoints)
			.then(({ positions, legDistances }) => {
				if (isCancelled) return
				setManualRoutePath(positions)
				setManualRouteLegDistances(legDistances)
				setManualRouteRoutingStatus({ loading: false, error: null })
			})
			.catch(error => {
				if (isCancelled) return
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
					error: error.message || 'Не удалось построить маршрут',
				})
			})

		return () => {
			isCancelled = true
		}
	}, [
		manualRouteMode,
		manualRoutePoints,
		manualRouteFollowRoads,
		setManualRoutePath,
		setManualRouteLegDistances,
		setManualRouteRoutingStatus,
		requestRouting,
	])
}
