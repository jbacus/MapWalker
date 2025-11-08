import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker, StandaloneSearchBox, Polyline } from '@react-google-maps/api';
import { useState, useEffect, useRef } from 'react';

const containerStyle = {
  width: '100%',
  height: '100vh'
};

// Define libraries outside component to prevent reload warnings
const libraries: ("places")[] = ['places'];

interface MapProps {
  path: google.maps.LatLng[];
  onMapClick?: (latLng: google.maps.LatLng) => void;
  placementMarkers?: google.maps.LatLng[];
  tooltip?: string;
  center?: google.maps.LatLngLiteral;
  onSearchSelect?: (place: google.maps.places.PlaceResult) => void;
  drawingMode?: boolean;
  drawingPath?: google.maps.LatLng[];
  onDrawStart?: (latLng: google.maps.LatLng) => void;
  onDrawMove?: (latLng: google.maps.LatLng) => void;
  onDrawEnd?: () => void;
}

interface MapComponentProps {
  path: google.maps.LatLng[];
  apiKey: string;
  onMapClick?: (latLng: google.maps.LatLng) => void;
  placementMarkers?: google.maps.LatLng[];
  tooltip?: string;
  center?: google.maps.LatLngLiteral;
  onSearchSelect?: (place: google.maps.places.PlaceResult) => void;
  drawingMode?: boolean;
  drawingPath?: google.maps.LatLng[];
  onDrawStart?: (latLng: google.maps.LatLng) => void;
  onDrawMove?: (latLng: google.maps.LatLng) => void;
  onDrawEnd?: () => void;
}

function MapComponent({
  path,
  apiKey,
  onMapClick,
  placementMarkers = [],
  tooltip = '',
  center,
  onSearchSelect,
  drawingMode = false,
  drawingPath = [],
  onDrawStart,
  onDrawMove,
  onDrawEnd
}: MapComponentProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    preventGoogleFontsLoading: true,
    libraries: libraries
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(center || { lat: 37.7749, lng: -122.4194 });
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);

  // Update map center when center prop changes
  useEffect(() => {
    if (center) {
      setMapCenter(center);
      if (map) {
        map.panTo(center);
        map.setZoom(13);
      }
    }
  }, [center, map]);

  useEffect(() => {
    if (isLoaded && path.length > 1) {
      const directionsService = new google.maps.DirectionsService();
      const waypoints = path.slice(1, path.length - 1).map(p => ({ location: p, stopover: true }));

      directionsService.route(
        {
          origin: path[0],
          destination: path[path.length - 1],
          waypoints: waypoints,
          travelMode: google.maps.TravelMode.WALKING
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            setDirections(result);
          } else {
            console.error(`error fetching directions ${result}`);
          }
        }
      );
    } else {
      setDirections(null);
    }
  }, [path, isLoaded]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && onMapClick && !drawingMode) {
      onMapClick(e.latLng);
    }
  };

  const handleMouseDown = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && drawingMode && onDrawStart) {
      setIsDrawing(true);
      onDrawStart(e.latLng);
    }
  };

  const handleMouseMove = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && drawingMode && isDrawing && onDrawMove) {
      onDrawMove(e.latLng);
    }
  };

  const handleMouseUp = () => {
    if (drawingMode && isDrawing && onDrawEnd) {
      setIsDrawing(false);
      onDrawEnd();
    }
  };

  const handleSearchBoxLoad = (ref: google.maps.places.SearchBox) => {
    searchBoxRef.current = ref;
  };

  const handlePlacesChanged = () => {
    if (searchBoxRef.current && onSearchSelect) {
      const places = searchBoxRef.current.getPlaces();
      if (places && places.length > 0) {
        onSearchSelect(places[0]);
      }
    }
  };

  const getMarkerLabel = (index: number, total: number): string => {
    if (total === 1) return '1';
    if (total === 2) return (index + 1).toString();
    if (total === 3) return (index + 1).toString();
    return (index + 1).toString();
  };

  return isLoaded ? (
    <>
      <div className="position-absolute" style={{ top: '120px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '400px' }}>
        <StandaloneSearchBox
          onLoad={handleSearchBoxLoad}
          onPlacesChanged={handlePlacesChanged}
        >
          <input
            type="text"
            placeholder="Search for a location..."
            className="form-control shadow"
            style={{
              width: '100%',
              height: '40px',
              padding: '0 12px',
              fontSize: '14px'
            }}
          />
        </StandaloneSearchBox>
      </div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={12}
        onClick={handleMapClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onLoad={setMap}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          draggable: !isDrawing,
          zoomControl: !isDrawing,
          scrollwheel: !isDrawing,
          disableDoubleClickZoom: isDrawing
        }}
      >
        {directions && <DirectionsRenderer directions={directions} />}
        {placementMarkers.map((marker, index) => (
          <Marker
            key={index}
            position={marker}
            label={{
              text: getMarkerLabel(index, placementMarkers.length),
              color: 'white'
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2
            }}
          />
        ))}
        {drawingPath.length > 0 && (
          <Polyline
            path={drawingPath}
            options={{
              strokeColor: '#FF0000',
              strokeOpacity: 0.8,
              strokeWeight: 3,
              geodesic: true
            }}
          />
        )}
      </GoogleMap>
    </>
  ) : <></>
}

function Map({
  path,
  onMapClick,
  placementMarkers,
  tooltip,
  center,
  onSearchSelect,
  drawingMode,
  drawingPath,
  onDrawStart,
  onDrawMove,
  onDrawEnd
}: MapProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const backendUrl = (window as any).ENV?.BACKEND_URL || '';
    fetch(`${backendUrl}/api/get-api-key`)
      .then(res => res.json())
      .then(data => setApiKey(data.apiKey))
      .catch(err => console.error('Failed to fetch API key:', err));
  }, []);

  if (!apiKey) {
    return <div>Loading...</div>;
  }

  return <MapComponent
    path={path}
    apiKey={apiKey}
    onMapClick={onMapClick}
    placementMarkers={placementMarkers}
    tooltip={tooltip}
    center={center}
    onSearchSelect={onSearchSelect}
    drawingMode={drawingMode}
    drawingPath={drawingPath}
    onDrawStart={onDrawStart}
    onDrawMove={onDrawMove}
    onDrawEnd={onDrawEnd}
  />;
}

export default Map;
