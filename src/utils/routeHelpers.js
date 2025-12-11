import haversine from 'haversine-distance'
import polyline from '@mapbox/polyline'
import { formatRouteDate } from './routeFormatters'

export const DIFFICULTY_LABELS = {
	easy: 'Легкий',
	medium: 'Средний',
	hard: 'Сложный',
}

export const UNKNOWN_DATE_LABEL = formatRouteDate(null)
const DATE_FALLBACKS = ['createdAt', 'updatedAt', 'sharedAt', 'expiresAt']

export const getDateFromObjectId = value => {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	if (!/^[0-9a-fA-F]{24}$/.test(trimmed)) return null
	const hexTimestamp = trimmed.slice(0, 8)
	const millis = parseInt(hexTimestamp, 16) * 1000
	if (!Number.isFinite(millis)) return null
	const parsed = new Date(millis)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const resolveDateValue = candidate => {
	if (!candidate) return null
	if (candidate instanceof Date) return candidate
	if (typeof candidate === 'string' || typeof candidate === 'number') {
		const parsed = new Date(candidate)
		if (!Number.isNaN(parsed.getTime())) {
			return parsed
		}
		const objectIdDate = getDateFromObjectId(String(candidate))
		if (objectIdDate) return objectIdDate
		return null
	}
	if (
		typeof candidate === 'object' &&
		!Array.isArray(candidate) &&
		candidate.$date
	) {
		const parsed = new Date(candidate.$date)
		return Number.isNaN(parsed.getTime()) ? null : parsed
	}
	return null
}

export const extractSurfaceTypes = routeLike => {
	if (!routeLike) return []
	const candidates = [
		routeLike.surfaceTypes,
		routeLike.route?.surfaceTypes,
		routeLike.meta?.surfaceTypes,
		routeLike.meta?.route?.surfaceTypes,
		routeLike.route?.meta?.surfaceTypes,
		routeLike.route?.route?.surfaceTypes,
	]
	for (const candidate of candidates) {
		if (Array.isArray(candidate) && candidate.length > 0) {
			return Array.from(
				new Set(
					candidate
						.map(item => (item == null ? '' : String(item).trim()))
						.filter(Boolean)
				)
			)
		}
	}
	return []
}

export const extractDifficulty = routeLike => {
	if (!routeLike) return ''
	const candidates = [
		routeLike.difficulty,
		routeLike.route?.difficulty,
		routeLike.meta?.difficulty,
		routeLike.meta?.route?.difficulty,
		routeLike.route?.meta?.difficulty,
		routeLike.route?.route?.difficulty,
	]
	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.length > 0) {
			return candidate.trim()
		}
	}
	return ''
}

export const extractRouteDateText = routeLike => {
	if (!routeLike) return UNKNOWN_DATE_LABEL
	const stacks = [routeLike, routeLike.route, routeLike.meta, routeLike.meta?.route]
	for (const source of stacks) {
		if (!source) continue
		for (const key of DATE_FALLBACKS) {
			if (source[key]) {
				const parsed = resolveDateValue(source[key])
				if (parsed) {
					return formatRouteDate(parsed)
				}
			}
		}
	}
	const fallbackId = routeLike.routeId || routeLike._id || routeLike.slug || null
	const parsedIdDate = resolveDateValue(fallbackId)
	if (parsedIdDate) {
		return formatRouteDate(parsedIdDate)
	}
	return UNKNOWN_DATE_LABEL
}

export const formatDifficulty = value => {
	if (!value) return ''
	const normalized = String(value).trim()
	if (!normalized) return ''
	return DIFFICULTY_LABELS[normalized] || normalized
}

const parsePoint = point => {
	if (!point) return null
	const lat =
		(Array.isArray(point) ? point[0] : point.lat ?? point.latitude ?? point.y) ??
		(Array.isArray(point?.latLng) ? point.latLng[0] : point.latLng?.lat)
	const lng =
		(Array.isArray(point) ? point[1] : point.lng ?? point.longitude ?? point.x) ??
		(Array.isArray(point?.latLng) ? point.latLng[1] : point.latLng?.lng)
	const latNum = Number(lat)
	const lngNum = Number(lng)
	if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null
	return { lat: latNum, lng: lngNum }
}

const decodePolyline = value => {
	if (typeof value !== 'string' || !value.trim()) return null
	try {
		const decoded = polyline.decode(value, 6)
		if (Array.isArray(decoded) && decoded.length >= 2) {
			return decoded.map(([lat, lng]) => ({ lat, lng }))
		}
	} catch (error) {
		return null
	}
	return null
}

export const normalizeCoordinates = route => {
	if (!route) return []

	const sources = [
		route.pathCoordinates,
		route.path,
		route.positions,
		route.waypoints,
		route.route?.pathCoordinates,
		route.route?.path,
		route.route?.positions,
		route.route?.waypoints,
	]

	for (const source of sources) {
		if (!source) continue
		if (typeof source === 'string') {
			const decoded = decodePolyline(source)
			if (decoded?.length >= 2) return decoded
		}
		if (Array.isArray(source) && source.length >= 2) {
			const coords = source.map(parsePoint).filter(Boolean)
			if (coords.length >= 2) return coords
		}
	}
	return []
}

export const computeRouteDistanceKmValue = route => {
	if (typeof route?.distanceKm === 'number') {
		const value = Number(route.distanceKm)
		return Number.isFinite(value) ? value : null
	}
	const coords = normalizeCoordinates(route)
	if (coords.length < 2) return null
	let total = 0
	for (let i = 1; i < coords.length; i++) {
		const prev = coords[i - 1]
		const current = coords[i]
		total += haversine(
			{ lat: prev.lat, lon: prev.lng },
			{ lat: current.lat, lon: current.lng }
		)
	}
	return total > 0 ? total / 1000 : null
}

export const computeRouteDistanceText = route => {
	const kmValue = computeRouteDistanceKmValue(route)
	if (typeof kmValue === 'number' && Number.isFinite(kmValue)) {
		return `${kmValue.toFixed(2)} км`
	}
	return '—'
}

export const extractDescription = data => {
	if (!data || typeof data !== 'object') return ''
	const stack = [data]
	const seen = new Set()
	while (stack.length) {
		const current = stack.pop()
		if (!current || typeof current !== 'object' || seen.has(current)) continue
		seen.add(current)
		for (const [key, value] of Object.entries(current)) {
			if (typeof value === 'string' && key.toLowerCase().includes('desc')) {
				return value
			}
			if (value && typeof value === 'object') {
				stack.push(value)
			}
		}
	}
	return ''
}
