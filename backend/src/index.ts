import express from 'express';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

console.log(`Starting backend server...`);
console.log(`PORT environment variable: ${process.env.PORT}`);
console.log(`Will listen on port: ${port}`);

// Parse JSON bodies
app.use(express.json());

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const secretManagerClient = new SecretManagerServiceClient();

async function accessSecretVersion() {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: process.env.SECRET_NAME,
  });

  const payload = version.payload?.data?.toString();
  return payload;
}

async function getClaudeApiKey() {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: 'projects/mapwalker-477518/secrets/CLAUDE_API_KEY/versions/latest',
  });

  const payload = version.payload?.data?.toString();
  return payload || '';
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/api/get-api-key', async (req, res) => {
  try {
    const apiKey = await accessSecretVersion();
    if (apiKey) {
      res.json({ apiKey });
    } else {
      res.status(500).json({ error: 'Could not retrieve API key' });
    }
  } catch (error) {
    console.error('Error accessing secret:', error);
    res.status(500).json({ error: 'Could not retrieve API key' });
  }
});

// Helper function to extract poetic words from geocoding results
function extractPoeticWords(geocodeResult: any): string[] {
  const words: string[] = [];

  if (!geocodeResult || !geocodeResult.address_components) {
    return words;
  }

  // Extract from address components
  for (const component of geocodeResult.address_components) {
    const types = component.types;
    const name = component.long_name;

    // Skip numbers and generic terms
    if (/^\d+$/.test(name)) continue;
    if (['USA', 'United States', 'US'].includes(name)) continue;

    // Prioritize poetic location types
    if (types.includes('neighborhood') ||
        types.includes('sublocality') ||
        types.includes('natural_feature') ||
        types.includes('park') ||
        types.includes('point_of_interest')) {
      words.push(name);
    } else if (types.includes('route')) {
      // Extract interesting words from street names
      const streetWords = name.split(/\s+/)
        .filter((w: string) => !['Street', 'Avenue', 'Road', 'Boulevard', 'Drive', 'Lane', 'Way', 'Court', 'Place'].includes(w))
        .filter((w: string) => w.length > 2);
      words.push(...streetWords);
    } else if (types.includes('locality')) {
      words.push(name);
    }
  }

  return words;
}

// Location words endpoint (replaces What3Words)
app.post('/api/get-three-words', async (req, res) => {
  try {
    const { waypoints } = req.body;

    if (!waypoints || !Array.isArray(waypoints)) {
      return res.status(400).json({ error: 'Invalid waypoints' });
    }

    // Get Google Maps API key
    const mapsApiKey = await accessSecretVersion();
    if (!mapsApiKey) {
      return res.status(500).json({ error: 'Maps API key not configured' });
    }

    // Sample waypoints - take start, end, and evenly distributed points
    const maxWaypoints = 7;
    let sampledWaypoints = waypoints;

    if (waypoints.length > maxWaypoints) {
      sampledWaypoints = [];
      sampledWaypoints.push(waypoints[0]); // Start

      const step = (waypoints.length - 1) / (maxWaypoints - 1);
      for (let i = 1; i < maxWaypoints - 1; i++) {
        const index = Math.round(i * step);
        sampledWaypoints.push(waypoints[index]);
      }

      sampledWaypoints.push(waypoints[waypoints.length - 1]); // End
    }

    console.log(`Sampling ${sampledWaypoints.length} waypoints from ${waypoints.length} total`);

    // Fetch location words using reverse geocoding
    const locationPhrases = await Promise.all(
      sampledWaypoints.map(async (point: { lat: number; lng: number }, index: number) => {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${point.lat},${point.lng}&key=${mapsApiKey}`;
          const response = await fetch(url);
          const data = await response.json();

          if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            console.error('Geocoding failed:', data.status);
            return 'journey.continues';
          }

          // Extract poetic words from the first result
          const words = extractPoeticWords(data.results[0]);

          // If we got words, combine 2-3 of them
          if (words.length >= 2) {
            // Take first 2-3 unique words
            const uniqueWords = [...new Set(words)].slice(0, 3);
            return uniqueWords.join('.').toLowerCase().replace(/\s+/g, '.');
          } else if (words.length === 1) {
            return words[0].toLowerCase().replace(/\s+/g, '.');
          }

          // Fallback: use a positional descriptor
          if (index === 0) return 'journey.begins';
          if (index === sampledWaypoints.length - 1) return 'journey.ends';
          return 'path.continues';

        } catch (error) {
          console.error('Error reverse geocoding waypoint:', error);
          return 'waypoint.marker';
        }
      })
    );

    res.json({ threeWords: locationPhrases });
  } catch (error) {
    console.error('Error fetching location words:', error);
    res.status(500).json({ error: 'Failed to fetch location words' });
  }
});

// Generate poem endpoint
app.post('/api/generate-poem', async (req, res) => {
  try {
    const { threeWords, pathName, distance, travelMode } = req.body;

    if (!threeWords || !Array.isArray(threeWords) || threeWords.length === 0) {
      return res.status(400).json({ error: 'Invalid threeWords' });
    }

    const prompt = `Create a poetic journey inspired by these location phrases from a ${travelMode?.toLowerCase() || 'walking'} route:

Route: ${pathName || 'Unnamed Route'}
Distance: ${distance || 'Unknown distance'}
Location Markers: ${threeWords.join(', ')}

These phrases are derived from real place names, neighborhoods, and landmarks along the route.

Write an 8-12 line poem that:
- Weaves the location words and themes naturally into the narrative
- Tells a story of the journey from start to finish
- Captures the mood and experience of exploring these places
- Has a consistent rhythm and flow
- Uses vivid, sensory language that evokes the sense of place

Style: Conversational yet lyrical, accessible yet evocative. Let the place names inspire imagery and emotion.`;

    // Get Claude API key
    const claudeApiKey = await getClaudeApiKey();
    if (!claudeApiKey) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }

    const anthropic = new Anthropic({
      apiKey: claudeApiKey,
    });

    // Generate poem using Claude
    const poemResponse = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const poem = poemResponse.content[0].type === 'text'
      ? poemResponse.content[0].text
      : 'Could not generate poem';

    // Generate title with separate prompt
    const titlePrompt = `Based on this poem about a walking route, suggest a short, evocative title (3-6 words):\n\n${poem}`;
    const titleResponse = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: titlePrompt
      }]
    });

    const title = titleResponse.content[0].type === 'text'
      ? titleResponse.content[0].text.trim()
      : 'A Journey';

    res.json({
      poem: poem.trim(),
      title: title.replace(/["""]/g, '').trim(),
      style: 'narrative'
    });
  } catch (error) {
    console.error('Error generating poem:', error);
    res.status(500).json({ error: 'Failed to generate poem' });
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Backend server listening on port ${port}`);
  console.log(`Server is ready to accept connections`);
});

server.on('error', (error: any) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
