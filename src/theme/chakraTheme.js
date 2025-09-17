import { extendTheme } from '@chakra-ui/react'

// Кастомная тема для Chakra UI с поддержкой наших CSS переменных
const chakraTheme = extendTheme({
	config: {
		initialColorMode: 'light',
		useSystemColorMode: false, // Отключаем автоматическое определение темы Chakra
	},
	styles: {
		global: {
			// Переопределяем глобальные стили
			'html, body': {
				backgroundColor: 'var(--bg-primary)',
				color: 'var(--text-primary)',
			},
			// Применяем переменные к основным элементам
			'*': {
				borderColor: 'var(--border-primary) !important',
			},
		},
	},
	colors: {
		// Создаем палитру на основе CSS переменных
		brand: {
			50: 'var(--accent-primary)',
			100: 'var(--accent-primary)',
			200: 'var(--accent-primary)',
			300: 'var(--accent-primary)',
			400: 'var(--accent-primary)',
			500: 'var(--accent-primary)',
			600: 'var(--accent-primary)',
			700: 'var(--accent-primary)',
			800: 'var(--accent-primary)',
			900: 'var(--accent-primary)',
		},
		// Переопределяем основные цвета
		gray: {
			50: 'var(--bg-tertiary)',
			100: 'var(--bg-secondary)',
			200: 'var(--border-primary)',
			300: 'var(--border-secondary)',
			400: 'var(--text-tertiary)',
			500: 'var(--text-secondary)',
			600: 'var(--text-primary)',
			700: 'var(--text-primary)',
			800: 'var(--bg-secondary)',
			900: 'var(--bg-primary)',
		},
	},
	components: {
		// Кастомизируем компоненты
		Button: {
			baseStyle: {
				borderRadius: '8px',
				fontWeight: '500',
			},
			variants: {
				solid: {
					bg: 'var(--accent-button, var(--accent-primary))',
					color: 'var(--text-button, var(--text-inverse))',
					_hover: {
						opacity: 0.9,
						transform: 'translateY(-1px)',
						boxShadow: 'var(--shadow-md)',
					},
					_active: {
						transform: 'translateY(0)',
					},
				},
				ghost: {
					bg: 'transparent',
					color: 'var(--text-primary)',
					_hover: {
						bg: 'var(--bg-secondary)',
					},
				},
				outline: {
					borderColor: 'var(--border-primary)',
					color: 'var(--text-primary)',
					_hover: {
						bg: 'var(--bg-secondary)',
						borderColor: 'var(--accent-primary)',
					},
				},
			},
		},
		Input: {
			variants: {
				outline: {
					field: {
						bg: 'var(--bg-primary)',
						borderColor: 'var(--border-primary)',
						color: 'var(--text-primary)',
						_placeholder: {
							color: 'var(--text-tertiary)',
						},
						_focus: {
							borderColor: 'var(--border-focus)',
							boxShadow: '0 0 0 1px var(--border-focus)',
						},
					},
				},
			},
		},
		Modal: {
			baseStyle: {
				overlay: {
					bg: 'var(--bg-overlay)',
				},
				dialog: {
					bg: 'var(--bg-card)',
					boxShadow: 'var(--shadow-lg)',
					border: '1px solid var(--border-primary)',
				},
				header: {
					color: 'var(--text-primary)',
					borderBottomColor: 'var(--border-primary)',
				},
				body: {
					color: 'var(--text-primary)',
				},
				footer: {
					borderTopColor: 'var(--border-primary)',
				},
			},
		},
		Drawer: {
			baseStyle: {
				overlay: {
					bg: 'var(--bg-overlay)',
				},
				dialog: {
					bg: 'var(--bg-card)',
					boxShadow: 'var(--shadow-lg)',
				},
				header: {
					color: 'var(--text-primary)',
					borderBottomColor: 'var(--border-primary)',
				},
				body: {
					color: 'var(--text-primary)',
				},
			},
		},
		Card: {
			baseStyle: {
				container: {
					bg: 'var(--bg-card)',
					boxShadow: 'var(--shadow-sm)',
					border: '1px solid var(--border-primary)',
					_hover: {
						boxShadow: 'var(--shadow-md)',
					},
				},
			},
		},
		IconButton: {
			baseStyle: {
				borderRadius: '8px',
			},
			variants: {
				ghost: {
					color: 'var(--text-primary)',
					_hover: {
						bg: 'var(--bg-secondary)',
					},
				},
			},
		},
	},
})

export default chakraTheme
