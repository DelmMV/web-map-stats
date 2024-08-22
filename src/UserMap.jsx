import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Box, Button, FormControl, FormLabel, Input, Text, VStack, HStack, Flex, IconButton } from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import haversine from 'haversine-distance';

function UserMap({ userId }) {
	const today = new Date().toISOString().split('T')[0];
	
	const [routes, setRoutes] = useState({ data: {}, distances: {} });
	const [dateRange, setDateRange] = useState({ start: today, end: today });
	const [status, setStatus] = useState({ loading: false, error: null });
	const [visibleSessions, setVisibleSessions] = useState({});
	const carouselRef = useRef(null);
	
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
				const groupedRoutes = data.reduce((acc, point) => {
					const sessionId = point.sessionId;
					if (!acc[sessionId]) {
						acc[sessionId] = [];
					}
					acc[sessionId].push(point);
					return acc;
				}, {});
				
				const distances = Object.keys(groupedRoutes).reduce((acc, sessionId) => {
					acc[sessionId] = groupedRoutes[sessionId].reduce((totalDistance, point, index, array) => {
						if (index === 0) return totalDistance;
						const prevPoint = array[index - 1];
						const currentDistance = haversine(
								{ lat: prevPoint.latitude, lon: prevPoint.longitude },
								{ lat: point.latitude, lon: point.longitude }
						);
						return totalDistance + currentDistance;
					}, 0);
					return acc;
				}, {});
				
				setRoutes({ data: groupedRoutes, distances });
				setVisibleSessions(Object.keys(groupedRoutes).reduce((acc, sessionId) => {
					acc[sessionId] = true;
					return acc;
				}, {}));
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
	
	const toggleSession = (sessionId) => {
		setVisibleSessions(prev => ({
			...prev,
			[sessionId]: !prev[sessionId]
		}));
	};
	
	const sessionColors = useMemo(() => {
		if (!routes.data || Object.keys(routes.data).length === 0) return [];
		
		return Object.keys(routes.data).map((_, idx) => {
			const hue = (idx * 60) % 360;
			const saturation = 100;
			const lightness = 30;
			return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
		});
	}, [routes.data]);
	
	const activeSessions = useMemo(() => {
		return Object.keys(visibleSessions).filter(sessionId => visibleSessions[sessionId]);
	}, [visibleSessions]);
	
	const totalActiveDistance = useMemo(() => {
		return activeSessions.reduce((total, sessionId) => {
			return total + (routes.distances[sessionId] || 0);
		}, 0);
	}, [activeSessions, routes.distances]);
	
	const handleScroll = (direction) => {
		if (carouselRef.current) {
			const scrollAmount = direction === 'left' ? -200 : 200;
			carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
		}
	};
	const createCustomIcon = (color, iconText) => {
		return L.divIcon({
			className: 'custom-icon',
			html: `
      <div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold;">
        ${iconText}
      </div>
    `,
			iconSize: [30, 30],
			iconAnchor: [15, 15],
		});
	};
	const startIcon = createCustomIcon('blue', 'S');
	const endIcon = createCustomIcon('red', 'F');

	return (
			<Box display="flex" flexDirection="column" height="92.5vh" p={0} m={0}>
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
				
				{!status.error && Object.keys(routes.data).length === 0 && !status.loading && (
						<Text>Выберите даты и нажмите "Поиск" для отображения маршрута</Text>
				)}
				
				{Object.keys(routes.data).length > 0 && (
						<Flex align="center" p={2}>
							<IconButton
									icon={<ChevronLeftIcon />}
									onClick={() => handleScroll('left')}
									aria-label="Scroll left"
							/>
							<Box
									ref={carouselRef}
									overflowX="auto"
									whiteSpace="nowrap"
									css={{
										'&::-webkit-scrollbar': {
											display: 'none',
										},
										scrollbarWidth: 'none',
										msOverflowStyle: 'none',
									}}
									flex={1}
							>
								<HStack spacing={2} p={2}>
									{Object.keys(routes.data).map((sessionId, idx) => (
											<Button
													key={sessionId}
													size="sm"
													colorScheme={visibleSessions[sessionId] ? "green" : "gray"}
													onClick={() => toggleSession(sessionId)}
													flexShrink={0}
											>
												Маршрут {sessionId}
											</Button>
									))}
								</HStack>
							</Box>
							<IconButton
									icon={<ChevronRightIcon />}
									variant="ghost"
									onClick={() => handleScroll('right')}
									aria-label="Scroll right"
							/>
						</Flex>
				)}
				
				<Box flex="1" p={0} m={0}>
					<MapContainer
							center={[59.938676, 30.314487]}
							zoom={10}
							attributionControl={false}
							style={{ height: '100%', width: '100%' }}
					>
						<TileLayer
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
								attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
						/>
						{Object.keys(routes.data).map((sessionId, idx) => {
							if (!visibleSessions[sessionId]) return null;
							const sessionRoute = routes.data[sessionId];
							const sessionPositions = sessionRoute.map(point => [point.latitude, point.longitude]);
							const totalDistance = routes.distances[sessionId];
							
							return (
									<React.Fragment key={sessionId}>
										<Polyline positions={sessionPositions} color={sessionColors[idx]} weight={3} />
										
										<Marker position={sessionPositions[0]} icon={startIcon}>
											<Popup>{`Начало трека (Маршрут ${sessionId}): ${new Date(sessionRoute[0].timestamp * 1000).toLocaleString()}`}</Popup>
										</Marker>
										
										<Marker position={sessionPositions[sessionPositions.length - 1]} icon={endIcon}>
											<Popup>{`Конец трека (Маршрут ${sessionId}): ${new Date(sessionRoute[sessionRoute.length - 1].timestamp * 1000).toLocaleString()} \n Пробег: ${(totalDistance / 1000).toFixed(2)} км`}</Popup>
										</Marker>
									</React.Fragment>
							);
						})}
					</MapContainer>
				</Box>
				
				{!status.loading && !status.error && (
						<Box p={2} bg="transparent" bgColor="white" borderWidth="2px" borderColor="gray">
							<Text fontWeight="bold">Длина активных маршрутов:</Text>
							{activeSessions.map((sessionId) => (
									<Text key={sessionId}>{`Маршрут ${sessionId}: ${(routes.distances[sessionId] / 1000).toFixed(2)} км`}</Text>
							))}
							<Text fontWeight="bold" mt={2}>
								Общий пробег активных маршутов: {(totalActiveDistance / 1000).toFixed(2)} км
							</Text>
						</Box>
				)}
			</Box>
	);
}

export default UserMap;
