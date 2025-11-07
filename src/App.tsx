import { useState } from 'react';
import Map from './Map';
import { Button, ButtonGroup, Container } from 'react-bootstrap';
import { generateShape } from './path-generator';

function App() {
  const [path, setPath] = useState<google.maps.LatLng[]>([]);
  const [shape, setShape] = useState<string | null>(null);

  const generatePath = () => {
    if (shape) {
      const center = { lat: 37.7749, lng: -122.4194 }; // Same as in Map.tsx
      const newPath = generateShape(shape, center);
      setPath(newPath);
    }
  };

  return (
    <div>
      <Map path={path} />
      <Container className="position-absolute top-0 start-50 translate-middle-x mt-3">
        <h1 className="text-center">Map Art</h1>
        <div className="d-flex justify-content-center">
          <ButtonGroup className="mb-3">
            <Button variant="secondary" onClick={() => setShape('circle')}>Circle</Button>
            <Button variant="secondary" onClick={() => setShape('square')}>Square</Button>
          </ButtonGroup>
        </div>
        <div className="d-flex justify-content-center">
          <Button onClick={generatePath} disabled={!shape}>
            Generate Path
          </Button>
        </div>
      </Container>
    </div>
  );
}

export default App;
