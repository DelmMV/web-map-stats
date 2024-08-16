import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Button, FormControl, FormLabel, Input, Text, VStack, HStack } from '@chakra-ui/react';

function UserMap({ userId }) {
	const today = new Date().toISOString().split('T')[0];
	
	const [route, setRoute] = useState([]);
	const [dateRange, setDateRange] = useState({ start: today, end: today });
	const [status, setStatus] = useState({ loading: false, error: null });
	
	const fetchRoute = useCallback(async () => {
		const { start, end } = dateRange;
		const url = new URL(`http://localhost:5001/api/route/${userId}`);
		
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
				setRoute(data);
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
	
	const positions = useMemo(() => route.map(point => [point.latitude, point.longitude]), [route]);
	const mapBounds = useMemo(() => positions.length > 0 ? positions : [[60.041349, 30.407739]], [positions]);
	
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
				
				{!status.error && positions.length === 0 && !status.loading && (
						<Text>Выберите даты и нажмите "Поиск" для отображения маршрута</Text>
				)}
				
				<Box flex="1" p={0} m={0}>
					<MapContainer bounds={mapBounds} attributionControl={false} style={{ height: '100%', width: '100%' }}>
						<TileLayer
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
								attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
						/>
						{positions.length > 0 && (
								<>
									<Polyline positions={positions} color="blue" weight={3} />
									{positions.map((pos, idx) => (
											<CircleMarker
													key={idx}
													center={pos}
													radius={3}
													fillColor="red"
													color="white"
													weight={1}
													opacity={1}
													fillOpacity={0.8}
											>
												<Popup>{`Время: ${new Date(route[idx].timestamp * 1000).toLocaleString()}`}</Popup>
											</CircleMarker>
									))}
								</>
						)}
					</MapContainer>
				</Box>
			</Box>
	);
}

export default UserMap;
