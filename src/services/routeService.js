import { API_CONFIG } from '../utils/config'

const API_BASE_URL = API_CONFIG.BASE_URL

const formatDateParam = value => {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		return null
	}
	const year = value.getFullYear()
	const month = `${value.getMonth() + 1}`.padStart(2, '0')
	const day = `${value.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}`
}

export const fetchRoute = async (userId, startDate, endDate) => {
	const url = new URL(`${API_BASE_URL}/route/${userId}`)

	const formattedStart = formatDateParam(startDate)
	const formattedEnd = formatDateParam(endDate)

	if (formattedStart) {
		url.searchParams.append('startDate', formattedStart)
	}
	if (formattedEnd) {
		url.searchParams.append('endDate', formattedEnd)
	}

	const response = await fetch(url)
	let data = null
	try {
		data = await response.json()
	} catch (error) {
		// тело может быть пустым на ошибках
	}

	if (!response.ok) {
		const message = data?.message || data?.error || 'Некорректные данные'
		throw new Error(message)
	}

	return data || []
}
