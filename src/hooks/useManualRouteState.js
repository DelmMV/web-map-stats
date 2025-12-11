import { useState } from 'react'

const DEFAULT_MANUAL_ROUTE_COLOR = '#ff6b6b'

export function useManualRouteState({ defaultColor = DEFAULT_MANUAL_ROUTE_COLOR } = {}) {
	const [manualRouteMode, setManualRouteMode] = useState(false)
	const [manualRoutePoints, setManualRoutePoints] = useState([])
	const [manualRouteMeta, setManualRouteMeta] = useState({
		name: '',
		description: '',
		color: defaultColor,
		mapProvider: '',
		difficulty: '',
		surfaceTypes: [],
	})
	const [manualRouteStatus, setManualRouteStatus] = useState({
		saving: false,
		error: null,
		success: false,
	})
	const [manualRouteFollowRoads, setManualRouteFollowRoads] = useState(true)
	const [manualRoutePath, setManualRoutePath] = useState([])
	const [manualRouteRoutingStatus, setManualRouteRoutingStatus] = useState({
		loading: false,
		error: null,
	})
	const [manualRouteLegDistances, setManualRouteLegDistances] = useState([])
	const [manualRouteEditingRouteId, setManualRouteEditingRouteId] = useState(null)
	const [manualRouteProfile, setManualRouteProfile] = useState('driving')

	return {
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
	}
}
