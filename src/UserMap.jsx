import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {MapContainer, TileLayer, Polyline, Popup, Marker, useMap} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
	Box,
	Button,
	FormControl,
	FormLabel,
	Input,
	Text,
	VStack,
	HStack,
	Flex,
	IconButton,
	Switch,
	Divider
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import haversine from 'haversine-distance';
import {CiRoute} from "react-icons/ci";
import 'leaflet.heat';

function HeatmapLayer({ points }) {
	const map = useMap();
	
	useEffect(() => {
		if (!map || !points.length) return;
		
		const heat = L.heatLayer(points, { radius: 5, blur: 2, max: 1, gradients: { 0.3: 'blue', 0.6: 'yellow', 0.8: 'red' }}).addTo(map);
		
		return () => {
			map.removeLayer(heat);
		};
	}, [map, points]);
	
	return null;
};

function UserMap({ userId }) {
	const today = new Date().toISOString().split('T')[0];
	
	const [routes, setRoutes] = useState({ data: {}, distances: {} });
	const [dateRange, setDateRange] = useState({ start: today, end: today });
	const [status, setStatus] = useState({ loading: false, error: null });
	const [visibleSessions, setVisibleSessions] = useState({});
	const [isBoxVisible, setIsBoxVisible] = useState(true);

	const [showHeatmap, setShowHeatmap] = useState(false);
	const [heatmapData, setHeatmapData] = useState([]);
	const [heatmapStatus, setHeatmapStatus] = useState({ loading: false, error: null });
	
	const carouselRef = useRef(null);
	const mapRef = useRef(null);

useEffect(() => {
  if (mapRef.current) {
    mapRef.current.invalidateSize();
  }
}, [isBoxVisible, routes.data]);
	
	const fetchHeatmapData = useCallback(async () => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const url = new URL(`https://monopiter.ru/api/heatmap`);
    url.searchParams.append('startDate', startDate.toISOString());
    url.searchParams.append('endDate', endDate.toISOString());

    setHeatmapStatus({ loading: true, error: null });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при загрузке данных тепловой карты');
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setHeatmapData(data.map(point => [point.latitude, point.longitude, point.intensity || 1]));
        setHeatmapStatus({ loading: false, error: null });
      } else {
        setHeatmapStatus({ loading: false, error: 'Нет данных для тепловой карты за последние 15 дней' });
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      setHeatmapStatus({ loading: false, error: error.message });
    }
  }, []);
	
	
	const fetchRoute = useCallback(async () => {
		const { start, end } = dateRange;
		const url = new URL(`https://monopiter.ru/api/route/${userId}`);
		if (start && end) {
			// Convert dates to Date objects
			const startDate = new Date(start);
			const endDate = new Date(end);
			// Set the time of endDate to 23:59:59
			endDate.setHours(23, 59, 59, 999);
			
			// Format dates for the API
			const formattedStartDate = startDate.toISOString();
			const formattedEndDate = endDate.toISOString();
			url.searchParams.append('startDate', formattedStartDate);
			url.searchParams.append('endDate', formattedEndDate);
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
    if (showHeatmap) {
      fetchHeatmapData();
    }
  }, [showHeatmap, fetchHeatmapData]);
	
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
		
		const startDate = new Date(dateRange.start);
		const endDate = new Date(dateRange.end);
		// Установим конец дня для конечной даты
		endDate.setHours(23, 59, 59, 999);
		
		if (startDate > endDate) {
			setStatus({ loading: false, error: 'Дата начала должна быть раньше или равна дате окончания' });
			return;
		}
		
		setDateRange({
			start: startDate.toISOString().split('T')[0],
			end: endDate.toISOString()
		});
		
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
			<Box display="flex" flexDirection="column" height="100vh" paddingBottom="64px">
				<VStack as="form" onSubmit={handleSearch} spacing={1} align="center" width={{ base: '100%', md: '400px' }} p={1}>
					<HStack spacing={1} width="100%">
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
				</VStack>
      <HStack p={2}>
				<Button type="submit" colorScheme="blue" isLoading={status.loading} width="100%">
					{status.loading ? 'Загрузка...' : 'Поиск'}
				</Button>
				<Divider orientation='vertical' />
				<VStack spacing={0} align="flex-start">
          <Switch
          id="show-heatmap"
          isChecked={showHeatmap}
          onChange={(e) => setShowHeatmap(e.target.checked)}
          disabled={heatmapStatus.loading}
          />
          <Text fontSize="smaller" color="gray.500" >
          Heatmap
          </Text>
				</VStack>
    </HStack>
				
				{Object.keys(routes.data).length > 0 && (
						<Flex align="center" paddingLeft={1} paddingRight={1}>
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
													paddingLeft={1}
													paddingRight={1}
											>
												<Text display="flex" flexDirection="row"><CiRoute size="17px"/>{(routes.distances[sessionId] / 1000).toFixed(2)} км</Text>
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
				
				<Box flex="1" position="relative" overflow="hidden">
					<MapContainer
							center={[59.938676, 30.314487]}
							zoom={10}
							attributionControl={false}
							style={{ height: '100%', width: '100%' }}
							whenCreated={mapInstance => { mapRef.current = mapInstance; }}
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
						
						{showHeatmap && !heatmapStatus.loading && !heatmapStatus.error && heatmapData.length > 0 && (
							<HeatmapLayer points={heatmapData} />
						)}
					</MapContainer>
				</Box>
				
				{!status.loading && !status.error ? (
						<Box p={1} bgColor="white" borderWidth="2px" borderColor="gray" display={isBoxVisible ? "block" : "none"}>
							<Text fontWeight="bold" fontSize="smaller">Длина активных маршрутов:</Text>
							{activeSessions.map((sessionId) => (
									<Text key={sessionId} fontSize="smaller">{`Маршрут: ${(routes.distances[sessionId] / 1000).toFixed(2)} км`}</Text>
							))}
							<Text fontWeight="bold" mt={1} fontSize="smaller">
								Общий пробег активных маршутов: {(totalActiveDistance / 1000).toFixed(2)} км
							</Text>
						</Box>
				) : (
						<Box p={4} bgColor="white" borderWidth="2px" borderColor="gray" display={isBoxVisible ? "block" : "none"}>
							<Text fontWeight="bold" fontSize="medium">
								{status.error && <Text color="red.500" paddingLeft={1}>{status.error}</Text>}
								
								{!status.error && Object.keys(routes.data).length === 0 && !status.loading && (
										<Text>Выберите даты и нажмите "Поиск" для отображения маршрута</Text>
								)}
							</Text>
						</Box>
				)}
			</Box>
	);
}

export default UserMap;
