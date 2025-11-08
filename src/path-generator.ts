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

// Generate a square from two corner points
// The two points define one edge of the square
export function generateSquareFromTwoPoints(
  point1: google.maps.LatLng,
  point2: google.maps.LatLng
): google.maps.LatLng[] {
  const lat1 = point1.lat();
  const lng1 = point1.lng();
  const lat2 = point2.lat();
  const lng2 = point2.lng();

  // Vector from point1 to point2
  const dx = lat2 - lat1;
  const dy = lng2 - lng1;

  // Perpendicular vector (rotated 90 degrees)
  const perpDx = -dy;
  const perpDy = dx;

  // Four corners of the square
  const corner1 = new google.maps.LatLng(lat1, lng1);
  const corner2 = new google.maps.LatLng(lat2, lng2);
  const corner3 = new google.maps.LatLng(lat2 + perpDx, lng2 + perpDy);
  const corner4 = new google.maps.LatLng(lat1 + perpDx, lng1 + perpDy);

  return [corner1, corner2, corner3, corner4, corner1];
}

// Generate a circle from three points on the circumference
// Using the circumcircle algorithm
export function generateCircleFromThreePoints(
  point1: google.maps.LatLng,
  point2: google.maps.LatLng,
  point3: google.maps.LatLng
): google.maps.LatLng[] {
  const x1 = point1.lng();
  const y1 = point1.lat();
  const x2 = point2.lng();
  const y2 = point2.lat();
  const x3 = point3.lng();
  const y3 = point3.lat();

  // Calculate the center of the circle
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  if (Math.abs(d) < 1e-10) {
    // Points are collinear, cannot form a circle
    return [];
  }

  const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / d;
  const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / d;

  // Calculate radius
  const radius = Math.sqrt((x1 - ux) ** 2 + (y1 - uy) ** 2);

  // Find the angle of point1 relative to center
  const startAngle = Math.atan2(y1 - uy, x1 - ux);

  // Generate points around the circle starting from point1
  const points: google.maps.LatLng[] = [];
  const numPoints = 24; // Stay under waypoint limit

  for (let i = 0; i < numPoints; i++) {
    const angle = startAngle + (i / numPoints) * 2 * Math.PI;
    const lat = uy + radius * Math.sin(angle);
    const lng = ux + radius * Math.cos(angle);
    points.push(new google.maps.LatLng(lat, lng));
  }

  // Close the circle by returning to the start point
  points.push(points[0]);

  return points;
}

// Resample a path to have exactly targetPoints points
// Uses uniform spacing along the path
export function resamplePath(
  originalPath: google.maps.LatLng[],
  targetPoints: number
): google.maps.LatLng[] {
  if (originalPath.length <= targetPoints) {
    return originalPath;
  }

  // Calculate cumulative distances
  const distances: number[] = [0];
  let totalDistance = 0;

  for (let i = 1; i < originalPath.length; i++) {
    const dist = calculateDistance(originalPath[i - 1], originalPath[i]);
    totalDistance += dist;
    distances.push(totalDistance);
  }

  // Calculate target spacing
  const targetSpacing = totalDistance / (targetPoints - 1);

  // Resample points at uniform intervals
  const resampledPath: google.maps.LatLng[] = [originalPath[0]];

  let currentDistance = targetSpacing;
  let pathIndex = 1;

  while (resampledPath.length < targetPoints - 1 && pathIndex < originalPath.length) {
    const segmentStart = distances[pathIndex - 1];
    const segmentEnd = distances[pathIndex];

    if (currentDistance >= segmentStart && currentDistance <= segmentEnd) {
      // Interpolate point along this segment
      const segmentLength = segmentEnd - segmentStart;
      const t = (currentDistance - segmentStart) / segmentLength;

      const lat = originalPath[pathIndex - 1].lat() + t * (originalPath[pathIndex].lat() - originalPath[pathIndex - 1].lat());
      const lng = originalPath[pathIndex - 1].lng() + t * (originalPath[pathIndex].lng() - originalPath[pathIndex - 1].lng());

      resampledPath.push(new google.maps.LatLng(lat, lng));
      currentDistance += targetSpacing;
    } else {
      pathIndex++;
    }
  }

  // Add the last point
  resampledPath.push(originalPath[originalPath.length - 1]);

  return resampledPath;
}

// Calculate distance between two LatLng points (simple Euclidean distance)
// For more accuracy, could use Haversine formula
function calculateDistance(point1: google.maps.LatLng, point2: google.maps.LatLng): number {
  const lat1 = point1.lat();
  const lng1 = point1.lng();
  const lat2 = point2.lat();
  const lng2 = point2.lng();

  return Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
}
