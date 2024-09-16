import React, { useEffect, useState, useCallback, useMemo, useRef, useReducer } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, Marker, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  IconButton,
  useDisclosure,
  useToast,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
} from '@chakra-ui/react';
import imageCompression from 'browser-image-compression';
import { AddIcon, HamburgerIcon } from '@chakra-ui/icons';
import haversine from 'haversine-distance';
import { HiLocationMarker } from "react-icons/hi";
import 'leaflet.heat';
import { useTelegramUser } from './hooks/useTelegramUser';
import MarkerClusterGroup from './components/MarkerClusterGroup';
import HeatmapLayer from './components/HeatmapLayer';
import { customIconSvgRange, customIconSvgCharger, customIconSvgCharger24, customInterestingIcon, customDangerIcon, customChatIcon, customAutoChargerIcon } from './components/CustomIcon';
import AddStationModal from './components/AddStationModal';
import EditStationModal from './components/EditStationModal';
import MarkerFilterControl from './components/MarkerFilterControl';
import StationModal from './components/StationModal';
import DrawerMenu from './components/DrawerMenu';


const CustomZoomControl = () => {
  const map = useMap();

  return (
    <div className="custom-zoom-control">
      <button
        onClick={() => map.zoomIn()}
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onClick={() => map.zoomOut()}
        title="Zoom out"
        aria-label="Zoom out"
      >
        -
      </button>
    </div>
  );
};

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
    case 'CLEAR_ROUTES':
      return { data: {}, distances: {}, visibleSessions: {} };
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
  const [selectedStation, setSelectedStation] = useState(null);
  const { isOpen: isStationModalOpen, onOpen: onStationModalOpen, onClose: onStationModalClose } = useDisclosure();
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isDrawerOpen, onOpen: onDrawerOpen, onClose: onDrawerClose } = useDisclosure();
  const toast = useToast();
  const isAdmin = admins.includes(userId)
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
    return chargingStations.filter((station) => 
      markerFilters[station.markerType] && (
        isAdmin || 
        typeof station.dislikes === 'undefined' || 
        station.dislikes < 5
      )
    );
  }, [chargingStations, markerFilters, isAdmin]);

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
    dispatch({ type: 'CLEAR_ROUTES' }); // Очищаем маршруты перед новым запросом
  
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
      }
      setStatus({ loading: false, error: null });
    } catch (error) {
      toast({
        position: "top-right",
        title: error.message,
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      console.error('Error fetching route:', error);
      setStatus({ loading: false, error: error.message });
      dispatch({ type: 'CLEAR_ROUTES' }); // Очищаем маршруты в случае ошибки
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
    onStationModalClose();
    onEditOpen();
  };

  const handleDeleteStation = async (stationId) => {
    onStationModalClose();
    try {
      const response = await fetch(`https://monopiter.ru/api/charging-stations/${stationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete charging station');
      }

      await fetchChargingStations();
      toast({
        position: "top-right",
        title: "Станция удалена",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting charging station:', error);
      toast({
        position: "top-right",
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
        position: "top-right",
        title: "Станция добавлена",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding charging station:', error);
      toast({
        position: "top-right",
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
        position: "top-right",
        title: "Станция обновлена",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating charging station:', error);
      toast({
        position: "top-right",
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

  return (
    <Box display="flex" flexDirection="column" height="100vh" paddingBottom="50px">
    <IconButton onClick={onDrawerOpen} position="absolute" top="10px" left="11px" zIndex={1000} icon={<HamburgerIcon />} borderWidth={2} borderRadius={4} borderColor="gray" />

  
      <Drawer isOpen={isDrawerOpen} placement="top" onClose={onDrawerClose} > 
        <DrawerOverlay>
          <DrawerContent 
          borderBottomWidth={2} 
          borderBottomRadius={6} 
          borderBottomColor="black"
          bg="rgba(255, 255, 255, 0.8)"
          backdropFilter="blur(10px)"

        >
            <DrawerCloseButton />
            <DrawerHeader>Меню</DrawerHeader>
            <DrawerBody>  
            <DrawerMenu
              dateRange={dateRange}
              handleDateChange={handleDateChange}
              handleSearch={handleSearch}
              showHeatmap={showHeatmap}
              setShowHeatmap={setShowHeatmap}
              heatmapStatus={heatmapStatus}
              handleHeatmapPeriodChange={handleHeatmapPeriodChange}
              heatmapPeriod={heatmapPeriod}
              heatmapMonth={heatmapMonth}
              setHeatmapMonth={setHeatmapMonth}
              heatmapYear={heatmapYear}
              setHeatmapYear={setHeatmapYear}
              totalActiveDistance={totalActiveDistance}
              routesState={routesState}
              toggleSession={toggleSession}
              handleScroll={handleScroll}
              carouselRef={carouselRef}
            />
            </DrawerBody>
          </DrawerContent>
        </DrawerOverlay>
      </Drawer>

      <Box flex="1" position="absolute" top="0" left="0" right="0" bottom="0" overflow="hidden">
        <MapContainer
          center={[59.938676, 30.314487]}
          zoom={10}
          attributionControl={false}
          zoomControl={false} 
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
                  eventHandlers={{
                    click: () => {
                      setSelectedStation(station);
                      onStationModalOpen();
                    },
                  }}
                  />
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
          {showChargingStations && <MarkerFilterControl onFilterChange={handleFilterChange} />}
          <Box position="absolute" top="81px" left="11px" zIndex={1000}>
            <IconButton
              onClick={() => setShowChargingStations(!showChargingStations)} 
              variant="solid"
              icon={<HiLocationMarker />}
              colorScheme={showChargingStations ? 'blue' : 'gray'}
              size="sm" 
              borderRadius={3}
              borderColor="gray"
              borderWidth={2}
              width="30px"
              padding="0"
              />
          </Box>
          {showChargingStations && (
            <Box position="absolute" top="120px" left="11px" zIndex={1000}>
            <IconButton
                onClick={handleAddStationClick}
                isDisabled={isAddingStation}
                icon={<AddIcon />}
                colorScheme="gray"
                size="sm"
                borderRadius={3}
                borderColor="gray"
                borderWidth={2}
                />
            </Box>
          )}
            <div >
              <CustomZoomControl/>
            </div>
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
      
      <StationModal
        isOpen={isStationModalOpen}
        onClose={onStationModalClose}
        station={selectedStation}
        onEdit={handleEditStation}
        onDelete={handleDeleteStation}
        isAdmin={isAdmin}
        userId={userId}
      />
    </Box>
  );
}
export default React.memo(UserMap);
