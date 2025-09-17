import L from 'leaflet'

/**
 * Создает современную иконку маркера в стиле Google Maps/Яндекс Карт
 * @param {Object} options - Опции для создания иконки
 * @param {string} options.type - Тип маркера (charging, danger, etc.)
 * @param {string} options.color - Основной цвет маркера
 * @param {string} options.iconPath - SVG path для иконки внутри маркера
 * @param {boolean} options.isPulsing - Добавить пульсирующую анимацию
 * @param {number[]} options.size - Размер маркера [width, height]
 * @returns {L.DivIcon} Leaflet DivIcon
 */
const createModernMarkerIcon = ({
	type = 'default',
	color = '#4285f4',
	iconPath = '',
	isPulsing = false,
	size = [24, 30],
	className = '',
}) => {
	const uniqueId = `marker-${type}-${Math.random().toString(36).substr(2, 9)}`

	const markerHtml = `
		<div class="modern-marker ${className} ${
		isPulsing ? 'pulsing' : ''
	}" data-type="${type}">
			<div class="marker-pin" style="background: linear-gradient(135deg, ${color} 0%, ${adjustColor(
		color,
		-20
	)} 100%);">
				<div class="marker-icon">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
						${iconPath}
					</svg>
				</div>
			</div>
			<div class="marker-shadow"></div>
			${isPulsing ? '<div class="marker-pulse"></div>' : ''}
		</div>
	`

	return L.divIcon({
		html: markerHtml,
		className: `modern-marker-container ${uniqueId}`,
		iconSize: size,
		iconAnchor: [size[0] / 2, size[1]],
		popupAnchor: [0, -size[1] + 8],
	})
}

/**
 * Затемняет или осветляет цвет на указанную величину
 * @param {string} color - HEX цвет
 * @param {number} amount - Величина изменения (-100 до 100)
 * @returns {string} Измененный HEX цвет
 */
function adjustColor(color, amount) {
	const usePound = color.startsWith('#')
	color = color.slice(usePound ? 1 : 0)

	const num = parseInt(color, 16)
	let r = (num >> 16) + amount
	let g = ((num >> 8) & 0x00ff) + amount
	let b = (num & 0x0000ff) + amount

	r = r > 255 ? 255 : r < 0 ? 0 : r
	g = g > 255 ? 255 : g < 0 ? 0 : g
	b = b > 255 ? 255 : b < 0 ? 0 : b

	return (
		(usePound ? '#' : '') +
		((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
	)
}

// Предустановленные иконки для разных типов маркеров
export const MARKER_ICONS = {
	charging: {
		iconPath: `<path d="M12 2L10.14 9H15L9 22L10.86 15H6L12 2Z" fill="white" stroke="none"/>`,
		color: '#34D399', // Зеленый для зарядки
	},
	charging24: {
		iconPath: `
			<path d="M12 2L10.14 9H15L9 22L10.86 15H6L12 2Z" fill="white" stroke="none"/>
			<circle cx="18" cy="6" r="3" fill="#FFD700" stroke="white" stroke-width="1"/>
		`,
		color: '#10B981', // Более темный зеленый для 24/7
		isPulsing: true,
	},
	chargingAuto: {
		iconPath: `
			<path d="M18.5 3H5.5C4.12 3 3 4.12 3 5.5V18.5C3 19.88 4.12 21 5.5 21H18.5C19.88 21 21 19.88 21 18.5V5.5C21 4.12 19.88 3 18.5 3ZM19 18.5C19 18.77 18.77 19 18.5 19H5.5C5.23 19 5 18.77 5 18.5V5.5C5 5.23 5.23 5 5.5 5H18.5C18.77 5 19 5.23 19 5.5V18.5Z" fill="white"/>
			<path d="M12 7L10.5 12H13.5L12 17L13.5 12H10.5L12 7Z" fill="white"/>
		`,
		color: '#06B6D4', // Голубой для авто зарядки
	},
	interesting: {
		iconPath: `
			<path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="white" stroke="none"/>
			<circle cx="12" cy="12" r="2" fill="white"/>
		`,
		color: '#F59E0B', // Оранжевый для интересных мест
	},
	danger: {
		iconPath: `
			<path d="M12 2L21.5 20H2.5L12 2Z" fill="white" stroke="none"/>
			<circle cx="12" cy="16" r="1.5" fill="#EF4444"/>
			<rect x="11" y="8" width="2" height="6" rx="1" fill="#EF4444"/>
		`,
		color: '#EF4444', // Красный для опасности
	},
	chat: {
		iconPath: `
			<path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM8 14H6V12H8V14ZM10 14H8V12H10V14ZM14 14H12V12H14V14ZM16 14H14V12H16V14Z" fill="white"/>
		`,
		color: '#8B5CF6', // Фиолетовый для чата
	},
	workshop: {
		iconPath: `
			<path d="M22.7 19L13.6 9.9C14.5 7.6 14 4.9 12.1 3C10.1 1 7.1 0.6 4.7 1.7L9 6L6 9L1.6 4.7C0.4 7.1 0.9 10.1 2.9 12.1C4.8 14 7.5 14.5 9.8 13.6L18.9 22.7C19.3 23.1 19.9 23.1 20.3 22.7L22.6 20.4C23.1 20 23.1 19.3 22.7 19Z" fill="white"/>
		`,
		color: '#6B7280', // Серый для мастерских
	},
}

// Экспортируемые функции для создания конкретных типов маркеров
export const createChargingMarker = (options = {}) =>
	createModernMarkerIcon({
		...MARKER_ICONS.charging,
		...options,
		type: 'charging',
	})

export const createCharging24Marker = (options = {}) =>
	createModernMarkerIcon({
		...MARKER_ICONS.charging24,
		...options,
		type: 'charging24',
	})

export const createChargingAutoMarker = (options = {}) =>
	createModernMarkerIcon({
		...MARKER_ICONS.chargingAuto,
		...options,
		type: 'chargingAuto',
	})

export const createInterestingMarker = (options = {}) =>
	createModernMarkerIcon({
		...MARKER_ICONS.interesting,
		...options,
		type: 'interesting',
	})

export const createDangerMarker = (options = {}) =>
	createModernMarkerIcon({ ...MARKER_ICONS.danger, ...options, type: 'danger' })

export const createChatMarker = (options = {}) =>
	createModernMarkerIcon({ ...MARKER_ICONS.chat, ...options, type: 'chat' })

export const createWorkshopMarker = (options = {}) =>
	createModernMarkerIcon({
		...MARKER_ICONS.workshop,
		...options,
		type: 'workshop',
	})

// Создание пользовательского маркера
export const createUserMarker = (options = {}) =>
	createModernMarkerIcon({
		iconPath: `<circle cx="12" cy="12" r="8" fill="white" stroke="#4285f4" stroke-width="2"/>`,
		color: '#4285f4',
		size: [20, 20],
		className: 'user-marker',
		isPulsing: true,
		...options,
		type: 'user',
	})

// Создание иконок для маршрутов
export const createRouteStartMarker = (color = '#4285f4', options = {}) =>
	createModernMarkerIcon({
		iconPath: `<polygon points="12,2 22,22 12,18 2,22" fill="white" stroke="none"/>`,
		color: color,
		size: [24, 30],
		className: 'route-start-marker',
		...options,
		type: 'route-start',
	})

export const createRouteEndMarker = (color = '#EA4335', options = {}) =>
	createModernMarkerIcon({
		iconPath: `<rect x="6" y="6" width="12" height="12" fill="white" stroke="none"/>`,
		color: color,
		size: [24, 30],
		className: 'route-end-marker',
		...options,
		type: 'route-end',
	})

export default createModernMarkerIcon
