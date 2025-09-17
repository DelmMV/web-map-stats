import { createLayerComponent } from '@react-leaflet/core'
import L from 'leaflet'
import 'leaflet.markercluster'

// Цветовая схема для кластеров в современном стиле
const CLUSTER_COLORS = {
	small: { bg: '#4285f4', text: '#ffffff' }, // До 10 маркеров - синий
	medium: { bg: '#34a853', text: '#ffffff' }, // 10-50 маркеров - зеленый
	large: { bg: '#ea4335', text: '#ffffff' }, // 50+ маркеров - красный
	xlarge: { bg: '#9333ea', text: '#ffffff' }, // 100+ маркеров - фиолетовый
}

/**
 * Определяет размер кластера на основе количества маркеров
 * @param {number} count - Количество маркеров в кластере
 * @returns {string} Размер кластера
 */
function getClusterSize(count) {
	if (count < 5) return 'small'
	if (count < 15) return 'medium'
	if (count < 50) return 'large'
	return 'xlarge'
}

/**
 * Создает современную HTML иконку для кластера
 * @param {Object} cluster - Объект кластера Leaflet
 * @returns {L.DivIcon} Иконка кластера
 */
const createModernClusterIcon = cluster => {
	const markers = cluster.getAllChildMarkers()
	const count = markers.length
	const size = getClusterSize(count)
	const colors = CLUSTER_COLORS[size]

	// Вычисляем радиус кластера в зависимости от количества маркеров (более компактные размеры)
	const radius = Math.min(20 + Math.sqrt(count) * 1.5, 35)
	const iconSize = radius * 2

	// Группируем маркеры по типам для мини-статистики
	const markerStats = markers.reduce((stats, marker) => {
		const type = marker.options?.markerType || 'charging'
		stats[type] = (stats[type] || 0) + 1
		return stats
	}, {})

	// Создаем сегменты круговой диаграммы
	const totalMarkers = count
	const segments = []
	let currentAngle = -90 // Начинаем сверху

	Object.entries(markerStats).forEach(([type, count]) => {
		const percentage = (count / totalMarkers) * 100
		const angle = (percentage / 100) * 360

		if (percentage > 10 && totalMarkers > 5) {
			// Показываем диаграммы только для больших кластеров
			segments.push({
				type,
				count,
				startAngle: currentAngle,
				endAngle: currentAngle + angle,
				color: getTypeColor(type),
			})
		}
		currentAngle += angle
	})

	// Создаем SVG для круговой диаграммы
	const segmentPaths = segments
		.map(segment => {
			const { startAngle, endAngle, color } = segment
			const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

			const startX =
				radius + radius * 0.8 * Math.cos((startAngle * Math.PI) / 180)
			const startY =
				radius + radius * 0.8 * Math.sin((startAngle * Math.PI) / 180)
			const endX = radius + radius * 0.8 * Math.cos((endAngle * Math.PI) / 180)
			const endY = radius + radius * 0.8 * Math.sin((endAngle * Math.PI) / 180)

			return `
			<path d="M ${radius} ${radius} L ${startX} ${startY} A ${radius * 0.8} ${
				radius * 0.8
			} 0 ${largeArcFlag} 1 ${endX} ${endY} Z"
				  fill="${color}" opacity="0.8" stroke="white" stroke-width="1"/>
		`
		})
		.join('')

	const html = `
		<div class="modern-cluster" data-size="${size}" data-count="${count}">
			<div class="cluster-background" style="background: ${
				colors.bg
			}; width: ${iconSize}px; height: ${iconSize}px;">
				<svg class="cluster-segments" width="${iconSize}" height="${iconSize}" style="position: absolute; top: 0; left: 0;">
					${segments.length > 1 ? segmentPaths : ''}
				</svg>
				<div class="cluster-content" style="color: ${colors.text};">
					<div class="cluster-count">${formatCount(count)}</div>
				</div>
			</div>
			<div class="cluster-shadow"></div>
		</div>
	`

	return L.divIcon({
		html: html,
		className: 'modern-cluster-container',
		iconSize: [iconSize, iconSize],
		iconAnchor: [iconSize / 2, iconSize / 2],
	})
}

/**
 * Форматирует число для отображения в кластере
 * @param {number} count - Количество маркеров
 * @returns {string} Отформатированное число
 */
function formatCount(count) {
	if (count < 1000) return count.toString()
	if (count < 10000) return `${Math.floor(count / 100) / 10}к`
	return `${Math.floor(count / 1000)}к`
}

/**
 * Возвращает цвет для типа маркера
 * @param {string} type - Тип маркера
 * @returns {string} HEX цвет
 */
function getTypeColor(type) {
	const typeColors = {
		charging: '#34D399',
		charging24: '#10B981',
		chargingAuto: '#06B6D4',
		interesting: '#F59E0B',
		danger: '#EF4444',
		chat: '#8B5CF6',
		workshop: '#6B7280',
	}
	return typeColors[type] || '#4285f4'
}

/**
 * Создает компонент MarkerClusterGroup с современным дизайном
 */
const createModernMarkerClusterGroup = (props, context) => {
	const defaultOptions = {
		// Настройки кластеризации
		maxClusterRadius: 50,
		spiderfyOnMaxZoom: true,
		showCoverageOnHover: false,
		zoomToBoundsOnClick: true,
		disableClusteringAtZoom: 16,
		chunkedLoading: true,
		chunkProgress: () => {}, // Отключаем прогресс-бар

		// Анимации
		animateAddingMarkers: true,
		spiderfyDistanceMultiplier: 1.5,

		// Настройки производительности
		removeOutsideVisibleBounds: true,

		// Кастомная функция создания иконки
		iconCreateFunction: createModernClusterIcon,

		// Настройки spiderfy
		spiderfyShapePositions: function (count, centerPt) {
			const distanceFromCenter = 35
			const markerDistance = 45
			const lineLength = (markerDistance * (count - 1)) / 2
			const lineStart = centerPt.y - lineLength

			const res = []
			for (let i = 0; i < count; i++) {
				res.push(
					new L.Point(
						centerPt.x + distanceFromCenter,
						lineStart + markerDistance * i
					)
				)
			}
			return res
		},
	}

	// Объединяем дефолтные настройки с пользовательскими
	const options = { ...defaultOptions, ...props }

	const cluster = L.markerClusterGroup(options)

	// Добавляем обработчики событий для анимаций
	cluster.on('clusterclick', function (e) {
		const clusterElement = e.layer._icon
		if (clusterElement) {
			clusterElement.classList.add('cluster-clicked')
			setTimeout(() => {
				clusterElement.classList.remove('cluster-clicked')
			}, 300)
		}
	})

	cluster.on('clustermouseover', function (e) {
		const clusterElement = e.layer._icon
		if (clusterElement) {
			clusterElement.classList.add('cluster-hovered')
		}
	})

	cluster.on('clustermouseout', function (e) {
		const clusterElement = e.layer._icon
		if (clusterElement) {
			clusterElement.classList.remove('cluster-hovered')
		}
	})

	return {
		instance: cluster,
		context: { ...context, layerContainer: cluster },
	}
}

const ModernMarkerClusterGroup = createLayerComponent(
	createModernMarkerClusterGroup
)

export default ModernMarkerClusterGroup
