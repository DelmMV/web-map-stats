import { WEATHER_CODES, WEATHER_CONFIG, WEATHER_ICONS } from '../utils/config'

/**
 * Получает текущую погоду для указанных координат используя Open-Meteo API
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @returns {Promise<Object>} Объект с данными о погоде
 */
export const getCurrentWeather = async (lat, lon) => {
	try {
		const url = `${WEATHER_CONFIG.BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&current=${WEATHER_CONFIG.CURRENT_PARAMS}&timezone=auto`

		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		const data = await response.json()
		const current = data.current

		// Конвертируем данные в привычный формат
		return {
			temperature: Math.round(current.temperature_2m),
			description: WEATHER_CODES[current.weather_code] || 'Неизвестно',
			icon: WEATHER_ICONS[current.weather_code] || '01d',
			humidity: Math.round(current.relative_humidity_2m),
			windSpeed: Math.round(current.wind_speed_10m * 10) / 10, // округляем до 1 знака
			pressure: Math.round(current.surface_pressure),
			feelsLike: Math.round(current.apparent_temperature),
			precipitation: current.precipitation || 0,
			weatherCode: current.weather_code,
			city: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, // Open-Meteo не возвращает название города
			country: '',
		}
	} catch (error) {
		console.error('Error fetching weather data:', error)
		throw new Error('Не удалось получить данные о погоде')
	}
}

/**
 * Получает прогноз погоды на 7 дней для указанных координат
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @returns {Promise<Array>} Массив с прогнозом погоды
 */
export const getWeatherForecast = async (lat, lon) => {
	try {
		const url = `${WEATHER_CONFIG.BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=auto&forecast_days=7`

		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		const data = await response.json()
		const daily = data.daily

		// Конвертируем данные в привычный формат
		const forecast = []
		for (let i = 0; i < daily.time.length; i++) {
			forecast.push({
				date: new Date(daily.time[i]).getTime() / 1000, // конвертируем в timestamp
				temperature: Math.round(
					(daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2
				),
				temperatureMax: Math.round(daily.temperature_2m_max[i]),
				temperatureMin: Math.round(daily.temperature_2m_min[i]),
				description: WEATHER_CODES[daily.weather_code[i]] || 'Неизвестно',
				icon: WEATHER_ICONS[daily.weather_code[i]] || '01d',
				precipitation: daily.precipitation_sum[i] || 0,
				weatherCode: daily.weather_code[i],
			})
		}

		return forecast
	} catch (error) {
		console.error('Error fetching weather forecast:', error)
		throw new Error('Не удалось получить прогноз погоды')
	}
}

/**
 * Получает URL иконки погоды (используем OpenWeatherMap иконки для совместимости)
 * @param {string} iconCode - Код иконки
 * @param {string} size - Размер иконки ('small', 'medium', 'large')
 * @returns {string} URL иконки
 */
export const getWeatherIconUrl = (iconCode, size = 'medium') => {
	const sizeMap = {
		small: '@2x',
		medium: '@2x',
		large: '@4x',
	}

	// Используем OpenWeatherMap иконки для красивого отображения
	return `https://openweathermap.org/img/wn/${iconCode}${sizeMap[size]}.png`
}

/**
 * Получает описание погоды по коду
 * @param {number} weatherCode - Код погоды Open-Meteo
 * @returns {string} Описание погоды
 */
export const getWeatherDescription = weatherCode => {
	return WEATHER_CODES[weatherCode] || 'Неизвестно'
}

/**
 * Проверяет, требуется ли API ключ (для Open-Meteo не требуется)
 * @returns {boolean} false - API ключ не требуется
 */
export const isApiKeyRequired = () => {
	return false
}
