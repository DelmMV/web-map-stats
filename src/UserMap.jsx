import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Button, FormControl, FormLabel, Input, Text, VStack, HStack } from '@chakra-ui/react';

function UserMap({ userId }) {
	const today = new Date().toISOString().split('T')[0];
	
	const [routes, setRoutes] = useState([]);
	const [dateRange, setDateRange] = useState({ start: today, end: today });
	const [status, setStatus] = useState({ loading: false, error: null });
	
	const fetchRoute = useCallback(async () => {
		const { start, end } = dateRange;
		const url = new URL(`https://monopiter.ru/api/route/${userId}`);
		
		if (start && end) {
			url.searchParams.append('startDate', start);
			url.searchParams.append('endDate', end);
		}
		
		setStatus({ loading: true, error: null });
		
		try {
			const response = await fetch(url);
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Некорректные данные');
			}
			const data = await response.json();
			if (data.length === 0) {
				setStatus({ loading: false, error: 'Маршрут не найден для указанного периода' });
			} else {
				// Group routes by session
				const groupedRoutes = data.reduce((acc, point) => {
					const sessionId = point.sessionId; // Assuming each point has a sessionId
					if (!acc[sessionId]) {
						acc[sessionId] = [];
					}
					acc[sessionId].push(point);
					return acc;
				}, {});
				setRoutes(groupedRoutes);
				setStatus({ loading: false, error: null });
			}
		} catch (error) {
			console.error('Error fetching route:', error);
			setStatus({ loading: false, error: error.message });
		}
	}, [userId, dateRange]);
	
	useEffect(() => {
		if (dateRange.start && dateRange.end) {
			fetchRoute();
		}
	}, [fetchRoute]);
	
	const handleDateChange = (e) => {
		const { name, value } = e.target;
		setDateRange(prev => ({ ...prev, [name]: value }));
	};
	
	const handleSearch = (e) => {
		e.preventDefault();
		if (new Date(dateRange.start) > new Date(dateRange.end)) {
			setStatus({ loading: false, error: 'Дата начала должна быть раньше или равна дате окончания' });
			return;
		}
		fetchRoute();
	};
	
	const sessionColors = useMemo(() => {
		// Generate different colors for each session
		const colors = Object.keys(routes).map((_, idx) => {
			const hue = (idx * 60) % 360; // Generate different hues
			const saturation = 100; // Full saturation
			const lightness = 30; // Lower lightness for darker colors
			return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
		});		return colors;
	}, [routes]);
	
	return (
			<Box display="flex" flexDirection="column" height="91.5vh" p={0} m={0}>
				<VStack as="form" onSubmit={handleSearch} spacing={2} align="center" width={{ base: '100%', md: '400px' }} p={1}>
					<HStack spacing={2} width="100%">
						<FormControl isRequired>
							<FormLabel>Начальная дата</FormLabel>
							<Input
									type="date"
									name="start"
									value={dateRange.start}
									onChange={handleDateChange}
							/>
						</FormControl>
						<FormControl isRequired>
							<FormLabel>Конечная дата</FormLabel>
							<Input
									type="date"
									name="end"
									value={dateRange.end}
									onChange={handleDateChange}
							/>
						</FormControl>
					</HStack>
					<Button type="submit" colorScheme="blue" isLoading={status.loading} width="100%">
						{status.loading ? 'Загрузка...' : 'Поиск'}
					</Button>
				</VStack>
				
				{status.error && <Text color="red.500" paddingLeft={1}>{status.error}</Text>}
				
				{!status.error && Object.keys(routes).length === 0 && !status.loading && (
						<Text>Выберите даты и нажмите "Поиск" для отображения маршрута</Text>
				)}
				
				<Box flex="1" p={0} m={0}>
					<MapContainer
							center={[59.938676, 30.314487]} // Default center
							zoom={10}
							attributionControl={false}
							style={{ height: '100%', width: '100%' }}
					>
						<TileLayer
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
								attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
						/>
						{Object.keys(routes).map((sessionId, idx) => {
							const sessionRoute = routes[sessionId];
							const sessionPositions = sessionRoute.map(point => [point.latitude, point.longitude]);
							
							return (
									<React.Fragment key={sessionId}>
										<Polyline positions={sessionPositions} color={sessionColors[idx]} weight={3} />
										
										{/* Start marker for the session */}
										<CircleMarker
												center={sessionPositions[0]}
												radius={5}
												fillColor="blue"
												color="darkblue"
												weight={3}
												opacity={1}
												fillOpacity={1}
										>
											<Popup>{`Начало трека (Сессия ${sessionId}): ${new Date(sessionRoute[0].timestamp * 1000).toLocaleString()}`}</Popup>
										</CircleMarker>
										
										{/* End marker for the session */}
										<CircleMarker
												center={sessionPositions[sessionPositions.length - 1]}
												radius={5}
												fillColor="red"
												color="darkred"
												weight={3}
												opacity={1}
												fillOpacity={1}
										>
											<Popup>{`Конец трека (Сессия ${sessionId}): ${new Date(sessionRoute[sessionRoute.length - 1].timestamp * 1000).toLocaleString()}`}</Popup>
										</CircleMarker>
										
										{/* Small markers along the route */}
										{sessionPositions.slice(1, -1).map((pos, posIdx) => (
												<CircleMarker
														key={posIdx}
														center={pos}
														radius={3}
														fillColor="red"
														color="white"
														weight={1}
														opacity={1}
														fillOpacity={0.8}
												>
													<Popup>{`Время: ${new Date(sessionRoute[posIdx + 1].timestamp * 1000).toLocaleString()}`}</Popup>
												</CircleMarker>
										))}
									</React.Fragment>
							);
						})}
					</MapContainer>
				</Box>
			</Box>
	);
}

export default UserMap;
