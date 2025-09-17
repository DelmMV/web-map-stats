import {
	Alert,
	AlertIcon,
	Box,
	HStack,
	Image,
	Spinner,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import {
	getCurrentWeather,
	getWeatherIconUrl,
} from '../services/weatherService'

/**
 * Компонент виджета погоды для отображения на карте
 * @param {Object} props - Пропсы компонента
 * @param {number} props.lat - Широта для получения погоды
 * @param {number} props.lon - Долгота для получения погоды
 * @param {boolean} props.isVisible - Видимость виджета
 * @param {string} props.position - Позиция виджета ('top-right', 'top-left', 'bottom-right', 'bottom-left')
 */
const WeatherWidget = ({
	lat,
	lon,
	isVisible = true,
	position = 'top-right',
}) => {
	const [weather, setWeather] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)

	const fetchWeatherData = async () => {
		if (!lat || !lon) return

		setLoading(true)
		setError(null)

		try {
			const weatherData = await getCurrentWeather(lat, lon)
			setWeather(weatherData)
		} catch (err) {
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (isVisible && lat && lon) {
			fetchWeatherData()
		}
	}, [lat, lon, isVisible])

	// Обновление данных каждые 10 минут
	useEffect(() => {
		if (!isVisible || !lat || !lon) return

		const interval = setInterval(() => {
			fetchWeatherData()
		}, 10 * 60 * 1000) // 10 минут

		return () => clearInterval(interval)
	}, [lat, lon, isVisible])

	if (!isVisible) return null

	const getPositionStyles = () => {
		const baseStyles = {
			position: 'absolute',
			zIndex: 1000,
			margin: '10px',
		}

		switch (position) {
			case 'top-left':
				return { ...baseStyles, top: '60px', left: '0' }
			case 'top-right':
				return { ...baseStyles, top: '60px', right: '0' }
			case 'bottom-left':
				return { ...baseStyles, bottom: '60px', left: '0' }
			case 'bottom-right':
				return { ...baseStyles, bottom: '60px', right: '0' }
			default:
				return { ...baseStyles, top: '60px', right: '0' }
		}
	}

	return (
		<Box
			{...getPositionStyles()}
			bg='rgba(255, 255, 255, 0.95)'
			backdropFilter='blur(10px)'
			borderRadius='12px'
			padding='12px'
			boxShadow='0 4px 12px rgba(0, 0, 0, 0.15)'
			border='1px solid rgba(255, 255, 255, 0.2)'
			minWidth='180px'
			maxWidth='220px'
		>
			{loading && (
				<VStack spacing={2} align='center'>
					<Spinner size='sm' color='blue.500' />
					<Text fontSize='sm' color='gray.600'>
						Загрузка погоды...
					</Text>
				</VStack>
			)}

			{error && (
				<Alert status='error' size='sm' borderRadius='md'>
					<AlertIcon />
					<Text fontSize='xs'>{error}</Text>
				</Alert>
			)}

			{weather && !loading && !error && (
				<VStack spacing={2} align='stretch'>
					<HStack justify='space-between' align='center'>
						<VStack spacing={0} align='start'>
							<Text fontSize='lg' fontWeight='bold' color='gray.800'>
								{weather.temperature}°C
							</Text>
							<Text fontSize='xs' color='gray.600' textTransform='capitalize'>
								{weather.description}
							</Text>
						</VStack>
						<Image
							src={getWeatherIconUrl(weather.icon, 'small')}
							alt={weather.description}
							width='40px'
							height='40px'
						/>
					</HStack>

					<VStack spacing={1} align='stretch' fontSize='xs' color='gray.600'>
						<HStack justify='space-between'>
							<Text>Ощущается:</Text>
							<Text fontWeight='medium'>{weather.feelsLike}°C</Text>
						</HStack>
						<HStack justify='space-between'>
							<Text>Влажность:</Text>
							<Text fontWeight='medium'>{weather.humidity}%</Text>
						</HStack>
						<HStack justify='space-between'>
							<Text>Ветер:</Text>
							<Text fontWeight='medium'>{weather.windSpeed} м/с</Text>
						</HStack>
						<HStack justify='space-between'>
							<Text>Давление:</Text>
							<Text fontWeight='medium'>
								{Math.round(weather.pressure * 0.75)} мм рт.ст.
							</Text>
						</HStack>
					</VStack>

					{weather.city && (
						<Text
							fontSize='xs'
							color='gray.500'
							textAlign='center'
							borderTop='1px solid'
							borderColor='gray.200'
							pt={2}
						>
							{weather.city}
						</Text>
					)}
				</VStack>
			)}
		</Box>
	)
}

export default WeatherWidget
