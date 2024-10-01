import React from 'react';
import { useMap } from 'react-leaflet';

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

export default CustomZoomControl;