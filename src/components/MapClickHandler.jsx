import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

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

export default MapClickHandler;