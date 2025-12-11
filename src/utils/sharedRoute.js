import LZString from 'lz-string'
import polyline from '@mapbox/polyline'

export const SHARED_ROUTE_QUERY_KEY = 'sharedRoute'
export const SHARED_ROUTE_ID_QUERY_KEY = 'sharedId'
const DEFAULT_ROUTE_COLOR = '#6366F1'

const normalizeCoordinatePair = point => {
	if (!point) return null
	const safeNumber = value => {
		const num = Number(value)
		return Number.isFinite(num) ? num : null
	}

	if (Array.isArray(point) && point.length >= 2) {
		const lat = safeNumber(point[0])
		const lng = safeNumber(point[1])
		return lat === null || lng === null ? null : [lat, lng]
	}

	if (typeof point === 'object') {
		const lat =
			safeNumber(point.latitude) ??
			safeNumber(point.lat) ??
			safeNumber(point.latLng?.lat)
		const lng =
			safeNumber(point.longitude) ??
			safeNumber(point.lng) ??
			safeNumber(point.latLng?.lng) ??
			safeNumber(point.lon)

		return lat === null || lng === null ? null : [lat, lng]
	}

	return null
}

const encodePolylinePoints = list => {
	if (!Array.isArray(list) || list.length < 2) {
		return ''
	}
	const coords = list
		.map(pair => {
			if (!pair) return null
			const lat = Number(pair[0])
			const lng = Number(pair[1])
			if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
				return null
			}
			return [Number(lat.toFixed(6)), Number(lng.toFixed(6))]
		})
		.filter(Boolean)

	if (coords.length < 2) return ''

	return polyline.encode(coords, 6)
}

const decodePolylinePoints = value => {
	if (typeof value !== 'string' || !value.length) {
		return []
	}
	try {
		return polyline.decode(value, 6).map(([lat, lng]) => [lat, lng])
	} catch (error) {
		console.error('Failed to decode shared route polyline:', error)
		return []
	}
}

const normalizePointsList = list => {
	if (!Array.isArray(list)) return []
	return list.map(normalizeCoordinatePair).filter(Boolean)
}

const normalizeSurfaceTypes = value => {
	if (!Array.isArray(value)) return []
	return value
		.map(item => (item == null ? '' : String(item).trim()))
		.filter(Boolean)
}

const pointsToLatLngObjects = pairs =>
	pairs.map(([lat, lng]) => ({
		latitude: Number(lat.toFixed(6)),
		longitude: Number(lng.toFixed(6)),
	}))

export const prepareRoutePayload = route => {
	if (!route) {
		throw new Error('Маршрут не найден')
	}

	const waypointsPairs = normalizePointsList(route.waypoints)
	let pathSource = waypointsPairs
	if (Array.isArray(route.pathCoordinates) && route.pathCoordinates.length >= 2) {
		pathSource = route.pathCoordinates
	} else if (
		Array.isArray(route.positions) &&
		route.positions.length >= 2
	) {
		pathSource = route.positions
	}

	const pathPairs = normalizePointsList(pathSource)
	if (pathPairs.length < 2) {
		throw new Error('Недостаточно точек маршрута для сохранения')
	}

	const finalWaypointsPairs =
		waypointsPairs.length >= 2
			? waypointsPairs
			: [pathPairs[0], pathPairs[pathPairs.length - 1]]

	const normalizedSurfaceTypes = normalizeSurfaceTypes(route.surfaceTypes)
	const normalizedDifficulty =
		typeof route.difficulty === 'string'
			? route.difficulty.trim()
			: route.difficulty

	return {
		routeId: route.routeId || null,
		name: route.name || '',
		description: route.description || '',
		color: route.color || DEFAULT_ROUTE_COLOR,
		mapProvider: route.mapProvider || '',
		followRoads: typeof route.followRoads === 'boolean' ? route.followRoads : true,
		routingProfile: route.routingProfile || 'driving',
		distanceKm:
			typeof route.distanceKm === 'number'
				? Number(route.distanceKm)
				: undefined,
		difficulty:
			normalizedDifficulty && String(normalizedDifficulty).trim().length > 0
				? normalizedDifficulty
				: undefined,
		surfaceTypes: normalizedSurfaceTypes.length ? normalizedSurfaceTypes : undefined,
		waypoints: pointsToLatLngObjects(finalWaypointsPairs),
		pathCoordinates: pointsToLatLngObjects(pathPairs),
	}
}

const compressPayload = input => {
	const result = LZString.compressToEncodedURIComponent(input)
	if (!result) {
		throw new Error('Не удалось сжать маршрут')
	}
	return result
}

const decompressPayload = encoded => {
	const result = LZString.decompressFromEncodedURIComponent(encoded)
	if (typeof result !== 'string' || !result.length) {
		throw new Error('Некорректная ссылка маршрута')
	}
	return result
}

const serializePointSet = points => {
	const normalized = normalizePointsList(points)
	return normalized.length >= 2 ? encodePolylinePoints(normalized) : ''
}

const deserializePointSet = value => {
	if (typeof value === 'string') {
		const decoded = decodePolylinePoints(value)
		if (decoded.length >= 2) {
			return decoded
		}
	}
	return normalizePointsList(value)
}

const buildSharePayload = route => {
	const normalized = prepareRoutePayload(route)
	if (!Array.isArray(normalized.pathCoordinates) || normalized.pathCoordinates.length < 2) {
		throw new Error('Недостаточно точек для создания ссылки')
	}

	const waypointPolyline = serializePointSet(
		normalized.waypoints.map(point => [point.latitude, point.longitude])
	)
	const pathPolyline = serializePointSet(
		normalized.pathCoordinates.map(point => [point.latitude, point.longitude])
	)

	return {
		v: 2,
		id: normalized.routeId || null,
		n: normalized.name || '',
		d: normalized.description || '',
		c: normalized.color || DEFAULT_ROUTE_COLOR,
		fr: normalized.followRoads,
		rp: normalized.routingProfile,
		w: waypointPolyline,
		p: pathPolyline,
		dist: normalized.distanceKm,
	}
}

export const serializeRouteForShare = route => {
	const payload = buildSharePayload(route)
	const json = JSON.stringify(payload)
	return compressPayload(json)
}

export const deserializeSharedRoute = encodedPayload => {
	if (!encodedPayload) {
		throw new Error('Параметр маршрута не передан')
	}
	const json = decompressPayload(encodedPayload)
	const data = JSON.parse(json)
	const pathPairs = deserializePointSet(data.p)
	const waypointPairs = deserializePointSet(data.w)
	return {
		version: data.v || 1,
		routeId: data.id || null,
		name: data.n || '',
		description: data.d || '',
		color: data.c || DEFAULT_ROUTE_COLOR,
		followRoads: typeof data.fr === 'boolean' ? data.fr : true,
		routingProfile: data.rp || 'driving',
		path: pathPairs,
		waypoints: waypointPairs.map(([lat, lng]) => ({ lat, lng })),
		pathCoordinates: pointsToLatLngObjects(pathPairs),
		distanceKm:
			typeof data.dist === 'number' && Number.isFinite(data.dist)
				? data.dist
				: null,
	}
}

const getDefaultShareBaseUrl = () => {
	if (typeof window === 'undefined') {
		return '#/'
	}
	const { origin, pathname } = window.location
	return `${origin}${pathname}#/`
}

const buildShareUrlWithParam = (encodedPayload, baseUrl) => {
	const base = baseUrl || getDefaultShareBaseUrl()
	const separator = base.includes('?') ? '&' : '?'
	return `${base}${separator}${SHARED_ROUTE_QUERY_KEY}=${encodeURIComponent(
		encodedPayload
	)}`
}

export const buildSharedRouteUrl = (route, baseUrl) => {
	const encodedPayload = serializeRouteForShare(route)
	return buildShareUrlWithParam(encodedPayload, baseUrl)
}

export const buildSharedRouteIdUrl = (sharedId, baseUrl) => {
	if (!sharedId) return ''
	const base = baseUrl || getDefaultShareBaseUrl()
	const separator = base.includes('?') ? '&' : '?'
	return `${base}${separator}${SHARED_ROUTE_ID_QUERY_KEY}=${encodeURIComponent(
		sharedId
	)}`
}

export const getSharedRouteParamFromHash = hashString => {
	if (!hashString) return null
	const queryStart = hashString.indexOf('?')
	if (queryStart === -1) return null
	const search = hashString.substring(queryStart + 1)
	const params = new URLSearchParams(search)
	return params.get(SHARED_ROUTE_QUERY_KEY)
}

export const getSharedRouteIdFromHash = hashString => {
	if (!hashString) return null
	const queryStart = hashString.indexOf('?')
	if (queryStart === -1) return null
	const search = hashString.substring(queryStart + 1)
	const params = new URLSearchParams(search)
	return params.get(SHARED_ROUTE_ID_QUERY_KEY)
}

export const extractSharedRouteFromLocation = locationObject => {
	const hash =
		locationObject?.hash ||
		(typeof window !== 'undefined' ? window.location.hash : '')
	const encoded = getSharedRouteParamFromHash(hash)
	return encoded
		? {
				encoded,
				route: deserializeSharedRoute(encoded),
		  }
		: null
}
