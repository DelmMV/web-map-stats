import { API_CONFIG } from '../utils/config'

const API_BASE_URL = API_CONFIG.BASE_URL
const CACHE_TTL = 5 * 60 * 1000 // 5 минут
const heatmapCache = new Map()

const getCacheKey = (period, year, month) =>
	`${period}_${year}_${month ?? 'all'}`

export const fetchHeatmapData = async (period, year, month) => {
	const cacheKey = getCacheKey(period, year, month)
	const cachedEntry = heatmapCache.get(cacheKey)
	const now = Date.now()

	if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
		return cachedEntry.data
	}

	let url
	switch (period) {
		case 'this_month':
			url = `${API_BASE_URL}/monthly-heatmap/${year}/${month}`
			break
		case 'last_month':
			const lastMonth = month === 1 ? 12 : month - 1
			const lastMonthYear = month === 1 ? year - 1 : year
			url = `${API_BASE_URL}/monthly-heatmap/${lastMonthYear}/${lastMonth}`
			break
		case 'this_year':
			url = `${API_BASE_URL}/yearly-heatmap/${year}`
			break
		default:
			url = `${API_BASE_URL}/monthly-heatmap/${year}/${month}`
	}

	const response = await fetch(url)
	if (!response.ok) {
		const errorData = await response.json()
		throw new Error(
			errorData.error || 'Ошибка при загрузке данных тепловой карты'
		)
	}

	const data = await response.json()
	heatmapCache.set(cacheKey, { data, timestamp: now })
	return data
}

export const clearHeatmapCache = () => heatmapCache.clear()
