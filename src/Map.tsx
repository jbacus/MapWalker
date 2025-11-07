import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { useState, useEffect } from 'react';

const containerStyle = {
  width: '100%',
  height: '100vh'
};

const center = {
  lat: 37.7749,
  lng: -122.4194
};

interface MapProps {
  path: google.maps.LatLng[];
}

function Map({ path }: MapProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/get-api-key')
      .then(res => res.json())
      .then(data => setApiKey(data.apiKey));
  }, []);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    preventGoogleFontsLoading: true,
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

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
    }
  }, [path, isLoaded]);

  return isLoaded ? (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
      >
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>
  ) : <></>
}

export default Map;
