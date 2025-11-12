import { useState, useEffect } from 'react';
import MapComponent from './Map';
import { Button, ButtonGroup, Container } from 'react-bootstrap';
import { generateCircleFromThreePoints, generateSquareFromTwoPoints, resamplePath } from './path-generator';
import { PoetryPanel } from './PoetryPanel';

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
  idealShape?: google.maps.LatLng[]; // Original geometric shape before street snapping
  color: string;
};

type RouteInfo = {
  mode: google.maps.TravelMode;
  directions: google.maps.DirectionsResult | null;
};

type PathPoetry = {
  threeWords: string[];
  poem: string | null;
  poemTitle: string | null;
  isGenerating: boolean;
  error: string | null;
};

function App() {
  const [paths, setPaths] = useState<PathData[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'circle' | 'square' | 'draw' | null>(null);
  const [placementState, setPlacementState] = useState<PlacementState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 37.7749, lng: -122.4194 });
  const [routeAlternatives, setRouteAlternatives] = useState<RouteInfo[]>([]);
  const [selectedTravelMode, setSelectedTravelMode] = useState<google.maps.TravelMode | null>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [navigationMinimized, setNavigationMinimized] = useState(false);
  const [pathPoetry, setPathPoetry] = useState<Map<string, PathPoetry>>(new Map());
  const [showPoetryPanel, setShowPoetryPanel] = useState(false);
  const [poetryMinimized, setPoetryMinimized] = useState(false);

  const generatePathId = () => `path-${Date.now()}-${Math.random()}`;

  const getPathColor = (index: number) => {
    const colors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D00', '#46BDC6'];
    return colors[index % colors.length];
  };

  const calculateTotalDistance = (directions: google.maps.DirectionsResult | null | undefined): string => {
    if (!directions?.routes[0]?.legs) return 'Unknown';

    const legs = directions.routes[0].legs;
    const totalMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);

    if (totalMeters === 0) return 'Unknown';

    const miles = totalMeters * 0.000621371;

    // Show in miles if >= 0.1 mi, otherwise in feet
    return miles >= 0.1
      ? `${miles.toFixed(1)} mi`
      : `${(totalMeters * 3.28084).toFixed(0)} ft`;
  };

  // Fetch alternative routes when a path is selected
  useEffect(() => {
    if (!selectedPathId || !window.google) {
      setRouteAlternatives([]);
      setShowNavigation(false);
      return;
    }

    const selectedPath = paths.find(p => p.id === selectedPathId);
    if (!selectedPath || selectedPath.points.length < 2) {
      setRouteAlternatives([]);
      setShowNavigation(false);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    const travelModes = [
      google.maps.TravelMode.WALKING,
      google.maps.TravelMode.TRANSIT,
      google.maps.TravelMode.BICYCLING,
      google.maps.TravelMode.DRIVING
    ];

    const fetchRoutes = async () => {
      const routes: RouteInfo[] = [];

      for (const mode of travelModes) {
        try {
          const waypoints = selectedPath.points.slice(1, selectedPath.points.length - 1)
            .map(p => ({ location: p, stopover: true }));

          const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
            directionsService.route(
              {
                origin: selectedPath.points[0],
                destination: selectedPath.points[selectedPath.points.length - 1],
                waypoints: waypoints,
                travelMode: mode
              },
              (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result) {
                  resolve(result);
                } else {
                  reject(status);
                }
              }
            );
          });

          routes.push({ mode, directions: result });
        } catch (error) {
          // Mode not available for this route
          console.log(`${mode} not available for this route:`, error);
        }
      }

      setRouteAlternatives(routes);
      if (routes.length > 0) {
        // Set default travel mode to walking if available, otherwise first available mode
        const walkingRoute = routes.find(r => r.mode === google.maps.TravelMode.WALKING);
        setSelectedTravelMode(walkingRoute ? walkingRoute.mode : routes[0].mode);
      }
      setShowNavigation(true);
    };

    fetchRoutes();
  }, [selectedPathId, paths]);

  // Fetch three-words when path is selected
  useEffect(() => {
    if (!selectedPathId) return;

    const selectedPath = paths.find(p => p.id === selectedPathId);
    if (!selectedPath || pathPoetry.has(selectedPathId)) return;

    const fetchThreeWords = async () => {
      try {
        const backendUrl = (window as any).ENV?.BACKEND_URL || '';
        const response = await fetch(`${backendUrl}/api/get-three-words`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            waypoints: selectedPath.points.map(p => ({
              lat: p.lat(),
              lng: p.lng()
            }))
          })
        });

        const data = await response.json();

        setPathPoetry(prev => new Map(prev).set(selectedPathId, {
          threeWords: data.threeWords || [],
          poem: null,
          poemTitle: null,
          isGenerating: false,
          error: null
        }));

        // Auto-open poetry panel when three-words are fetched
        setShowPoetryPanel(true);
      } catch (error) {
        console.error('Error fetching three words:', error);
        setPathPoetry(prev => new Map(prev).set(selectedPathId, {
          threeWords: [],
          poem: null,
          poemTitle: null,
          isGenerating: false,
          error: 'Failed to fetch location markers'
        }));
      }
    };

    fetchThreeWords();
  }, [selectedPathId, paths, pathPoetry]);

  const addPath = (points: google.maps.LatLng[], idealShape?: google.maps.LatLng[]) => {
    const newPath: PathData = {
      id: generatePathId(),
      points,
      idealShape,
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
        const idealShape = generateSquareFromTwoPoints(newPoints[0], newPoints[1]);
        addPath(idealShape, idealShape); // Use ideal shape for both navigation and display
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
        const idealShape = generateCircleFromThreePoints(newPoints[0], newPoints[1], newPoints[2]);
        if (idealShape.length > 0) {
          addPath(idealShape, idealShape); // Use ideal shape for both navigation and display
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
    // Save the path if we have enough points
    if (drawingState?.isDrawing && drawingState.points.length > 1) {
      const resampledPoints = resamplePath(drawingState.points, 27);
      addPath(resampledPoints);
    }

    // Always clear drawing state and exit tool mode on mouse up (one-shot modal)
    if (drawingState) {
      setDrawingState(null);
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

  const getTravelModeLabel = (mode: google.maps.TravelMode): string => {
    switch (mode) {
      case google.maps.TravelMode.WALKING:
        return 'Walking';
      case google.maps.TravelMode.TRANSIT:
        return 'Transit';
      case google.maps.TravelMode.BICYCLING:
        return 'Cycling';
      case google.maps.TravelMode.DRIVING:
        return 'Driving';
      default:
        return mode;
    }
  };

  const getTravelModeIcon = (mode: google.maps.TravelMode): string => {
    switch (mode) {
      case google.maps.TravelMode.WALKING:
        return '🚶';
      case google.maps.TravelMode.TRANSIT:
        return '🚇';
      case google.maps.TravelMode.BICYCLING:
        return '🚴';
      case google.maps.TravelMode.DRIVING:
        return '🚗';
      default:
        return '📍';
    }
  };

  const getSelectedDirections = (): google.maps.DirectionsResult | null => {
    if (!selectedTravelMode) return null;
    const route = routeAlternatives.find(r => r.mode === selectedTravelMode);
    return route?.directions || null;
  };

  const getPreviewShape = (): google.maps.LatLng[] => {
    if (!placementState || !window.google || !window.google.maps) return [];

    try {
      if (placementState.shape === 'square' && placementState.points.length === 2) {
        // Generate preview square from two points
        return generateSquareFromTwoPoints(placementState.points[0], placementState.points[1]);
      } else if (placementState.shape === 'circle' && placementState.points.length === 3) {
        // Generate preview circle from three points
        return generateCircleFromThreePoints(placementState.points[0], placementState.points[1], placementState.points[2]);
      }
    } catch (error) {
      console.error('Error generating preview shape:', error);
      return [];
    }

    return [];
  };

  const handleGeneratePoem = async () => {
    if (!selectedPathId) return;

    const selectedPath = paths.find(p => p.id === selectedPathId);
    const poetry = pathPoetry.get(selectedPathId);
    if (!selectedPath || !poetry) return;

    // Get route info and calculate total distance
    const selectedRoute = routeAlternatives.find(r => r.mode === selectedTravelMode);
    const distance = calculateTotalDistance(selectedRoute?.directions);

    // Set generating state
    setPathPoetry(prev => new Map(prev).set(selectedPathId, {
      ...poetry,
      isGenerating: true,
      error: null
    }));

    try {
      const backendUrl = (window as any).ENV?.BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/generate-poem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threeWords: poetry.threeWords,
          pathName: `Path ${paths.indexOf(selectedPath) + 1}`,
          distance: distance,
          travelMode: selectedTravelMode || 'WALKING'
        })
      });

      const data = await response.json();

      setPathPoetry(prev => new Map(prev).set(selectedPathId, {
        ...poetry,
        poem: data.poem,
        poemTitle: data.title,
        isGenerating: false
      }));
    } catch (error) {
      console.error('Error generating poem:', error);
      setPathPoetry(prev => new Map(prev).set(selectedPathId, {
        ...poetry,
        isGenerating: false,
        error: 'Failed to generate poem'
      }));
    }
  };

  return (
    <div>
      <MapComponent
        paths={paths}
        selectedPathId={selectedPathId}
        onPathClick={handleSelectPath}
        onMapClick={handleMapClick}
        placementMarkers={placementState?.points || []}
        previewShape={getPreviewShape()}
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
            <div style={{ borderTop: '1px solid #dee2e6', margin: '4px 0' }}></div>
            <button
              className={`btn ${showNavigation ? 'btn-primary' : 'btn-light'} p-2`}
              onClick={() => {
                setShowNavigation(!showNavigation);
                if (!showNavigation) {
                  setNavigationMinimized(false);
                }
              }}
              disabled={!selectedPathId}
              title="Toggle Navigation Panel"
              style={{ width: '48px', height: '48px', border: '1px solid #dee2e6' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </button>
            <button
              className={`btn ${showPoetryPanel ? 'btn-primary' : 'btn-light'} p-2`}
              onClick={() => {
                setShowPoetryPanel(!showPoetryPanel);
                if (!showPoetryPanel) {
                  setPoetryMinimized(false);
                }
              }}
              disabled={!selectedPathId}
              title="Toggle Poetry Panel"
              style={{ width: '48px', height: '48px', border: '1px solid #dee2e6' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
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

      {/* Navigation panel */}
      {showNavigation && selectedPathId && (
        <div
          className="position-absolute top-0 start-0 m-3 bg-white rounded shadow"
          style={{
            zIndex: 1001,
            width: navigationMinimized ? 'auto' : '350px',
            maxHeight: navigationMinimized ? 'auto' : 'calc(100vh - 24px)',
            overflowY: 'auto'
          }}
        >
          <div className="p-3">
            {/* Header with minimize and close buttons */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Turn-by-Turn Directions</h6>
              <div className="d-flex gap-1">
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setNavigationMinimized(!navigationMinimized)}
                  style={{ padding: '2px 8px' }}
                  title={navigationMinimized ? "Expand" : "Minimize"}
                >
                  {navigationMinimized ? '□' : '_'}
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowNavigation(false)}
                  style={{ padding: '2px 8px' }}
                >
                  ×
                </button>
              </div>
            </div>

            {!navigationMinimized && (
              <>

            {/* Travel mode selector */}
            {routeAlternatives.length > 0 && (
              <div className="mb-3">
                <div className="d-flex gap-2 flex-wrap">
                  {routeAlternatives.map((route) => (
                    <button
                      key={route.mode}
                      className={`btn btn-sm ${
                        selectedTravelMode === route.mode ? 'btn-primary' : 'btn-outline-secondary'
                      }`}
                      onClick={() => setSelectedTravelMode(route.mode)}
                      style={{ fontSize: '12px' }}
                    >
                      {getTravelModeIcon(route.mode)} {getTravelModeLabel(route.mode)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Directions display */}
            {(() => {
              const directions = getSelectedDirections();
              if (!directions || !directions.routes || directions.routes.length === 0) {
                return <p className="text-muted">No directions available</p>;
              }

              const route = directions.routes[0];
              const legs = route.legs;

              // Calculate total distance and duration from all legs
              const totalDistance = calculateTotalDistance(directions);
              const totalDurationSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
              const totalDurationText = totalDurationSeconds > 0
                ? totalDurationSeconds >= 3600
                  ? `${Math.floor(totalDurationSeconds / 3600)} hr ${Math.floor((totalDurationSeconds % 3600) / 60)} min`
                  : `${Math.floor(totalDurationSeconds / 60)} min`
                : 'Unknown';

              // Collect all steps from all legs
              const allSteps = legs.flatMap(leg => leg.steps);

              return (
                <>
                  {/* Route summary */}
                  <div className="mb-3 p-2 bg-light rounded">
                    <div className="d-flex justify-content-between">
                      <strong>Total Distance:</strong>
                      <span>{totalDistance}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <strong>Total Duration:</strong>
                      <span>{totalDurationText}</span>
                    </div>
                  </div>

                  {/* Turn-by-turn steps */}
                  <div style={{ fontSize: '14px' }}>
                    <strong className="d-block mb-2">Steps:</strong>
                    {allSteps.map((step, index) => (
                      <div
                        key={index}
                        className="mb-3 pb-2"
                        style={{ borderBottom: '1px solid #e0e0e0' }}
                      >
                        <div className="d-flex align-items-start mb-1">
                          <div
                            className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2"
                            style={{ minWidth: '24px', height: '24px', fontSize: '12px' }}
                          >
                            {index + 1}
                          </div>
                          <div
                            dangerouslySetInnerHTML={{ __html: step.instructions }}
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div className="text-muted" style={{ fontSize: '12px', marginLeft: '32px' }}>
                          {step.distance?.text} • {step.duration?.text}
                          {step.travel_mode !== google.maps.TravelMode.WALKING && (
                            <span> • {getTravelModeIcon(step.travel_mode)} {getTravelModeLabel(step.travel_mode)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            </>
            )}
          </div>
        </div>
      )}

      {/* Poetry panel */}
      {showPoetryPanel && selectedPathId && pathPoetry.has(selectedPathId) && (() => {
        const poetry = pathPoetry.get(selectedPathId)!;
        const selectedPath = paths.find(p => p.id === selectedPathId);
        const selectedRoute = routeAlternatives.find(r => r.mode === selectedTravelMode);
        const distance = calculateTotalDistance(selectedRoute?.directions);
        const pathIndex = selectedPath ? paths.indexOf(selectedPath) + 1 : 0;

        return (
          <PoetryPanel
            pathName={`Path ${pathIndex}`}
            distance={distance}
            threeWords={poetry.threeWords}
            poem={poetry.poem}
            poemTitle={poetry.poemTitle}
            isGenerating={poetry.isGenerating}
            minimized={poetryMinimized}
            onGeneratePoem={handleGeneratePoem}
            onClose={() => setShowPoetryPanel(false)}
            onToggleMinimize={() => setPoetryMinimized(!poetryMinimized)}
          />
        );
      })()}
    </div>
  );
}

export default App;
