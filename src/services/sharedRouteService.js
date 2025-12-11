import { API_CONFIG } from '../utils/config'

const API_BASE_URL = API_CONFIG.BASE_URL

const parseResponse = async (response, fallbackMessage) => {
	let data = null
	try {
		data = await response.json()
	} catch (error) {
		// ignore body parse errors for empty responses
	}

	if (!response.ok) {
		const errorMessage =
			data?.message || data?.error || fallbackMessage || 'Ошибка запроса'
		throw new Error(errorMessage)
	}

	return data
}

const buildUrl = (path = '') => `${API_BASE_URL}${path}`
const sharedRouteCache = new Map()

export const createSharedRouteRecord = async payload => {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Нет данных маршрута для сохранения')
	}

	const normalizedPayload = { ...payload }
	if (
		!Array.isArray(normalizedPayload.waypoints) ||
		normalizedPayload.waypoints.length < 2
	) {
		throw new Error('Требуется минимум две точки маршрута')
	}
	if (!normalizedPayload.visibility) {
		normalizedPayload.visibility = 'public'
	}
	if (
		normalizedPayload.authorId !== undefined &&
		normalizedPayload.authorId !== null
	) {
		const numericAuthorId = Number(normalizedPayload.authorId)
		if (Number.isFinite(numericAuthorId)) {
			normalizedPayload.authorId = numericAuthorId
		}
	}

	const response = await fetch(buildUrl('/shared-routes'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(normalizedPayload),
	})

	return parseResponse(response, 'Не удалось создать короткую ссылку')
}

export const fetchSharedRouteById = async sharedId => {
	if (!sharedId) {
		throw new Error('Не указан идентификатор маршрута')
	}

	const cached = sharedRouteCache.get(sharedId)
	if (cached) return cached

	const requestPromise = (async () => {
		const response = await fetch(
			buildUrl(`/shared-routes/${encodeURIComponent(sharedId)}`)
		)
		return parseResponse(response, 'Не удалось загрузить маршрут по ссылке')
	})()

	sharedRouteCache.set(sharedId, requestPromise)

	try {
		const data = await requestPromise
		return data
	} catch (error) {
		sharedRouteCache.delete(sharedId)
		throw error
	}
}

export const fetchSharedRoutesCatalog = async ({
	limit = 20,
	offset = 0,
	authorId = null,
	bbox = null,
	visibility = 'public',
} = {}) => {
	const params = new URLSearchParams()
	if (limit) params.set('limit', limit)
	if (offset) params.set('offset', offset)
	if (authorId) params.set('authorId', authorId)
	if (bbox && typeof bbox === 'string') {
		params.set('bbox', bbox)
	}
	if (visibility) params.set('visibility', visibility)

	const queryString = params.toString()
	const url = queryString
		? `/shared-routes?${queryString}`
		: '/shared-routes'

	const response = await fetch(buildUrl(url))
	return parseResponse(response, 'Не удалось загрузить каталог маршрутов')
}

export const deleteSharedRouteRecord = async sharedId => {
	if (!sharedId) {
		throw new Error('Не указан идентификатор маршрута')
	}

	const response = await fetch(
		buildUrl(`/shared-routes/${encodeURIComponent(sharedId)}`),
		{
			method: 'DELETE',
		}
	)

	if (response.status === 404) {
		// уже удалён на сервере — считаем успехом для клиентского состояния
		return { removed: true, sharedId }
	}

	return parseResponse(response, 'Не удалось скрыть маршрут')
}
