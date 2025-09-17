import L from 'leaflet'
import React, { useEffect, useMemo, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import {
	getCurrentWeather,
	getWeatherIconUrl,
} from '../services/weatherService'

/**
 * Компонент слоя погоды для отображения погодных маркеров на карте
 * @param {Object} props - Пропсы компонента
 * @param {Array} props.locations - Массив локаций с координатами для отображения погоды
 * @param {boolean} props.isVisible - Видимость слоя
 * @param {Object} props.mapBounds - Границы карты для оптимизации загрузки
 */
const WeatherLayer = ({
	locations = [],
	isVisible = true,
	mapBounds = null,
}) => {
	const [weatherData, setWeatherData] = useState(new Map())
	const [loading, setLoading] = useState(false)

	// Создаем кастомную иконку для погодного маркера (компактная версия)
	const createWeatherIcon = weatherInfo => {
		if (!weatherInfo) return null

		return L.divIcon({
			className: 'weather-marker',
			html: `
				<div style="
					display: flex; 
					flex-direction: column; 
					align-items: center;
					background: rgba(255, 255, 255, 0.95);
					border-radius: 6px;
					padding: 3px;
					box-shadow: 0 1px 6px rgba(0,0,0,0.15);
					border: 1px solid rgba(0,0,0,0.1);
					min-width: 45px;
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				">
					<img 
						src="${getWeatherIconUrl(weatherInfo.icon, 'small')}" 
						style="width: 24px; height: 24px; margin: 0;"
						alt="${weatherInfo.description}"
					/>
					<div style="
						font-size: 10px; 
						font-weight: 600; 
						color: #2d3748;
						text-align: center;
						margin-top: 1px;
						line-height: 1;
					">
						${weatherInfo.temperature}°
					</div>
				</div>
			`,
			iconSize: [45, 45],
			iconAnchor: [22, 22],
		})
	}

	// Получаем данные о погоде для заданных локаций
	const fetchWeatherForLocations = async () => {
		if (!locations.length || !isVisible) return

		setLoading(true)
		const newWeatherData = new Map()

		try {
			// Загружаем погоду для каждой локации параллельно
			const weatherPromises = locations.map(async location => {
				try {
					const weather = await getCurrentWeather(location.lat, location.lon)
					return {
						id: location.id || `${location.lat}-${location.lon}`,
						weather,
						location,
					}
				} catch (error) {
					console.error(
						`Error fetching weather for ${location.lat}, ${location.lon}:`,
						error
					)
					return null
				}
			})

			const results = await Promise.all(weatherPromises)

			results.forEach(result => {
				if (result) {
					newWeatherData.set(result.id, result)
				}
			})

			setWeatherData(newWeatherData)
		} catch (error) {
			console.error('Error fetching weather data:', error)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (isVisible && locations.length > 0) {
			fetchWeatherForLocations()
		}
	}, [locations, isVisible])

	// Автообновление данных каждые 15 минут
	useEffect(() => {
		if (!isVisible || !locations.length) return

		const interval = setInterval(() => {
			fetchWeatherForLocations()
		}, 15 * 60 * 1000) // 15 минут

		return () => clearInterval(interval)
	}, [locations, isVisible])

	// Фильтруем маркеры, которые видны в текущих границах карты
	const visibleWeatherMarkers = useMemo(() => {
		const markers = []

		weatherData.forEach(data => {
			const { location, weather } = data

			// Проверяем, находится ли маркер в границах карты
			if (mapBounds) {
				const latLng = L.latLng(location.lat, location.lon)
				if (!mapBounds.contains(latLng)) {
					return
				}
			}

			markers.push({
				...data,
				icon: createWeatherIcon(weather),
			})
		})

		return markers
	}, [weatherData, mapBounds])

	if (!isVisible) return null

	return (
		<>
			{visibleWeatherMarkers.map(marker => (
				<Marker
					key={marker.id}
					position={[marker.location.lat, marker.location.lon]}
					icon={marker.icon}
				>
					<Popup>
						<div style={{ textAlign: 'center', minWidth: '180px' }}>
							<div
								style={{
									fontSize: '14px',
									fontWeight: 'bold',
									color: '#2d3748',
									marginBottom: '8px',
									borderBottom: '1px solid #e2e8f0',
									paddingBottom: '4px',
								}}
							>
								{marker.location.name}
							</div>

							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									marginBottom: '8px',
								}}
							>
								<img
									src={getWeatherIconUrl(marker.weather.icon, 'medium')}
									alt={marker.weather.description}
									style={{ width: '40px', height: '40px', marginRight: '8px' }}
								/>
								<div>
									<div
										style={{
											fontSize: '20px',
											fontWeight: 'bold',
											color: '#2d3748',
										}}
									>
										{marker.weather.temperature}°C
									</div>
									<div
										style={{
											fontSize: '11px',
											color: '#718096',
											textTransform: 'capitalize',
										}}
									>
										{marker.weather.description}
									</div>
								</div>
							</div>

							<div
								style={{
									fontSize: '11px',
									color: '#4a5568',
									lineHeight: '1.4',
								}}
							>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										marginBottom: '2px',
									}}
								>
									<span>Ощущается:</span>
									<span style={{ fontWeight: '500' }}>
										{marker.weather.feelsLike}°C
									</span>
								</div>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										marginBottom: '2px',
									}}
								>
									<span>Влажность:</span>
									<span style={{ fontWeight: '500' }}>
										{marker.weather.humidity}%
									</span>
								</div>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										marginBottom: '2px',
									}}
								>
									<span>Ветер:</span>
									<span style={{ fontWeight: '500' }}>
										{marker.weather.windSpeed} км/ч
									</span>
								</div>
								<div
									style={{ display: 'flex', justifyContent: 'space-between' }}
								>
									<span>Давление:</span>
									<span style={{ fontWeight: '500' }}>
										{Math.round(marker.weather.pressure)} гПа
									</span>
								</div>
								{marker.weather.precipitation > 0 && (
									<div
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											marginTop: '2px',
											color: '#3182ce',
										}}
									>
										<span>Осадки:</span>
										<span style={{ fontWeight: '500' }}>
											{marker.weather.precipitation} мм
										</span>
									</div>
								)}
							</div>
						</div>
					</Popup>
				</Marker>
			))}
		</>
	)
}

export default React.memo(WeatherLayer)
