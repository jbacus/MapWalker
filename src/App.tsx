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

type PathData = {
  id: string;
  points: google.maps.LatLng[];
  color: string;
};

function App() {
  const [paths, setPaths] = useState<PathData[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'circle' | 'square' | 'draw' | null>(null);
  const [placementState, setPlacementState] = useState<PlacementState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 37.7749, lng: -122.4194 });

  const generatePathId = () => `path-${Date.now()}-${Math.random()}`;

  const getPathColor = (index: number) => {
    const colors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D00', '#46BDC6'];
    return colors[index % colors.length];
  };

  const addPath = (points: google.maps.LatLng[]) => {
    const newPath: PathData = {
      id: generatePathId(),
      points,
      color: getPathColor(paths.length)
    };
    setPaths([...paths, newPath]);
    setSelectedPathId(newPath.id);
  };

  const handleShapeSelect = (shape: 'circle' | 'square') => {
    setSelectedMode(shape);
    setDrawingState(null);
    setSelectedPathId(null);
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
    setPlacementState(null);
    setSelectedPathId(null);
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
        const generatedPath = generateSquareFromTwoPoints(newPoints[0], newPoints[1]);
        addPath(generatedPath);
        setPlacementState(null);
        setSelectedMode(null);
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
        const generatedPath = generateCircleFromThreePoints(newPoints[0], newPoints[1], newPoints[2]);
        if (generatedPath.length > 0) {
          addPath(generatedPath);
        } else {
          alert('Could not create circle from these points. Please try again with points that are not collinear.');
        }
        setPlacementState(null);
        setSelectedMode(null);
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
      const resampledPoints = resamplePath(drawingState.points, 27);
      addPath(resampledPoints);
      setDrawingState({
        isDrawing: false,
        points: []
      });
      setSelectedMode(null);
    }
  };

  const handleDeletePath = (pathId: string) => {
    setPaths(paths.filter(p => p.id !== pathId));
    if (selectedPathId === pathId) {
      setSelectedPathId(null);
    }
  };

  const handleSelectPath = (pathId: string) => {
    setSelectedPathId(pathId);
    setSelectedMode(null);
    setPlacementState(null);
    setDrawingState(null);
  };

  const handleClearAll = () => {
    setPaths([]);
    setSelectedPathId(null);
    setSelectedMode(null);
    setPlacementState(null);
    setDrawingState(null);
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
    return 'Select a tool to start drawing';
  };

  return (
    <div>
      <Map
        paths={paths}
        selectedPathId={selectedPathId}
        onPathClick={handleSelectPath}
        onMapClick={handleMapClick}
        placementMarkers={placementState?.points || []}
        center={mapCenter}
        onSearchSelect={handleSearchSelect}
        drawingMode={drawingState !== null}
        drawingPath={drawingState?.points || []}
        onDrawStart={handleDrawStart}
        onDrawMove={handleDrawMove}
        onDrawEnd={handleDrawEnd}
      />

      {/* Compact icon toolbar */}
      <div className="position-absolute top-0 end-0 m-3" style={{ zIndex: 1000 }}>
        <div className="bg-white rounded shadow" style={{ padding: '8px' }}>
          <div className="d-flex flex-column gap-2">
            <button
              className={`btn ${selectedMode === 'circle' ? 'btn-primary' : 'btn-light'} p-2`}
              onClick={() => handleShapeSelect('circle')}
              disabled={placementState !== null || drawingState !== null}
              title="Draw Circle"
              style={{ width: '48px', height: '48px', border: '1px solid #dee2e6' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </button>
            <button
              className={`btn ${selectedMode === 'square' ? 'btn-primary' : 'btn-light'} p-2`}
              onClick={() => handleShapeSelect('square')}
              disabled={placementState !== null || drawingState !== null}
              title="Draw Square"
              style={{ width: '48px', height: '48px', border: '1px solid #dee2e6' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" />
              </svg>
            </button>
            <button
              className={`btn ${selectedMode === 'draw' ? 'btn-primary' : 'btn-light'} p-2`}
              onClick={handleDrawSelect}
              disabled={placementState !== null || drawingState !== null}
              title="Free Draw"
              style={{ width: '48px', height: '48px', border: '1px solid #dee2e6' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
              </svg>
            </button>
            <div style={{ borderTop: '1px solid #dee2e6', margin: '4px 0' }}></div>
            <button
              className="btn btn-light p-2"
              onClick={handleClearAll}
              disabled={paths.length === 0}
              title="Clear All"
              style={{ width: '48px', height: '48px', border: '1px solid #dee2e6' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Instructions at bottom left */}
      <div className="position-absolute bottom-0 start-0 m-3" style={{ zIndex: 1000, maxWidth: '300px' }}>
        <div className="bg-white rounded shadow p-3">
          <small className="text-muted">{getTooltipText()}</small>
          {paths.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid #dee2e6', margin: '8px 0' }}></div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {paths.map((path, index) => (
                  <div
                    key={path.id}
                    className={`d-flex align-items-center justify-content-between p-2 mb-1 rounded ${
                      selectedPathId === path.id ? 'bg-primary bg-opacity-10' : 'bg-light'
                    }`}
                    style={{ cursor: 'pointer', border: '1px solid #dee2e6' }}
                    onClick={() => handleSelectPath(path.id)}
                  >
                    <div className="d-flex align-items-center">
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          backgroundColor: path.color,
                          borderRadius: '3px',
                          marginRight: '8px'
                        }}
                      />
                      <small>Path {index + 1}</small>
                    </div>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePath(path.id);
                      }}
                      style={{ padding: '2px 8px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
