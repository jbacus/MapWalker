import express from 'express';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { VertexAI } from '@google-cloud/vertexai';
import What3wordsClient from '@what3words/api';
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

async function getW3WApiKey() {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: 'projects/mapwalker-477518/secrets/W3W_API_KEY/versions/latest',
  });

  const payload = version.payload?.data?.toString();
  return payload || '';
}

// Initialize Vertex AI for Gemini
const vertexAI = new VertexAI({
  project: 'mapwalker-477518',
  location: 'us-central1'
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-flash'
});

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

// What3Words endpoint
app.post('/api/get-three-words', async (req, res) => {
  try {
    const { waypoints } = req.body;

    if (!waypoints || !Array.isArray(waypoints)) {
      return res.status(400).json({ error: 'Invalid waypoints' });
    }

    // Get W3W API key
    const w3wApiKey = await getW3WApiKey();
    if (!w3wApiKey) {
      return res.status(500).json({ error: 'W3W API key not configured' });
    }

    const w3wClient = new What3wordsClient({
      apiKey: w3wApiKey
    });

    // Fetch three-word addresses for all waypoints
    const threeWords = await Promise.all(
      waypoints.map(async (point: { lat: number; lng: number }) => {
        try {
          const result = await w3wClient.convertTo3wa({
            coordinates: { lat: point.lat, lng: point.lng }
          });
          return result.words;
        } catch (error) {
          console.error('Error converting waypoint to 3wa:', error);
          return 'error.error.error';
        }
      })
    );

    res.json({ threeWords });
  } catch (error) {
    console.error('Error fetching three words:', error);
    res.status(500).json({ error: 'Failed to fetch three words' });
  }
});

// Generate poem endpoint
app.post('/api/generate-poem', async (req, res) => {
  try {
    const { threeWords, pathName, distance, travelMode } = req.body;

    if (!threeWords || !Array.isArray(threeWords) || threeWords.length === 0) {
      return res.status(400).json({ error: 'Invalid threeWords' });
    }

    const prompt = `Create a poetic journey using these What Three Words addresses from a ${travelMode?.toLowerCase() || 'walking'} route:

Route: ${pathName || 'Unnamed Route'}
Distance: ${distance || 'Unknown distance'}
Three Word Addresses: ${threeWords.join(', ')}

Write an 8-12 line poem that:
- Incorporates all or most of the three-word combinations naturally
- Tells a story of the journey from start to finish
- Captures the mood and experience of exploring these places
- Has a consistent rhythm and flow
- Uses vivid, sensory language

Style: Conversational yet lyrical, accessible yet evocative.`;

    const result = await model.generateContent(prompt);
    const poem = result.response.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate poem';

    // Generate title with separate prompt
    const titlePrompt = `Based on this poem about a walking route, suggest a short, evocative title (3-6 words):\n\n${poem}`;
    const titleResult = await model.generateContent(titlePrompt);
    const title = titleResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'A Journey';

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
