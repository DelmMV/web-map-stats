import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.markercluster';

const createMarkerClusterGroup = (props, context) => {
  const cluster = L.markerClusterGroup(props);
  return {
    instance: cluster,
    context: { ...context, layerContainer: cluster },
  };
};

const MarkerClusterGroup = createLayerComponent(createMarkerClusterGroup);

export default MarkerClusterGroup;