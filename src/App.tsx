import { useState } from 'react';
import Map from './Map';
import { Button, ButtonGroup, Container, Form } from 'react-bootstrap';
import { generateCircleFromThreePoints, generateSquareFromTwoPoints } from './path-generator';

type PlacementState = {
  shape: 'circle' | 'square';
  points: google.maps.LatLng[];
  tooltipText: string;
};

function App() {
  const [path, setPath] = useState<google.maps.LatLng[]>([]);
  const [selectedShape, setSelectedShape] = useState<'circle' | 'square' | null>(null);
  const [placementState, setPlacementState] = useState<PlacementState | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 37.7749, lng: -122.4194 });

  const handleShapeSelect = (shape: 'circle' | 'square') => {
    setSelectedShape(shape);
    setPath([]);
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

  const handleReset = () => {
    setPath([]);
    setPlacementState(null);
    setSelectedShape(null);
  };

  const handleSearchSelect = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      setMapCenter({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      });
    }
  };

  return (
    <div>
      <Map
        path={path}
        onMapClick={handleMapClick}
        placementMarkers={placementState?.points || []}
        tooltip={placementState?.tooltipText || ''}
        center={mapCenter}
        onSearchSelect={handleSearchSelect}
      />
      <Container className="position-absolute top-0 start-50 translate-middle-x mt-3" style={{ zIndex: 1000 }}>
        <div className="bg-white rounded p-3 shadow">
          <h1 className="text-center mb-3">Map Art</h1>
          <div className="d-flex justify-content-center mb-3">
            <ButtonGroup>
              <Button
                variant={selectedShape === 'circle' ? 'primary' : 'secondary'}
                onClick={() => handleShapeSelect('circle')}
                disabled={placementState !== null}
              >
                Circle
              </Button>
              <Button
                variant={selectedShape === 'square' ? 'primary' : 'secondary'}
                onClick={() => handleShapeSelect('square')}
                disabled={placementState !== null}
              >
                Square
              </Button>
            </ButtonGroup>
          </div>
          {placementState && (
            <div className="alert alert-info mb-3 text-center">
              <small>{placementState.tooltipText}</small>
            </div>
          )}
          {(path.length > 0 || placementState) && (
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
