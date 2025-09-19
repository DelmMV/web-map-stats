import { Box, Text } from '@chakra-ui/react'
import React from 'react'

/**
 * Компонент для отображения статистики производительности карты
 */
const PerformanceStats = ({
	totalMarkers,
	visibleMarkers,
	currentZoom,
	shouldUseClustering,
	isVisible = false,
}) => {
	if (!isVisible) return null

	const reductionRatio =
		totalMarkers > 0 ? ((visibleMarkers / totalMarkers) * 100).toFixed(1) : 0
	const memoryUsage = window.performance?.memory
		? `${(window.performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`
		: 'N/A'

	// Определяем уровень производительности
	const getPerformanceLevel = () => {
		if (visibleMarkers < 100) return { emoji: '🟢', text: 'Отлично' }
		if (visibleMarkers < 300) return { emoji: '🟡', text: 'Хорошо' }
		if (visibleMarkers < 500) return { emoji: '🟠', text: 'Средне' }
		return { emoji: '🔴', text: 'Нагрузка' }
	}

	const perfLevel = getPerformanceLevel()

	return (
		<Box
			position='absolute'
			top='10px'
			right='10px'
			backgroundColor='rgba(0, 0, 0, 0.85)'
			color='white'
			padding='10px'
			borderRadius='6px'
			fontSize='11px'
			fontFamily='monospace'
			zIndex={1000}
			minWidth='220px'
			boxShadow='0 2px 8px rgba(0,0,0,0.3)'
		>
			<Text fontWeight='bold' mb='4px'>
				⚡ Производительность карты
			</Text>
			<Text>🗺️ Зум: {currentZoom}</Text>
			<Text>📍 Маркеров: {totalMarkers}</Text>
			<Text>👁️ Видимых: {visibleMarkers}</Text>
			<Text>📊 Показано: {reductionRatio}%</Text>
			<Text>🔗 Кластеры: {shouldUseClustering ? '✅' : '❌'}</Text>
			<Text>
				{perfLevel.emoji} Статус: {perfLevel.text}
			</Text>
			{window.performance?.memory && <Text>💾 Память: {memoryUsage}</Text>}
		</Box>
	)
}

export default PerformanceStats
