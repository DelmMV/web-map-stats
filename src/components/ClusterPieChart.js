/**
 * Функция для создания SVG разметки круговой диаграммы для кластеров маркеров
 */

// Вспомогательная функция для сериализации DOM-узла в строку
const serializeXmlNode = xmlNode => {
	if (!xmlNode) return ''

	try {
		if (typeof window.XMLSerializer !== 'undefined') {
			return new window.XMLSerializer().serializeToString(xmlNode)
		} else if (typeof xmlNode.xml !== 'undefined') {
			return xmlNode.xml
		}
	} catch (error) {
		console.error('Error serializing XML node:', error)
	}
	return ''
}

/**
 * Генерирует SVG разметку для круговой диаграммы
 * @param {Object} options - Настройки для отображения диаграммы
 * @param {Array} options.data - Массив данных для диаграммы (должен содержать поля key и value)
 * @param {Number} options.outerRadius - Внешний радиус диаграммы
 * @param {Number} options.innerRadius - Внутренний радиус диаграммы
 * @param {Number} options.strokeWidth - Ширина обводки секторов
 * @param {Function} options.pathClassFunc - Функция, возвращающая класс для сектора
 * @param {Function} options.pathTitleFunc - Функция, возвращающая заголовок для сектора
 * @param {String} options.pieLabel - Текст в центре диаграммы
 * @param {String} options.total - Общее количество, которое будет отображаться в центре
 * @returns {String} SVG разметка диаграммы
 */
export const createPieChart = options => {
	// Проверка входных данных
	if (
		!options ||
		!options.data ||
		!Array.isArray(options.data) ||
		options.data.length === 0
	) {
		console.warn('Invalid options or empty data for pie chart', options)
		return ''
	}

	try {
		const {
			data = [],
			outerRadius = 40,
			innerRadius = 0,
			strokeWidth = 0.3,
			pathClassFunc = () => '',
			pathTitleFunc = () => '',
			pieLabel = '',
			total = '',
		} = options

		const r = outerRadius
		const rInner = innerRadius || r - 10
		const pieLabelClass = options.pieLabelClass || 'marker-cluster-pie-label'

		const origo = r + strokeWidth
		const w = origo * 2
		const h = w

		// Создаем SVG элемент
		const svgNS = 'http://www.w3.org/2000/svg'
		const svg = document.createElementNS(svgNS, 'svg')
		svg.setAttribute('width', w)
		svg.setAttribute('height', h)
		svg.setAttribute('class', 'marker-cluster-pie')

		// Создаем группу для центрирования диаграммы
		const g = document.createElementNS(svgNS, 'g')
		g.setAttribute('transform', `translate(${origo}, ${origo})`)
		svg.appendChild(g)

		// Расчет углов для секторов
		let totalData = data.reduce((sum, item) => sum + (item.value || 0), 0)

		// Проверка на случай, если все значения нулевые
		if (totalData <= 0) {
			console.warn('Total data value is zero or negative:', totalData)
			totalData = 1 // предотвращаем деление на ноль
		}

		let startAngle = 0

		// Создаем секторы для каждого элемента данных
		data.forEach(item => {
			// Пропускаем элементы с нулевым или отрицательным значением
			if (!item.value || item.value <= 0) return

			try {
				const percentage = item.value / totalData
				const endAngle = startAngle + percentage * 2 * Math.PI

				// Создаем SVG-путь для сектора
				const path = document.createElementNS(svgNS, 'path')

				// Рассчитываем координаты для пути
				const x1 = Math.sin(startAngle) * rInner
				const y1 = -Math.cos(startAngle) * rInner

				const x2 = Math.sin(startAngle) * r
				const y2 = -Math.cos(startAngle) * r

				const x3 = Math.sin(endAngle) * r
				const y3 = -Math.cos(endAngle) * r

				const x4 = Math.sin(endAngle) * rInner
				const y4 = -Math.cos(endAngle) * rInner

				// Определяем большую дугу (1 если > 180 градусов)
				const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

				// Создаем SVG-путь
				const d = [
					`M ${x1},${y1}`,
					`L ${x2},${y2}`,
					`A ${r},${r} 0 ${largeArc} 1 ${x3},${y3}`,
					`L ${x4},${y4}`,
					`A ${rInner},${rInner} 0 ${largeArc} 0 ${x1},${y1}`,
					'Z',
				].join(' ')

				path.setAttribute('d', d)
				path.setAttribute(
					'class',
					pathClassFunc(item) || 'marker-type-charging'
				)
				path.setAttribute('stroke-width', strokeWidth)
				path.setAttribute('fill-opacity', '0.8')

				// Добавляем заголовок с информацией
				const title = document.createElementNS(svgNS, 'title')
				title.textContent =
					pathTitleFunc(item) || `${item.key || 'unknown'}: ${item.value}`
				path.appendChild(title)

				g.appendChild(path)

				startAngle = endAngle
			} catch (error) {
				console.error('Error creating pie sector:', error, item)
			}
		})

		// Добавляем текст с количеством маркеров в центре
		if (pieLabel) {
			try {
				// Добавляем белый круг за текстом
				const background = document.createElementNS(svgNS, 'circle')
				background.setAttribute('cx', 0)
				background.setAttribute('cy', 0)
				background.setAttribute('r', rInner * 0.85)
				background.setAttribute('fill', 'white')
				g.appendChild(background)

				const text = document.createElementNS(svgNS, 'text')
				text.setAttribute('x', 0)
				text.setAttribute('y', 0)
				text.setAttribute('class', pieLabelClass)
				text.setAttribute('text-anchor', 'middle')
				text.setAttribute('dominant-baseline', 'central')
				text.textContent = pieLabel
				g.appendChild(text)
			} catch (error) {
				console.error('Error creating pie label:', error)
			}
		}

		// Возвращаем SVG-разметку в виде строки
		return serializeXmlNode(svg)
	} catch (error) {
		console.error('Error in createPieChart:', error)
		return ''
	}
}

export default createPieChart
