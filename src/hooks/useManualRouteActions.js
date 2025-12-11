import { useCallback } from 'react'

export function useManualRouteActions({
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
}) {
	const handleManualRouteClear = useCallback(() => {
		resetManualRouteFeedback()
		setManualRoutePoints([])
		setManualRouteLegDistances([])
		setManualRoutePath([])
		setManualRouteEditingRouteId(null)
		setManualRouteMode(false)
		setManualRouteStatus({ saving: false, error: null, success: false })
	}, [
		resetManualRouteFeedback,
		setManualRouteEditingRouteId,
		setManualRouteLegDistances,
		setManualRouteMode,
		setManualRoutePath,
		setManualRoutePoints,
		setManualRouteStatus,
	])

	const handleManualRouteResetPoints = useCallback(() => {
		resetManualRouteFeedback()
		setManualRoutePoints([])
		setManualRouteLegDistances([])
		setManualRoutePath([])
		setManualRouteEditingRouteId(null)
		setManualRouteStatus(prev => ({ ...prev, error: null, success: false }))
	}, [
		resetManualRouteFeedback,
		setManualRouteEditingRouteId,
		setManualRouteLegDistances,
		setManualRoutePath,
		setManualRoutePoints,
		setManualRouteStatus,
	])

	const handleManualRouteToggle = useCallback(() => {
		if (!canModifyMap) {
			requireAuth()
			return
		}
		resetManualRouteFeedback()
		if (manualRouteMode) {
			handleManualRouteClear()
			return
		}
		manualRoutePointDragLockRef.current = false
		setManualRouteMode(true)
	}, [
		canModifyMap,
		requireAuth,
		resetManualRouteFeedback,
		manualRouteMode,
		handleManualRouteClear,
		manualRoutePointDragLockRef,
		setManualRouteMode,
	])

	const handleManualRouteUndo = useCallback(() => {
		resetManualRouteFeedback()
		setManualRoutePoints(prev =>
			prev.length > 0 ? prev.slice(0, prev.length - 1) : prev
		)
	}, [resetManualRouteFeedback, setManualRoutePoints])

	const handleManualRouteEdit = useCallback(() => {
		if (!canModifyMap) {
			requireAuth()
			return
		}
		if (manualRoutePoints.length === 0 && manualRoutePath.length === 0) return
		resetManualRouteFeedback()
		if (!manualRouteMode) {
			if (manualRoutePoints.length === 0 && manualRoutePath.length >= 2) {
				setManualRoutePoints(manualRoutePath.map(([lat, lng]) => ({ lat, lng })))
			}
			manualRoutePointDragLockRef.current = false
			setManualRouteMode(true)
		}
	}, [
		canModifyMap,
		manualRouteMode,
		manualRoutePath,
		manualRoutePoints.length,
		manualRoutePointDragLockRef,
		requireAuth,
		resetManualRouteFeedback,
		setManualRouteMode,
		setManualRoutePoints,
	])

	return {
		handleManualRouteClear,
		handleManualRouteResetPoints,
		handleManualRouteToggle,
		handleManualRouteUndo,
		handleManualRouteEdit,
	}
}
