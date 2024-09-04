import React, { useEffect, useState, useCallback, useMemo, useRef, useReducer } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, Marker, useMap } from 'react-leaflet';
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
  Checkbox,
  Select
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import haversine from 'haversine-distance';
import { CiRoute } from "react-icons/ci";
import 'leaflet.heat';

const HeatmapLayer = React.memo(({ points }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points.length) return;
    
    const heat = L.heatLayer(points, { radius: 5, blur: 2, max: 1, gradients: { 0.3: 'blue', 0.6: 'yellow', 0.8: 'red' }}).addTo(map);
    
    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);
  
  return null;
});

function routesReducer(state, action) {
  switch (action.type) {
    case 'SET_ROUTES':
      return { 
        ...state, 
        data: action.payload.data, 
        distances: action.payload.distances,
        visibleSessions: Object.keys(action.payload.data).reduce((acc, sessionId) => {
          acc[sessionId] = true;
          return acc;
        }, {})
      };
    case 'TOGGLE_SESSION':
      return { 
        ...state, 
        visibleSessions: { 
          ...state.visibleSessions, 
          [action.payload]: !state.visibleSessions[action.payload] 
        } 
      };
    default:
      return state;
  }
}

function UserMap({ userId }) {
  const today = new Date().toISOString().split('T')[0];
  
  const [routesState, dispatch] = useReducer(routesReducer, { data: {}, distances: {}, visibleSessions: {} });
  const [dateRange, setDateRange] = useState({ start: today, end: today });
  const [showDateRange, setShowDateRange] = useState(false);
  const [status, setStatus] = useState({ loading: false, error: null });
  const [isBoxVisible, setIsBoxVisible] = useState(true);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapStatus, setHeatmapStatus] = useState({ loading: false, error: null });
  const [heatmapPeriod, setHeatmapPeriod] = useState('this_month');
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState(new Date().getMonth() + 1);

  const carouselRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [isBoxVisible, routesState.data]);

  const fetchHeatmapData = useCallback(async () => {
    let url;
    
    switch (heatmapPeriod) {
      case 'this_month':
        url = `https://monopiter.ru/api/monthly-heatmap/${heatmapYear}/${heatmapMonth}`;
        break;
      case 'last_month':
        const lastMonth = heatmapMonth === 1 ? 12 : heatmapMonth - 1;
        const lastMonthYear = heatmapMonth === 1 ? heatmapYear - 1 : heatmapYear;
        url = `https://monopiter.ru/api/monthly-heatmap/${lastMonthYear}/${lastMonth}`;
        break;
      case 'this_year':
        url = `https://monopiter.ru/api/yearly-heatmap/${heatmapYear}`;
        break;
      default:
        url = `https://monopiter.ru/api/monthly-heatmap/${heatmapYear}/${heatmapMonth}`;
    }

    setHeatmapStatus({ loading: true, error: null });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при загрузке данных тепловой карты');
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setHeatmapData(data.map(point => [point.latitude, point.longitude, point.intensity]));
        setHeatmapStatus({ loading: false, error: null });
      } else {
        setHeatmapStatus({ loading: false, error: 'Нет данных для тепловой карты за выбранный период' });
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      setHeatmapStatus({ loading: false, error: error.message });
    }
  }, [heatmapPeriod, heatmapYear, heatmapMonth]);

  const fetchRoute = useCallback(async () => {
    const { start, end } = dateRange;
    const url = new URL(`https://monopiter.ru/api/route/${userId}`);
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      
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
        
        dispatch({ type: 'SET_ROUTES', payload: { data: groupedRoutes, distances } });
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

  const handleDateChange = useCallback((e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);
    
    if (startDate > endDate) {
      setStatus({ loading: false, error: 'Дата начала должна быть раньше или равна дате окончания' });
      return;
    }
    
    setDateRange({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });
    
    fetchRoute();
  }, [dateRange, fetchRoute]);

  const toggleSession = useCallback((sessionId) => {
    dispatch({ type: 'TOGGLE_SESSION', payload: sessionId });
  }, []);

  const handleHeatmapPeriodChange = useCallback((e) => {
    setHeatmapPeriod(e.target.value);
    if (e.target.value === 'this_year') {
      setHeatmapYear(new Date().getFullYear());
    } else {
      setHeatmapYear(new Date().getFullYear());
      setHeatmapMonth(new Date().getMonth() + 1);
    }
  }, []);

  const sessionColors = useMemo(() => {
    if (!routesState.data || Object.keys(routesState.data).length === 0) return [];
    
    return Object.keys(routesState.data).map((_, idx) => {
      const hue = (idx * 60) % 360;
      return `hsl(${hue}, 100%, 30%)`;
    });
  }, [routesState.data]);

  const activeSessions = useMemo(() => {
    return Object.keys(routesState.visibleSessions).filter(sessionId => routesState.visibleSessions[sessionId]);
  }, [routesState.visibleSessions]);

  const totalActiveDistance = useMemo(() => {
    return activeSessions.reduce((total, sessionId) => {
      return total + (routesState.distances[sessionId] || 0);
    }, 0);
  }, [activeSessions, routesState.distances]);

  const handleScroll = useCallback((direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, []);

  const createCustomIcon = useCallback((color, iconText) => {
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
  }, []);

  const startIcon = useMemo(() => createCustomIcon('blue', 'S'), [createCustomIcon]);
  const endIcon = useMemo(() => createCustomIcon('red', 'F'), [createCustomIcon]);

  return (
    <Box display="flex" flexDirection="column" height="100vh" paddingBottom="64px">
      <VStack as="form" onSubmit={handleSearch} spacing={0} align="center" width={{ base: '100%', md: '400px' }}>
        <Button
        width={{ base: '95%', md: 'auto' }}
        height={{ base: 'auto', md: '100%' }}
        fontSize="sm"
        colorScheme={showDateRange ? 'blue' : 'gray'}
        variant="outline"
        size="sm"
        m={2}
        onClick={() => setShowDateRange(!showDateRange)}
      >
      Поиск трека по дате
      </Button>
        {showDateRange && (
          <HStack spacing={1} width="100%">
            <FormControl isRequired ml={2}>
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
              <Button type="submit" colorScheme="blue" isLoading={status.loading} width="100%" alignSelf='flex-end'mr={2}>
                {status.loading ? 'Загрузка...' : 'Поиск'}
              </Button>
          </HStack>
        )}
      </VStack>
      
      <Box p={0}>
        <Box spacing={0} align="center">
          <Button
            onClick={(e) => setShowHeatmap(!showHeatmap)}
            isLoading={heatmapStatus.loading}
            width={{ base: '95%', md: 'auto' }}
            height={{ base: 'auto', md: '100%' }}
            colorScheme={showHeatmap ? 'blue' : 'gray'}
            variant="outline"
            size="sm"
            m={2}
          >Тепловая карта</Button>
        </Box>
        {showHeatmap && (
          <HStack>
            <Checkbox 
              pl={2}
              isChecked={heatmapPeriod === 'this_year'} 
              onChange={(e) => handleHeatmapPeriodChange({ target: { value: e.target.checked ? 'this_year' : 'this_month' } })}
            >
              <Text fontSize="smaller" >
                Годовой
              </Text>
            </Checkbox>
            {heatmapPeriod !== 'this_year' && (
              <Select
                value={heatmapMonth}
                onChange={(e) => setHeatmapMonth(Number(e.target.value))}
                size="sm"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </Select>
            )}
            <Select
              value={heatmapYear}
              onChange={(e) => setHeatmapYear(Number(e.target.value))}
              size="sm"
              mr={2}
            >
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </Select>
          </HStack>
        )}
      </Box>
      
      {Object.keys(routesState.data).length > 0 && (
        <Flex align="center" paddingLeft={2} paddingRight={2}>
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
              {Object.keys(routesState.data).map((sessionId, idx) => (
                <Button
                  key={sessionId}
                  size="sm"
                  colorScheme={routesState.visibleSessions[sessionId] ? "green" : "gray"}
                  onClick={() => toggleSession(sessionId)}
                  flexShrink={0}
                  paddingLeft={1}
                  paddingRight={1}
                >
                  <Text display="flex" flexDirection="row">
                    <CiRoute size="17px"/>
                    {(routesState.distances[sessionId] / 1000).toFixed(2)} км
                  </Text>
                </Button>
              ))}
            </HStack>
          </Box>
          <IconButton
            icon={<ChevronRightIcon />}
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
          
          {Object.keys(routesState.data).map((sessionId, idx) => {
            if (!routesState.visibleSessions[sessionId]) return null;
            const sessionRoute = routesState.data[sessionId];
            const sessionPositions = sessionRoute.map(point => [point.latitude, point.longitude]);
            const totalDistance = routesState.distances[sessionId];
            
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
            <Text key={sessionId} fontSize="smaller">{`Маршрут: ${(routesState.distances[sessionId] / 1000).toFixed(2)} км`}</Text>
          ))}
          <Text fontWeight="bold" mt={1} fontSize="smaller">
            Общий пробег активных маршрутов: {(totalActiveDistance / 1000).toFixed(2)} км
          </Text>
        </Box>
      ) : (
        <Box p={4} bgColor="white" borderWidth="2px" borderColor="gray" display={isBoxVisible ? "block" : "none"}>
          <Text fontWeight="bold" fontSize="medium">
            {status.error && <Text color="red.500" paddingLeft={1}>{status.error}</Text>}
            
            {!status.error && Object.keys(routesState.data).length === 0 && !status.loading && (
              <Text>Выберите даты и нажмите "Поиск" для отображения маршрута</Text>
            )}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default React.memo(UserMap);