import { useMemo } from 'react'
import haversine from 'haversine-distance'
import { getManualRouteProfileConfig } from '../utils/manualRouteProfiles'

export function useManualRouteDerived({
	manualRoutePoints,
	manualRoutePath,
	manualRouteMeta,
	manualRouteMode,
	manualRouteStatus,
	manualRouteProfile,
	manualRouteFollowRoads,
	canModifyMap,
}) {
	const manualRoutePositions = useMemo(() => {
		if (manualRoutePath.length >= 2) return manualRoutePath
		return manualRoutePoints.map(point => [point.lat, point.lng])
	}, [manualRoutePath, manualRoutePoints])

	const manualRouteDistanceMeters = useMemo(() => {
		if (manualRoutePositions.length < 2) return 0
		let sum = 0
		for (let i = 1; i < manualRoutePositions.length; i++) {
			const prev = manualRoutePositions[i - 1]
			const current = manualRoutePositions[i]
			sum += haversine({ lat: prev[0], lon: prev[1] }, { lat: current[0], lon: current[1] })
		}
		return sum
	}, [manualRoutePositions])

	const manualRouteDistanceKm = useMemo(
		() => (manualRouteDistanceMeters ? manualRouteDistanceMeters / 1000 : 0),
		[manualRouteDistanceMeters]
	)

	const manualRouteProfileLabel = useMemo(() => {
		return getManualRouteProfileConfig(manualRouteProfile).label
	}, [manualRouteProfile])

	const manualRouteSummaryDistance =
		manualRouteDistanceKm > 0 ? manualRouteDistanceKm.toFixed(2) : '0.00'

	const manualRouteControlSize = false ? 'xs' : 'sm'
	const manualRouteActionButtonSize = false ? 'xs' : 'sm'
	const manualRouteHasUndo = manualRoutePoints.length > 0
	const manualRouteHasExistingRoute =
		manualRoutePoints.length > 0 || manualRoutePath.length > 0
	const manualRouteSaveDisabled =
		manualRoutePositions.length < 2 ||
		!manualRouteMeta.name.trim() ||
		manualRouteStatus.saving
	const shouldShowManualRoutePanel =
		canModifyMap &&
		(manualRouteMode || manualRoutePoints.length > 0 || manualRoutePath.length > 0)

	return {
		manualRoutePositions,
		manualRouteDistanceKm,
		manualRouteProfileLabel,
		manualRouteSummaryDistance,
		manualRouteControlSize,
		manualRouteActionButtonSize,
		manualRouteHasUndo,
		manualRouteHasExistingRoute,
		manualRouteSaveDisabled,
		manualRouteFollowRoads,
		shouldShowManualRoutePanel,
	}
}
