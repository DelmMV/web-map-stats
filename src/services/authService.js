import { API_CONFIG } from '../utils/config'

const API_BASE_URL = API_CONFIG.BASE_URL

class ApiError extends Error {
	constructor(message, status) {
		super(message)
		this.name = 'ApiError'
		this.status = status
	}
}

const handleResponse = async (response, defaultMessage) => {
	let data = null
	try {
		data = await response.json()
	} catch (error) {
		// ignore parse errors (e.g., empty responses)
	}

	if (!response.ok) {
		const message =
			data?.message || data?.error || defaultMessage || 'Ошибка запроса'
		throw new ApiError(message, response.status)
	}

	return data
}

export const registerUser = async payload => {
	const response = await fetch(`${API_BASE_URL}/auth/register`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	return handleResponse(response, 'Не удалось зарегистрироваться')
}

export const loginUser = async credentials => {
	const response = await fetch(`${API_BASE_URL}/auth/login`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(credentials),
	})

	return handleResponse(response, 'Не удалось войти')
}

export { ApiError }
