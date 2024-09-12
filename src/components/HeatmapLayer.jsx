import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

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

export default HeatmapLayer;