export function generateShape(shape: string, center: google.maps.LatLngLiteral): google.maps.LatLng[] {
  switch (shape) {
    case 'circle':
      return generateCircle(center);
    case 'square':
      return generateSquare(center);
    default:
      return [];
  }
}

function generateCircle(center: google.maps.LatLngLiteral): google.maps.LatLng[] {
  const points: google.maps.LatLng[] = [];
  const radius = 0.02; // Adjust as needed
  // Google Maps Directions API allows max 25 waypoints (plus origin and destination)
  // So we need max 27 total points (25 waypoints + 2 endpoints)
  // Using 24 points + closing point = 25 total = 23 waypoints
  const numPoints = 24;

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const lat = center.lat + radius * Math.cos(angle);
    const lng = center.lng + radius * Math.sin(angle);
    points.push(new google.maps.LatLng(lat, lng));
  }
  points.push(points[0]); // Close the circle

  return points;
}

function generateSquare(center: google.maps.LatLngLiteral): google.maps.LatLng[] {
  const points: google.maps.LatLng[] = [];
  const halfSide = 0.02; // Adjust as needed

  points.push(new google.maps.LatLng(center.lat - halfSide, center.lng - halfSide));
  points.push(new google.maps.LatLng(center.lat + halfSide, center.lng - halfSide));
  points.push(new google.maps.LatLng(center.lat + halfSide, center.lng + halfSide));
  points.push(new google.maps.LatLng(center.lat - halfSide, center.lng + halfSide));
  points.push(new google.maps.LatLng(center.lat - halfSide, center.lng - halfSide)); // Close the square

  return points;
}
