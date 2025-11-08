import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker, StandaloneSearchBox, Polyline } from '@react-google-maps/api';
import { useState, useEffect, useRef } from 'react';

const containerStyle = {
  width: '100%',
  height: '100vh'
};

// Define libraries outside component to prevent reload warnings
const libraries: ("places")[] = ['places'];

interface PathData {
  id: string;
  points: google.maps.LatLng[];
  idealShape?: google.maps.LatLng[];
  color: string;
}

interface MapProps {
  paths: PathData[];
  selectedPathId: string | null;
  onPathClick: (pathId: string) => void;
  onMapClick?: (latLng: google.maps.LatLng) => void;
  placementMarkers?: google.maps.LatLng[];
  previewShape?: google.maps.LatLng[];
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
  paths: PathData[];
  selectedPathId: string | null;
  onPathClick: (pathId: string) => void;
  apiKey: string;
  onMapClick?: (latLng: google.maps.LatLng) => void;
  placementMarkers?: google.maps.LatLng[];
  previewShape?: google.maps.LatLng[];
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
  paths,
  selectedPathId,
  onPathClick,
  apiKey,
  onMapClick,
  placementMarkers = [],
  previewShape = [],
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

  const [directionsMap, setDirectionsMap] = useState<Map<string, google.maps.DirectionsResult>>(new Map());
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(center || { lat: 37.7749, lng: -122.4194 });
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const isDrawingRef = useRef(false);

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

  // Fetch directions for all paths
  useEffect(() => {
    if (isLoaded && paths.length > 0) {
      const directionsService = new google.maps.DirectionsService();
      const newDirectionsMap = new Map<string, google.maps.DirectionsResult>();

      paths.forEach(pathData => {
        if (pathData.points.length > 1) {
          const waypoints = pathData.points.slice(1, pathData.points.length - 1).map(p => ({ location: p, stopover: true }));

          directionsService.route(
            {
              origin: pathData.points[0],
              destination: pathData.points[pathData.points.length - 1],
              waypoints: waypoints,
              travelMode: google.maps.TravelMode.WALKING
            },
            (result, status) => {
              if (status === google.maps.DirectionsStatus.OK && result) {
                setDirectionsMap(prev => new Map(prev).set(pathData.id, result));
              } else {
                console.error(`error fetching directions for path ${pathData.id}:`, result);
              }
            }
          );
        }
      });
    } else {
      setDirectionsMap(new Map());
    }
  }, [paths, isLoaded]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && onMapClick && !drawingMode) {
      onMapClick(e.latLng);
    }
  };

  const handleMouseDown = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && drawingMode && onDrawStart) {
      setIsDrawing(true);
      isDrawingRef.current = true;
      onDrawStart(e.latLng);
    }
  };

  const handleMouseMove = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && drawingMode && isDrawingRef.current && onDrawMove) {
      onDrawMove(e.latLng);
    }
  };

  const handleMouseUp = () => {
    if (drawingMode && isDrawingRef.current && onDrawEnd) {
      setIsDrawing(false);
      isDrawingRef.current = false;
      onDrawEnd();
    }
  };

  // Add global mouse up listener when drawing mode is active
  useEffect(() => {
    if (drawingMode) {
      const handleGlobalMouseUp = () => {
        if (isDrawingRef.current && onDrawEnd) {
          setIsDrawing(false);
          isDrawingRef.current = false;
          onDrawEnd();
        }
      };

      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchend', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('touchend', handleGlobalMouseUp);
      };
    }
  }, [drawingMode, onDrawEnd]);

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
        {/* Render ideal shapes as polylines */}
        {paths.map(pathData => {
          if (!pathData.idealShape || pathData.idealShape.length === 0) return null;

          return (
            <Polyline
              key={`ideal-${pathData.id}`}
              path={pathData.idealShape}
              options={{
                strokeColor: pathData.color,
                strokeOpacity: selectedPathId === pathData.id ? 0.8 : 0.4,
                strokeWeight: selectedPathId === pathData.id ? 4 : 2,
                geodesic: true,
                clickable: true
              }}
              onClick={() => onPathClick(pathData.id)}
            />
          );
        })}

        {/* Render navigable paths */}
        {paths.map(pathData => {
          const directions = directionsMap.get(pathData.id);
          if (!directions) return null;

          return (
            <DirectionsRenderer
              key={pathData.id}
              directions={directions}
              options={{
                polylineOptions: {
                  strokeColor: pathData.color,
                  strokeOpacity: selectedPathId === pathData.id ? 1.0 : 0.6,
                  strokeWeight: selectedPathId === pathData.id ? 6 : 4
                },
                suppressMarkers: false,
                preserveViewport: true
              }}
              onClick={() => onPathClick(pathData.id)}
            />
          );
        })}
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
        {/* Preview shape during placement (circle/square) */}
        {previewShape.length > 0 && (
          <Polyline
            path={previewShape}
            options={{
              strokeColor: '#4285F4',
              strokeOpacity: 0.6,
              strokeWeight: 3,
              geodesic: true
            }}
          />
        )}

        {/* Free-draw path preview */}
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
  paths,
  selectedPathId,
  onPathClick,
  onMapClick,
  placementMarkers,
  previewShape,
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
    paths={paths}
    selectedPathId={selectedPathId}
    onPathClick={onPathClick}
    apiKey={apiKey}
    onMapClick={onMapClick}
    placementMarkers={placementMarkers}
    previewShape={previewShape}
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
