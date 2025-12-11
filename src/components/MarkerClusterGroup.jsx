import { createLayerComponent } from '@react-leaflet/core'
import L from 'leaflet'
import 'leaflet.markercluster'
import createPieChart from './ClusterPieChart'

// Функция для создания кастомной иконки кластера с круговой диаграммой
const createClusterCustomIcon = cluster => {
	const markers = cluster.getAllChildMarkers()
	const count = markers.length
	const strokeWidth = 0.3 // Уменьшаем толщину ободка с 0.5 до 0.3
	const rMax = 22 // Уменьшаем максимальный радиус для кластера с 30 до 22

	// Вычисляем радиус в зависимости от количества маркеров
	const r =
		rMax -
		2 * strokeWidth -
		(count < 10 ? 8 : count < 100 ? 6 : count < 1000 ? 3 : 0)
	const iconDim = (r + strokeWidth) * 2

	// Группируем маркеры по типу
	const markerTypes = {
		charging: 0,
		chargingAuto: 0,
		interesting: 0,
		danger: 0,
		chat: 0,
		workshop: 0,
	}

	// Подсчитываем количество маркеров каждого типа
	markers.forEach(marker => {
		// Проверяем, что marker и marker.options существуют
		if (!marker || !marker.options) {
			console.warn('Marker or marker.options undefined', marker)
			return
		}

		const markerType = marker.options.markerType || 'charging'
if (Object.hasOwn(markerTypes, markerType)) {
			markerTypes[markerType]++
		} else {
			markerTypes.charging++
		}
	})

	// Формируем данные для диаграммы
	const pieData = Object.entries(markerTypes)
		.filter(([_, value]) => value > 0)
		.map(([key, value]) => ({ key, value }))

	// Проверка, есть ли данные для диаграммы
	if (pieData.length === 0) {
		console.warn('No data for pie chart in cluster with', count, 'markers')
		// Используем запасной вариант, если нет данных
		pieData.push({ key: 'charging', value: count })
	}

	// Особая обработка случая с маркерами только одного типа
	if (pieData.length === 1) {
		const markerType = pieData[0].key
		const color = getColorForMarkerType(markerType)

		// Создаем простую иконку с цветом соответствующего типа
		return new L.DivIcon({
			html: `<div style="background-color: ${color}; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border-radius: 50%; border: 0.3px solid #333;">${count}</div>`,
			className: `marker-cluster marker-cluster-single marker-cluster-${markerType}`,
			iconSize: new L.Point(iconDim, iconDim),
		})
	}

	// Генерируем SVG разметку для круговой диаграммы
	let html = ''
	try {
		html = createPieChart({
			data: pieData,
			outerRadius: r,
			innerRadius: r - 7,
			strokeWidth: strokeWidth,
			pieLabel: count.toString(),
			pieLabelClass: 'marker-cluster-pie-label',
			pathClassFunc: item => `marker-type-${item.key}`,
			pathTitleFunc: item => `${item.key}: ${item.value}`,
		})
	} catch (error) {
		console.error('Error creating pie chart:', error)
		// Создаем запасной вариант иконки при ошибке
		return new L.DivIcon({
			html: `<div style="background-color: rgba(66, 153, 225, 0.8); width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border-radius: 50%;">${count}</div>`,
			className: 'marker-cluster-fallback',
			iconSize: new L.Point(iconDim, iconDim),
		})
	}

	// Если по какой-то причине html пустой, используем запасной вариант
	if (!html) {
		console.warn('Empty HTML for pie chart with data:', pieData)
		return new L.DivIcon({
			html: `<div style="background-color: rgba(66, 153, 225, 0.8); width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border-radius: 50%;">${count}</div>`,
			className: 'marker-cluster-fallback',
			iconSize: new L.Point(iconDim, iconDim),
		})
	}

	// Создаем divIcon с нашей диаграммой
	return new L.DivIcon({
		html: html,
		className: 'marker-cluster',
		iconSize: new L.Point(iconDim, iconDim),
	})
}

// Функция для получения цвета по типу маркера
function getColorForMarkerType(markerType) {
	switch (markerType) {
		case 'charging':
			return '#4299e1' // blue
		case 'chargingAuto':
			return '#48bb78' // green
		case 'interesting':
			return '#ed8936' // orange
		case 'danger':
			return '#e53e3e' // red
		case 'chat':
			return '#805ad5' // purple
		case 'workshop':
			return '#718096' // gray
		default:
			return '#4299e1' // blue as default
	}
}

const createMarkerClusterGroup = (props, context) => {
	// Объединяем пользовательские настройки с нашей кастомной функцией создания иконки
	const options = {
		...props,
		iconCreateFunction: props.iconCreateFunction || createClusterCustomIcon,
	}

	const cluster = L.markerClusterGroup(options)

	return {
		instance: cluster,
		context: { ...context, layerContainer: cluster },
	}
}

const MarkerClusterGroup = createLayerComponent(createMarkerClusterGroup)

export default MarkerClusterGroup
