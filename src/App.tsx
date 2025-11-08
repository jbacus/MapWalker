import { useState } from 'react';
import Map from './Map';
import { Button, ButtonGroup, Container } from 'react-bootstrap';
import { generateCircleFromThreePoints, generateSquareFromTwoPoints, resamplePath } from './path-generator';

type PlacementState = {
  shape: 'circle' | 'square';
  points: google.maps.LatLng[];
  tooltipText: string;
};

type DrawingState = {
  isDrawing: boolean;
  points: google.maps.LatLng[];
};

function App() {
  const [path, setPath] = useState<google.maps.LatLng[]>([]);
  const [selectedMode, setSelectedMode] = useState<'circle' | 'square' | 'draw' | null>(null);
  const [placementState, setPlacementState] = useState<PlacementState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 37.7749, lng: -122.4194 });

  const handleShapeSelect = (shape: 'circle' | 'square') => {
    setSelectedMode(shape);
    setPath([]);
    setDrawingState(null);
    if (shape === 'circle') {
      setPlacementState({
        shape: 'circle',
        points: [],
        tooltipText: 'Click to place start/end point on circle'
      });
    } else {
      setPlacementState({
        shape: 'square',
        points: [],
        tooltipText: 'Click to place start/end point (first corner of square)'
      });
    }
  };

  const handleDrawSelect = () => {
    setSelectedMode('draw');
    setPath([]);
    setPlacementState(null);
    setDrawingState({
      isDrawing: false,
      points: []
    });
  };

  const handleMapClick = (latLng: google.maps.LatLng) => {
    if (!placementState) return;

    const newPoints = [...placementState.points, latLng];

    if (placementState.shape === 'square') {
      if (newPoints.length === 1) {
        setPlacementState({
          ...placementState,
          points: newPoints,
          tooltipText: 'Click to place second corner (defines first edge and size)'
        });
      } else if (newPoints.length === 2) {
        // Generate square from two points
        const generatedPath = generateSquareFromTwoPoints(newPoints[0], newPoints[1]);
        setPath(generatedPath);
        setPlacementState(null);
      }
    } else if (placementState.shape === 'circle') {
      if (newPoints.length === 1) {
        setPlacementState({
          ...placementState,
          points: newPoints,
          tooltipText: 'Click to place second point on circle circumference'
        });
      } else if (newPoints.length === 2) {
        setPlacementState({
          ...placementState,
          points: newPoints,
          tooltipText: 'Click to place third point on circle circumference'
        });
      } else if (newPoints.length === 3) {
        // Generate circle from three points
        const generatedPath = generateCircleFromThreePoints(newPoints[0], newPoints[1], newPoints[2]);
        if (generatedPath.length > 0) {
          setPath(generatedPath);
        } else {
          alert('Could not create circle from these points. Please try again with points that are not collinear.');
        }
        setPlacementState(null);
      }
    }
  };

  const handleDrawStart = (latLng: google.maps.LatLng) => {
    if (drawingState) {
      setDrawingState({
        isDrawing: true,
        points: [latLng]
      });
    }
  };

  const handleDrawMove = (latLng: google.maps.LatLng) => {
    if (drawingState?.isDrawing) {
      setDrawingState({
        ...drawingState,
        points: [...drawingState.points, latLng]
      });
    }
  };

  const handleDrawEnd = () => {
    if (drawingState?.isDrawing && drawingState.points.length > 1) {
      // Resample to maximum allowed points (27 total = 25 waypoints + origin + destination)
      const resampledPoints = resamplePath(drawingState.points, 27);
      setPath(resampledPoints);
      setDrawingState({
        isDrawing: false,
        points: []
      });
    }
  };

  const handleReset = () => {
    setPath([]);
    setPlacementState(null);
    setDrawingState(null);
    setSelectedMode(null);
  };

  const handleSearchSelect = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      setMapCenter({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      });
    }
  };

  const getTooltipText = () => {
    if (placementState) {
      return placementState.tooltipText;
    }
    if (drawingState && !drawingState.isDrawing) {
      return 'Click and drag to draw your path';
    }
    if (drawingState?.isDrawing) {
      return 'Drawing... release to finish';
    }
    return '';
  };

  return (
    <div>
      <Map
        path={path}
        onMapClick={handleMapClick}
        placementMarkers={placementState?.points || []}
        tooltip={getTooltipText()}
        center={mapCenter}
        onSearchSelect={handleSearchSelect}
        drawingMode={drawingState !== null}
        drawingPath={drawingState?.points || []}
        onDrawStart={handleDrawStart}
        onDrawMove={handleDrawMove}
        onDrawEnd={handleDrawEnd}
      />
      <Container className="position-absolute top-0 start-50 translate-middle-x mt-3" style={{ zIndex: 1000 }}>
        <div className="bg-white rounded p-3 shadow">
          <h1 className="text-center mb-3">Map Art</h1>
          <div className="d-flex justify-content-center mb-3">
            <ButtonGroup>
              <Button
                variant={selectedMode === 'circle' ? 'primary' : 'secondary'}
                onClick={() => handleShapeSelect('circle')}
                disabled={placementState !== null || drawingState !== null}
              >
                Circle
              </Button>
              <Button
                variant={selectedMode === 'square' ? 'primary' : 'secondary'}
                onClick={() => handleShapeSelect('square')}
                disabled={placementState !== null || drawingState !== null}
              >
                Square
              </Button>
              <Button
                variant={selectedMode === 'draw' ? 'primary' : 'secondary'}
                onClick={handleDrawSelect}
                disabled={placementState !== null || drawingState !== null}
              >
                Draw
              </Button>
            </ButtonGroup>
          </div>
          {(placementState || drawingState) && (
            <div className="alert alert-info mb-3 text-center">
              <small>{getTooltipText()}</small>
            </div>
          )}
          {(path.length > 0 || placementState || drawingState) && (
            <div className="d-flex justify-content-center">
              <Button variant="danger" onClick={handleReset}>
                Reset
              </Button>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

export default App;
