import { useCallback, useEffect, useState } from 'react'

import {
	deserializeSharedRoute,
	getSharedRouteParamFromHash,
	getSharedRouteIdFromHash,
	SHARED_ROUTE_QUERY_KEY,
	SHARED_ROUTE_ID_QUERY_KEY,
} from '../utils/sharedRoute'
import { fetchSharedRouteById } from '../services/sharedRouteService'

const normalizeCoordinatePoint = point => {
	if (!point) return [NaN, NaN]
	if (Array.isArray(point) && point.length >= 2) {
		return [Number(point[0]), Number(point[1])]
	}
	if (typeof point === 'object') {
		if ('latitude' in point && 'longitude' in point) {
			return [Number(point.latitude), Number(point.longitude)]
		}
		if ('lat' in point && 'lng' in point) {
			return [Number(point.lat), Number(point.lng)]
		}
	}
	return [NaN, NaN]
}

export function useSharedRoutePreview() {
	const [sharedRoutePreview, setSharedRoutePreview] = useState(null)
	const [sharedRouteError, setSharedRouteError] = useState(null)
	const [sharedRouteIdParam, setSharedRouteIdParam] = useState(null)
	const [sharedRouteFetchStatus, setSharedRouteFetchStatus] = useState({
		loading: false,
		error: null,
	})

	useEffect(() => {
		if (typeof window === 'undefined') return undefined
		const applySharedRouteFromHash = hashString => {
			const hash = hashString || ''
			const encoded = getSharedRouteParamFromHash(hash)
			const sharedId = getSharedRouteIdFromHash(hash)
			if (encoded) {
				try {
					const decoded = deserializeSharedRoute(encoded)
					setSharedRoutePreview(decoded)
					setSharedRouteError(null)
					setSharedRouteIdParam(null)
				} catch (error) {
					console.error('Failed to parse shared route:', error)
					setSharedRoutePreview(null)
					setSharedRouteError('Не удалось загрузить маршрут по ссылке')
					setSharedRouteIdParam(null)
				}
				return
			}
			if (sharedId) {
				setSharedRoutePreview(null)
				setSharedRouteError(null)
				setSharedRouteIdParam(sharedId)
				return
			}
			setSharedRoutePreview(null)
			setSharedRouteError(null)
			setSharedRouteIdParam(null)
		}
		applySharedRouteFromHash(window.location.hash || '')
		const handleHashChange = () => {
			applySharedRouteFromHash(window.location.hash || '')
		}
		window.addEventListener('hashchange', handleHashChange)
		return () => {
			window.removeEventListener('hashchange', handleHashChange)
		}
	}, [])

	useEffect(() => {
		if (!sharedRouteIdParam) return undefined
		let isMounted = true
		setSharedRouteFetchStatus({ loading: true, error: null })
		setSharedRouteError(null)
		fetchSharedRouteById(sharedRouteIdParam)
			.then(data => {
				if (!isMounted) return
				const routePayload = data?.route
				if (!routePayload) {
					throw new Error('Маршрут не найден')
				}
				const pathSource = Array.isArray(routePayload.pathCoordinates)
					? routePayload.pathCoordinates
					: Array.isArray(routePayload.path)
					? routePayload.path
					: []
				const pathPositions = pathSource
					.map(normalizeCoordinatePoint)
					.filter(
						point => !Number.isNaN(point[0]) && !Number.isNaN(point[1])
					)
				if (pathPositions.length < 2) {
					throw new Error('Недостаточно точек для отображения маршрута')
				}
				const waypointObjects = Array.isArray(routePayload.waypoints)
					? routePayload.waypoints
					: []
				const normalizedWaypoints = waypointObjects
					.map(point => ({
						lat: Number(point.lat ?? point.latitude),
						lng: Number(point.lng ?? point.longitude),
					}))
					.filter(
						point => !Number.isNaN(point.lat) && !Number.isNaN(point.lng)
					)

				setSharedRoutePreview({
					routeId: routePayload.routeId || data?.sharedId || sharedRouteIdParam,
					name: routePayload.name || '',
					description: routePayload.description || '',
					color: routePayload.color || '#3182CE',
					followRoads:
						typeof routePayload.followRoads === 'boolean'
							? routePayload.followRoads
							: true,
					routingProfile: routePayload.routingProfile || 'driving',
					path: pathPositions,
					waypoints: normalizedWaypoints,
					distanceKm:
						typeof routePayload.distanceKm === 'number'
							? routePayload.distanceKm
							: null,
				})
				setSharedRouteFetchStatus({ loading: false, error: null })
			})
			.catch(error => {
				if (!isMounted) return
				console.error('Failed to fetch shared route:', error)
				setSharedRoutePreview(null)
				setSharedRouteError(error.message || 'Маршрут не найден')
				setSharedRouteFetchStatus({
					loading: false,
					error: error.message || 'Маршрут не найден',
				})
			})

		return () => {
			isMounted = false
		}
	}, [sharedRouteIdParam])

	const handleSharedRouteClear = useCallback(() => {
		if (typeof window === 'undefined') {
			setSharedRoutePreview(null)
			setSharedRouteError(null)
			setSharedRouteIdParam(null)
			setSharedRouteFetchStatus({ loading: false, error: null })
			return
		}
		const hash = window.location.hash || ''
		const queryIndex = hash.indexOf('?')
		if (queryIndex === -1) {
			setSharedRoutePreview(null)
			setSharedRouteError(null)
			setSharedRouteIdParam(null)
			setSharedRouteFetchStatus({ loading: false, error: null })
			return
		}
		const basePath = hash.substring(0, queryIndex) || '#/'
		const params = new URLSearchParams(hash.substring(queryIndex + 1))
		params.delete(SHARED_ROUTE_QUERY_KEY)
		params.delete(SHARED_ROUTE_ID_QUERY_KEY)
		const nextQuery = params.toString()
		const nextHash = nextQuery ? `${basePath}?${nextQuery}` : basePath
		if (nextHash === hash) {
			setSharedRoutePreview(null)
			setSharedRouteError(null)
			setSharedRouteIdParam(null)
			setSharedRouteFetchStatus({ loading: false, error: null })
		} else {
			window.location.hash = nextHash || '#/'
		}
	}, [])

	return {
		sharedRoutePreview,
		sharedRouteError,
		sharedRouteIdParam,
		sharedRouteFetchStatus,
		setSharedRouteIdParam,
		setSharedRoutePreview,
		setSharedRouteError,
		handleSharedRouteClear,
	}
}
