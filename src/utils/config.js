/**
 * Конфигурация приложения
 */

// Open-Meteo API Configuration (БЕСПЛАТНО!)
// Не требует API ключа или регистрации
export const WEATHER_CONFIG = {
	// Open-Meteo - полностью бесплатный сервис
	API_KEY: null, // API ключ не требуется!
	BASE_URL: 'https://api.open-meteo.com/v1',

	// Настройки по умолчанию
	DEFAULT_UNITS: 'metric', // всегда metric для Open-Meteo
	DEFAULT_LANGUAGE: 'ru', // не поддерживается Open-Meteo, используем описания на английском

	// Интервалы обновления (в миллисекундах)
	WIDGET_UPDATE_INTERVAL: 10 * 60 * 1000, // 10 минут
	LAYER_UPDATE_INTERVAL: 15 * 60 * 1000, // 15 минут

	// Параметры для Open-Meteo
	CURRENT_PARAMS:
		'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m',
	HOURLY_PARAMS:
		'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code',
}

// Коды погоды Open-Meteo для описаний
export const WEATHER_CODES = {
	0: 'Ясно',
	1: 'В основном ясно',
	2: 'Частично облачно',
	3: 'Пасмурно',
	45: 'Туман',
	48: 'Изморозь',
	51: 'Легкая морось',
	53: 'Умеренная морось',
	55: 'Интенсивная морось',
	56: 'Замерзающая легкая морось',
	57: 'Замерзающая интенсивная морось',
	61: 'Слабый дождь',
	63: 'Умеренный дождь',
	65: 'Сильный дождь',
	66: 'Замерзающий слабый дождь',
	67: 'Замерзающий сильный дождь',
	71: 'Слабый снегопад',
	73: 'Умеренный снегопад',
	75: 'Сильный снегопад',
	77: 'Снежные зерна',
	80: 'Слабые ливни',
	81: 'Умеренные ливни',
	82: 'Сильные ливни',
	85: 'Слабые снежные ливни',
	86: 'Сильные снежные ливни',
	95: 'Гроза',
	96: 'Гроза с легким градом',
	99: 'Гроза с сильным градом',
}

// Иконки для кодов погоды
export const WEATHER_ICONS = {
	0: '01d', // clear sky
	1: '02d', // few clouds
	2: '03d', // scattered clouds
	3: '04d', // broken clouds
	45: '50d', // mist
	48: '50d', // mist
	51: '09d', // shower rain
	53: '09d',
	55: '09d',
	56: '09d',
	57: '09d',
	61: '10d', // rain
	63: '10d',
	65: '10d',
	66: '10d',
	67: '10d',
	71: '13d', // snow
	73: '13d',
	75: '13d',
	77: '13d',
	80: '09d', // shower rain
	81: '09d',
	82: '09d',
	85: '13d', // snow
	86: '13d',
	95: '11d', // thunderstorm
	96: '11d',
	99: '11d',
}

// Настройки карты
export const MAP_CONFIG = {
	DEFAULT_CENTER: [59.938676, 30.314487], // Санкт-Петербург
	DEFAULT_ZOOM: 10,
}

// Настройки приложения для разных режимов
export const APP_CONFIG = {
	// Определение режима
	isDev: import.meta.env.DEV,
	isProduction: import.meta.env.PROD,

	// Настройки разработки
	development: {
		// Тестовый пользователь для разработки
		defaultUser: { id: 200885469 },
		// Включить отладочную информацию
		enableDebugLogs: true,
		// Показать индикатор dev режима
		showDevIndicator: true,
	},

	// Настройки продакшен
	production: {
		// Telegram bot для аутентификации
		telegramBotName: 'LampStatsBot',
		// Отключить отладочную информацию
		enableDebugLogs: false,
		// Скрыть индикатор dev режима
		showDevIndicator: false,
	},
}

// Вспомогательные функции для работы с конфигурацией
export const getCurrentConfig = () => {
	return APP_CONFIG.isDev ? APP_CONFIG.development : APP_CONFIG.production
}

export const getDefaultUser = () => {
	return APP_CONFIG.isDev ? APP_CONFIG.development.defaultUser : null
}

export const shouldLog = () => {
	return getCurrentConfig().enableDebugLogs
}

// Утилита для логирования с учетом режима приложения
export const devLog = {
	info: (...args) => {
		if (shouldLog()) {
			console.log('ℹ️ [DEV]', ...args)
		}
	},
	warn: (...args) => {
		if (shouldLog()) {
			console.warn('⚠️ [DEV]', ...args)
		}
	},
	error: (...args) => {
		if (shouldLog()) {
			console.error('❌ [DEV]', ...args)
		}
	},
	success: (...args) => {
		if (shouldLog()) {
			console.log('✅ [DEV]', ...args)
		}
	},
	debug: (...args) => {
		if (shouldLog()) {
			console.debug('🐛 [DEV]', ...args)
		}
	},
}

// Экспорт для обратной совместимости
export default {
	WEATHER_CONFIG,
	WEATHER_CODES,
	WEATHER_ICONS,
	MAP_CONFIG,
	APP_CONFIG,
	getCurrentConfig,
	getDefaultUser,
	shouldLog,
	devLog,
}
