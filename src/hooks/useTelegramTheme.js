import { useEffect, useState } from 'react'

/**
 * Хук для определения и управления темой на основе Telegram WebApp
 * @returns {Object} объект с информацией о теме
 */
export const useTelegramTheme = () => {
	const [theme, setTheme] = useState('light')
	const [themeParams, setThemeParams] = useState({})

	useEffect(() => {
		// Проверяем доступность Telegram WebApp
		if (window.Telegram && window.Telegram.WebApp) {
			const tg = window.Telegram.WebApp

			// Получаем тему из Telegram
			const colorScheme = tg.colorScheme || 'light'
			setTheme(colorScheme)

			// Получаем цветовые параметры темы
			const params = tg.themeParams || {}
			setThemeParams(params)

			// Слушаем изменения темы
			tg.onEvent('themeChanged', () => {
				setTheme(tg.colorScheme || 'light')
				setThemeParams(tg.themeParams || {})
			})

			// Устанавливаем тему в HTML
			document.documentElement.setAttribute('data-theme', colorScheme)

			// Применяем CSS переменные из Telegram
			if (params) {
				const root = document.documentElement

				// Основные цвета
				if (params.bg_color)
					root.style.setProperty('--tg-bg-color', params.bg_color)
				if (params.text_color)
					root.style.setProperty('--tg-text-color', params.text_color)
				if (params.hint_color)
					root.style.setProperty('--tg-hint-color', params.hint_color)
				if (params.link_color)
					root.style.setProperty('--tg-link-color', params.link_color)
				if (params.button_color)
					root.style.setProperty('--tg-button-color', params.button_color)
				if (params.button_text_color)
					root.style.setProperty(
						'--tg-button-text-color',
						params.button_text_color
					)
				if (params.secondary_bg_color)
					root.style.setProperty(
						'--tg-secondary-bg-color',
						params.secondary_bg_color
					)

				// Цвета заголовка
				if (params.header_bg_color)
					root.style.setProperty('--tg-header-bg-color', params.header_bg_color)
				if (params.accent_text_color)
					root.style.setProperty(
						'--tg-accent-text-color',
						params.accent_text_color
					)
				if (params.section_header_text_color)
					root.style.setProperty(
						'--tg-section-header-text-color',
						params.section_header_text_color
					)
				if (params.subtitle_text_color)
					root.style.setProperty(
						'--tg-subtitle-text-color',
						params.subtitle_text_color
					)
				if (params.destructive_text_color)
					root.style.setProperty(
						'--tg-destructive-text-color',
						params.destructive_text_color
					)
			}
		} else {
			// Fallback: определяем тему по prefers-color-scheme
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
			const systemTheme = mediaQuery.matches ? 'dark' : 'light'
			setTheme(systemTheme)
			document.documentElement.setAttribute('data-theme', systemTheme)

			// Слушаем изменения системной темы
			const handleChange = e => {
				const newTheme = e.matches ? 'dark' : 'light'
				setTheme(newTheme)
				document.documentElement.setAttribute('data-theme', newTheme)
			}

			mediaQuery.addEventListener('change', handleChange)
			return () => mediaQuery.removeEventListener('change', handleChange)
		}
	}, [])

	// Функция для принудительной смены темы (для тестирования)
	const toggleTheme = () => {
		const newTheme = theme === 'light' ? 'dark' : 'light'
		setTheme(newTheme)
		document.documentElement.setAttribute('data-theme', newTheme)
	}

	// Проверка является ли тема темной
	const isDark = theme === 'dark'

	// Получение цвета на основе темы
	const getColor = (lightColor, darkColor) => {
		return isDark ? darkColor : lightColor
	}

	// Получение адаптивных цветов для маркеров
	const getMarkerColors = () => ({
		charging: isDark ? '#4ade80' : '#34d399',
		charging24: isDark ? '#22c55e' : '#10b981',
		chargingAuto: isDark ? '#38bdf8' : '#06b6d4',
		interesting: isDark ? '#fbbf24' : '#f59e0b',
		danger: isDark ? '#f87171' : '#ef4444',
		chat: isDark ? '#a78bfa' : '#8b5cf6',
		workshop: isDark ? '#9ca3af' : '#6b7280',
		user: isDark ? '#60a5fa' : '#4285f4',
	})

	return {
		theme,
		isDark,
		themeParams,
		toggleTheme,
		getColor,
		getMarkerColors,
	}
}
