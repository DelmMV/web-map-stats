import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Хук для виртуализации маркеров - отображает только видимые маркеры для повышения производительности
 * @param {Array} markers - массив маркеров
 * @param {Object} mapBounds - границы карты
 * @param {number} zoom - текущий уровень зума
 * @param {number} maxMarkersPerView - максимальное количество маркеров для отображения одновременно
 */
export function useMarkerVirtualization(
	markers,
	mapBounds,
	zoom,
	maxMarkersPerView = 1000
) {
	const [visibleMarkers, setVisibleMarkers] = useState([])
	const processingRef = useRef(false)

	// Функция для проверки, находится ли маркер в видимой области
	const isMarkerInBounds = useCallback(
		marker => {
			if (!mapBounds) return true
			return mapBounds.contains([marker.latitude, marker.longitude])
		},
		[mapBounds]
	)

	// Функция для вычисления приоритета маркера
	const getMarkerPriority = useCallback(
		marker => {
			// Приоритет зависит от типа маркера и расстояния до центра карты
			const typeScore = {
				charging: 10,
				chargingAuto: 9,
				workshop: 8,
				interesting: 7,
				danger: 6,
				chat: 5,
			}

			let score = typeScore[marker.markerType] || 5

			// Добавляем очки за близость к центру карты
			if (mapBounds) {
				const center = mapBounds.getCenter()
				const distance = Math.sqrt(
					Math.pow(marker.latitude - center.lat, 2) +
						Math.pow(marker.longitude - center.lng, 2)
				)
				score += Math.max(0, 10 - distance * 100) // Близкие маркеры получают больше очков
			}

			return score
		},
		[mapBounds]
	)

	// Основная функция фильтрации и приоритизации маркеров
	const processMarkers = useCallback(() => {
		if (processingRef.current) return
		processingRef.current = true

		const processMarkersCallback = () => {
			try {
				let filtered = markers

				// 1. Фильтруем по видимой области
				if (mapBounds) {
					filtered = filtered.filter(isMarkerInBounds)
				}

				// 2. На низких уровнях зума применяем дополнительную фильтрацию
				if (zoom < 10 && filtered.length > maxMarkersPerView) {
					// Сортируем по приоритету и берём только лучшие
					filtered = filtered
						.map(marker => ({
							...marker,
							priority: getMarkerPriority(marker),
						}))
						.sort((a, b) => b.priority - a.priority)
						.slice(0, maxMarkersPerView)
				}

				// 3. На очень низких уровнях зума используем сэмплирование
				if (zoom < 8 && filtered.length > 500) {
					const step = Math.ceil(filtered.length / 500)
					filtered = filtered.filter((_, index) => index % step === 0)
				}

				setVisibleMarkers(filtered)
			} finally {
				processingRef.current = false
			}
		}

		// Используем requestIdleCallback если доступен, иначе setTimeout
		if (typeof window !== 'undefined' && window.requestIdleCallback) {
			window.requestIdleCallback(processMarkersCallback, { timeout: 100 })
		} else {
			setTimeout(processMarkersCallback, 0)
		}
	}, [
		markers,
		mapBounds,
		zoom,
		maxMarkersPerView,
		isMarkerInBounds,
		getMarkerPriority,
	])

	// Дебаунсинг для предотвращения слишком частых обновлений
	const debouncedProcessMarkers = useMemo(() => {
		let timeoutId
		return () => {
			clearTimeout(timeoutId)
			timeoutId = setTimeout(processMarkers, 100)
		}
	}, [processMarkers])

	// Обновляем видимые маркеры при изменении зависимостей
	useEffect(() => {
		debouncedProcessMarkers()
	}, [debouncedProcessMarkers])

	// Статистика для отладки
	const stats = useMemo(
		() => ({
			totalMarkers: markers.length,
			visibleMarkers: visibleMarkers.length,
			reductionRatio:
				markers.length > 0
					? (visibleMarkers.length / markers.length).toFixed(2)
					: 0,
		}),
		[markers.length, visibleMarkers.length]
	)

	return {
		visibleMarkers,
		stats,
	}
}
