import React, { useEffect, useState, useCallback, useMemo, useRef, useReducer } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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
  Select,
  useDisclosure,
  useToast,
  Divider,
} from '@chakra-ui/react';
import imageCompression from 'browser-image-compression';
import { ChevronLeftIcon, ChevronRightIcon, AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import haversine from 'haversine-distance';
import { CiRoute } from "react-icons/ci";
import { HiLocationMarker } from "react-icons/hi";
import 'leaflet.heat';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { useTelegramUser } from './hooks/useTelegramUser';
import { format } from 'date-fns';
import MarkerClusterGroup from './components/MarkerClusterGroup';
import HeatmapLayer from './components/HeatmapLayer';
import { customIconSvgRange, customIconSvgCharger, customIconSvgCharger24, customInterestingIcon, customDangerIcon, customChatIcon, customAutoChargerIcon } from './components/CustomIcon';
import AddStationModal from './components/AddStationModal';
import EditStationModal from './components/EditStationModal';
import MarkerFilterControl from './components/MarkerFilterControl';

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

const MapClickHandler = ({ isAddingStation, onMapClick }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!isAddingStation) return;
    
    const handleClick = (e) => {
      onMapClick(e.latlng);
    };
    
    map.on('click', handleClick);
    
    return () => {
      map.off('click', handleClick);
    };
  }, [isAddingStation, onMapClick, map]);
  
  return null;
};

function UserMap({ userId, admins }) {
  const user = useTelegramUser();
  const today = new Date().toISOString().split('T')[0];
  const [routesState, dispatch] = useReducer(routesReducer, { data: {}, distances: {}, visibleSessions: {} });
  const [dateRange, setDateRange] = useState({ start: today, end: today });
  const [showDateRange, setShowDateRange] = useState(false);
  const [status, setStatus] = useState({ loading: false, error: null });
  const [chargingStations, setChargingStations] = useState([]);
  const [showChargingStations, setShowChargingStations] = useState(false);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapStatus, setHeatmapStatus] = useState({ loading: false, error: null });
  const [heatmapPeriod, setHeatmapPeriod] = useState('this_month');
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState(new Date().getMonth() + 1);

  const [newStation, setNewStation] = useState(null);
  const [isAddingStation, setIsAddingStation] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const toast = useToast();

  const carouselRef = useRef(null);
  const mapRef = useRef(null);

  const [markerFilters, setMarkerFilters] = useState({
    charging: true,
    chargingAuto: true,
    interesting: true,
    danger: true,
    chat: true,
  });

  const handleFilterChange = (newFilters) => {
    setMarkerFilters(newFilters);
  };

  const filteredChargingStations = useMemo(() => {
    return chargingStations.filter((station) => markerFilters[station.markerType]);
  }, [chargingStations, markerFilters]);

  const fetchChargingStations = useCallback(async () => {
    try {
      const response = await fetch('https://monopiter.ru/api/charging-stations');
      if (!response.ok) {
        throw new Error('Failed to fetch charging stations');
      }
      const data = await response.json();
      setChargingStations(data);
    } catch (error) {
      console.error('Error fetching charging stations:', error);
    }
  }, []);

  useEffect(() => {
    fetchChargingStations();
  }, [fetchChargingStations]);

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

  const handleAddStationClick = useCallback(() => {
    console.log('Add station button clicked');
    setIsAddingStation(true);
  }, []);

  const handleMapClick = useCallback((latlng) => {
    if (isAddingStation) {
      console.log('Adding station at', latlng);
      setNewStation(latlng);
      setIsAddingStation(false);
      onAddOpen();
    }
  }, [isAddingStation, onAddOpen]);

  const handleEditStation = (station) => {
    setEditingStation(station);
    onEditOpen();
  };

  const handleDeleteStation = async (stationId) => {
    try {
      const response = await fetch(`https://monopiter.ru/api/charging-stations/${stationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete charging station');
      }

      await fetchChargingStations();
      toast({
        title: "Станция удалена",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting charging station:', error);
      toast({
        title: "Ошибка при удалении станции",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    };

    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Error compressing image:", error);
      return file; // Return original file if compression fails
    }
  };

  const handleSaveStation = useCallback(async (stationData) => {
    if (!newStation) return;

    const formData = new FormData();
    formData.append('latitude', newStation.lat);
    formData.append('longitude', newStation.lng);
    formData.append('is24Hours', stationData.is24Hours);
    formData.append('markerType', stationData.markerType);
    formData.append('comment', stationData.comment);
    formData.append('userId', userId);
    formData.append('addedBy', JSON.stringify({
      id: user.id,
      name: `${user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName ? user.firstName : user.lastName}`,
      username: user.username,
    }));
    formData.append('addedAt', new Date().toISOString());
    if (stationData.photo) {
      const compressedPhoto = await compressImage(stationData.photo);
      formData.append('photo', compressedPhoto);
    }

    try {
      const response = await fetch('https://monopiter.ru/api/charging-stations', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to add charging station');
      }

      await fetchChargingStations();
      setNewStation(null);
      onAddClose();
      toast({
        title: "Станция добавлена",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding charging station:', error);
      toast({
        title: `Ошибка при добавлении станции ${error}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [newStation, userId, fetchChargingStations, onAddClose, toast, user]);

  const handleUpdateStation = useCallback(async (updatedData) => {
    if (!editingStation) return;

    const formData = new FormData();
    formData.append('latitude', editingStation.latitude);
    formData.append('longitude', editingStation.longitude);
    formData.append('is24Hours', updatedData.is24Hours);
    formData.append('markerType', updatedData.markerType);
    formData.append('comment', updatedData.comment);
    formData.append('userId', userId);
    if (updatedData.photo) {
      const compressedPhoto = await compressImage(updatedData.photo);
      formData.append('photo', compressedPhoto);
    }

    try {
      const response = await fetch(`https://monopiter.ru/api/charging-stations/${editingStation._id}`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update charging station');
      }

      await fetchChargingStations();
      setEditingStation(null);
      onEditClose();
      toast({
        title: "Станция обновлена",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating charging station:', error);
      toast({
        title: "Ошибка при обновлении станции",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [editingStation, userId, fetchChargingStations, onEditClose, toast]);

  const handleScroll = useCallback((direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
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

  const startIcon = useMemo(() => customIconSvgRange('blue'), []);
  const endIcon = useMemo(() => customIconSvgRange('red'), []);
  const chargingStationIcon = useMemo(() => customIconSvgCharger(), []);
  const chargingStationIcon24 = useMemo(() => customIconSvgCharger24(), []);
  const chargingStationAutoIcon = useMemo(() => customAutoChargerIcon(), []);
  const interestingIcon = useMemo(() => customInterestingIcon(), []);
  const dangerIcon = useMemo(() => customDangerIcon(), []);
  const chatIcon = useMemo(() => customChatIcon(), []);

  const getMarkerIcon = (station) => {
  
    switch (station.markerType) {
      case 'charging':
        return station.is24Hours ? chargingStationIcon24 : chargingStationIcon;
      case 'chargingAuto':
        return chargingStationAutoIcon;
      case 'interesting':
        return interestingIcon;
      case 'danger':
        return dangerIcon;
      case 'chat':
        return chatIcon;
      default:
        return chargingStationIcon;
    }
  };

  const getMarkerTypeTitle = (markerType) => {
    switch (markerType) {
      case 'charging':
        return 'Место зарядки';
      case 'chargingAuto':
        return 'Автомобильная зарядка';
      case 'interesting':
        return 'Интересное место';
      case 'danger':
        return 'Опасное место';
      case 'chat':
        return 'Разговорчики';
      default:
        return 'Место зарядки';
    }
  };

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
          <HStack spacing={0} width="100%">
            <FormControl isRequired ml={2}>
              <FormLabel fontSize="sm">Начальная дата</FormLabel>
              <Input
                type="date"
                name="start"
                value={dateRange.start}
                onChange={handleDateChange}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Конечная дата</FormLabel>
              <Input
                type="date"
                name="end"
                value={dateRange.end}
                onChange={handleDateChange}
              />
            </FormControl>
          </HStack>
        )}
      </VStack>

      <Box>
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
              <Text fontSize="smaller">
                Годовая
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
              {[...Array(2)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </Select>
          </HStack>
        )}
        <HStack pt={1} pb={1}>

          {showChargingStations && (
            <Button
              onClick={handleAddStationClick}
              isDisabled={isAddingStation}
              leftIcon={<AddIcon />}
              ml={2}
              size="smaller"
              padding={0.5}
            >
              <Text fontSize="smaller">Добавить место</Text>
            </Button>
          )}
        </HStack>
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
                    <CiRoute size="17px" />
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

          {showChargingStations && filteredChargingStations && filteredChargingStations.length > 0 && (
            <MarkerClusterGroup>
              {filteredChargingStations.map((station) => (
                <Marker
                  key={station._id}
                  position={[station.latitude, station.longitude]}
                  icon={getMarkerIcon(station)}
                >
                  <Popup>
                    <Box width="200px" p={0} m={0}>
                      <VStack align="stretch" spacing={2}>
                        <div className='custom-popup-header'>{getMarkerTypeTitle(station.markerType)}</div>

                        {station.photo && (
                          <LazyLoadImage
                            src={station.photo}
                            effect="blur"
                            threshold={200}
                            loading="lazy"
                            onError={(event) => console.log('Image load failed', event)}
                            width="100%"
                            height="150px"
                            style={{
                              objectFit: 'cover',
                              width: '100%',
                              height: '100%',
                              borderRadius: '0.375rem'
                            }}
                          />
                        )}

                        {station.comment && (
                          <div className='custom-popup-comment'>
                            {station.comment}
                          </div>
                        )}

                        <VStack align="start" spacing={1}>
                          <div className='custom-popup-addby'>
                            Добавил: {station.addedBy.username ? station.addedBy.username : station.addedBy.name}
                          </div>
                          <div className='custom-popup-addby'>
                            {format(new Date(station.addedAt), 'dd.MM.yyyy HH:mm')}
                          </div>
                        </VStack>

                        <Divider />

                        <HStack justifyContent="space-between">
                          <IconButton
                            icon={<EditIcon />}
                            aria-label="Edit station"
                            size="xs"
                            colorScheme="blue"
                            onClick={() => handleEditStation(station)}
                          />
                            {admins.includes(userId) && (
                            <IconButton
                              icon={<DeleteIcon />}
                              aria-label="Delete station"
                              size="xs"
                              colorScheme="red"
                              onClick={() => handleDeleteStation(station._id)}
                            />
                          )}
                        </HStack>
                      </VStack>
                    </Box>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}

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
          <MapClickHandler isAddingStation={isAddingStation} onMapClick={handleMapClick} />
          <MarkerFilterControl onFilterChange={handleFilterChange} />
          <Box position="absolute" top="81px"left="11px" zIndex={1000}>
            <Button 
            onClick={() => setShowChargingStations(!showChargingStations)} 
            variant="solid"
            colorScheme={showChargingStations ? 'blue' : 'gray'}
            size="sm" 
            borderRadius= "0"
            borderWidth={1}
            borderColor="gray"
            width="30px"
            padding="0"
            
          >
          <HiLocationMarker/>
          </Button>
          </Box>
        </MapContainer>
      </Box>  

      {isAddingStation && (
        <Box
          fontSize={12}
          width="210px"
          position="absolute"
          top="75%"
          left="30%"
          backgroundColor="white"
          padding="10px"
          borderRadius="md"
          boxShadow="md"
          zIndex={1000}
        >
          Кликните на карту, чтобы добавить станцию
        </Box>
      )}

      {!status.loading && !status.error ? (
        <Box p={1} bgColor="white" borderWidth="2px" borderColor="gray">
          <Text fontWeight="bold" fontSize="smaller">Длина активных маршрутов:</Text>
          {activeSessions.map((sessionId) => (
            <Text key={sessionId} fontSize="smaller">{`Маршрут: ${(routesState.distances[sessionId] / 1000).toFixed(2)} км`}</Text>
          ))}
          <Text fontWeight="bold" mt={1} fontSize="smaller">
            Общий пробег активных маршрутов: {(totalActiveDistance / 1000).toFixed(2)} км
          </Text>
        </Box>
      ) : (
        <Box p={4} bgColor="white" borderWidth="2px" borderColor="gray">
          <Text fontWeight="bold" fontSize="medium">
            {status.error && <Text color="red.500" paddingLeft={1}>{status.error}</Text>}
            {!status.error && Object.keys(routesState.data).length === 0 && !status.loading && (
              <Text>Выберите даты и нажмите "Поиск" для отображения маршрута</Text>
            )}
          </Text>
        </Box>
      )}

      <AddStationModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        onSave={handleSaveStation}
      />

      <EditStationModal
        isOpen={isEditOpen}
        onClose={onEditClose}
        onUpdate={handleUpdateStation}
        station={editingStation}
      />
    </Box>
  );
}

export default React.memo(UserMap);