import { API_CONFIG } from '../utils/config'

const API_BASE_URL = API_CONFIG.BASE_URL
const isShareDisabledByEnv =
	(import.meta?.env?.VITE_DISABLE_SHARE_ENDPOINT || '').toString() === 'true'
const isLocalApi = API_BASE_URL.includes('localhost:5001')

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

let shareEndpointAvailable = !(isShareDisabledByEnv || isLocalApi)

export const fetchUserProfile = async userId => {
	if (!userId) {
		throw new Error('Не указан пользователь')
	}

	const response = await fetch(
		buildUrl(`/users/${encodeURIComponent(userId)}/profile`)
	)
	return parseResponse(response, 'Не удалось загрузить профиль')
}

export const updateUserProfile = async (userId, payload = {}) => {
	if (!userId) {
		throw new Error('Не указан пользователь')
	}

	const response = await fetch(
		buildUrl(`/users/${encodeURIComponent(userId)}/profile`),
		{
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		}
	)
	return parseResponse(response, 'Не удалось сохранить профиль')
}

export const uploadUserAvatar = async (userId, file) => {
	if (!userId || !file) {
		throw new Error('Не указан пользователь или файл аватара')
	}

	const formData = new FormData()
	formData.append('avatar', file)

	const response = await fetch(
		buildUrl(`/users/${encodeURIComponent(userId)}/avatar`),
		{
			method: 'POST',
			body: formData,
		}
	)

	return parseResponse(response, 'Не удалось загрузить аватар')
}

export const deleteUserAvatar = async userId => {
	if (!userId) {
		throw new Error('Не указан пользователь')
	}

	const response = await fetch(
		buildUrl(`/users/${encodeURIComponent(userId)}/avatar`),
		{
			method: 'DELETE',
		}
	)
	return parseResponse(response, 'Не удалось удалить аватар')
}

export const fetchUserRoutes = async userId => {
	if (!userId) {
		throw new Error('Не указан пользователь')
	}

	const response = await fetch(
		buildUrl(`/users/${encodeURIComponent(userId)}/routes`)
	)
	return parseResponse(response, 'Не удалось загрузить маршруты')
}

export const saveUserRoute = async (userId, routePayload) => {
	if (!userId) {
		throw new Error('Не указан пользователь')
	}

	const response = await fetch(
		buildUrl(`/users/${encodeURIComponent(userId)}/routes`),
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(routePayload),
		}
	)
	return parseResponse(response, 'Не удалось сохранить маршрут')
}

export const deleteUserRoute = async (userId, routeId) => {
	if (!userId || !routeId) {
		throw new Error('Не указан маршрут или пользователь')
	}

	const response = await fetch(
		buildUrl(
			`/users/${encodeURIComponent(userId)}/routes/${encodeURIComponent(
				routeId
			)}`
		),
		{
			method: 'DELETE',
		}
	)
	return parseResponse(response, 'Не удалось удалить маршрут')
}

export const shareUserRoute = async (userId, routeId) => {
	if (!userId || !routeId) {
		throw new Error('Не указан маршрут или пользователь')
	}

	if (!shareEndpointAvailable) {
		return null
	}

	try {
		const response = await fetch(
			buildUrl(
				`/users/${encodeURIComponent(userId)}/routes/${encodeURIComponent(
					routeId
				)}/share`
			),
			{
				method: 'POST',
			}
		)

		if (response.status === 404) {
			shareEndpointAvailable = false
			// сервер ещё не поддерживает share endpoint — вернём null, чтобы фронт ушёл в fallback-пул
			return null
		}

		// если сервер вернул что-то отличное от 2xx — не ломаем поток, просто уйдём в fallback
		if (!response.ok) {
			if (response.status >= 500 || response.status === 405) {
				shareEndpointAvailable = false
			}
			return null
		}

		return parseResponse(response, 'Не удалось создать ссылку маршрута')
	} catch (error) {
		console.warn('shareUserRoute network error:', error)
		shareEndpointAvailable = false
		return null
	}
}
