# What Three Words + AI Poetry Feature

## Overview

Integrate What Three Words API to capture location addresses for each waypoint on walking routes, then use Google Gemini AI to generate poetic narratives that incorporate these three-word combinations, creating a unique artistic representation of each journey.

## Feature Goals

- **Location Poetry**: Transform geographical coordinates into memorable three-word addresses
- **Journey Narrative**: Generate AI poems that tell the story of each route
- **Creative Engagement**: Add artistic dimension to functional walking directions
- **Shareability**: Enable users to share both the route and its poetic representation

## Architecture

### API Services

#### What Three Words API
- **Provider**: What3Words.com
- **Pricing**: Free tier - 25,000 requests/month
- **Endpoint**: `https://api.what3words.com/v3/convert-to-3wa`
- **Authentication**: API key stored in Google Secret Manager
- **Rate Limit**: TBD (check documentation)

#### Google Gemini AI
- **Model**: Gemini 1.5 Flash
- **Provider**: Google Vertex AI (GCP)
- **Pricing**: Free tier - 15 requests/minute, then ~$0.00001 per poem
- **Authentication**: Application Default Credentials (existing GCP setup)
- **Rate Limit**: 15 requests/minute (free tier)

## Implementation Plan

### Phase 1: API Keys & Configuration

#### 1.1 What Three Words Setup
```bash
# Register at https://what3words.com/select-plan
# Choose free tier (25k requests/month)
# Get API key from dashboard

# Store in Google Secret Manager
echo -n "YOUR_W3W_API_KEY" | gcloud secrets create W3W_API_KEY --data-file=-

# Grant access to backend service account
gcloud secrets add-iam-policy-binding W3W_API_KEY \
  --member="serviceAccount:map-art-backend-sa@mapwalker-477518.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 1.2 Google Gemini Setup
```bash
# Enable Vertex AI API (if not already enabled)
gcloud services enable aiplatform.googleapis.com

# Grant Vertex AI access to backend service account
gcloud projects add-iam-policy-binding mapwalker-477518 \
  --member="serviceAccount:map-art-backend-sa@mapwalker-477518.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

#### 1.3 Update cloudbuild.yaml
```yaml
# Add W3W_API_KEY to backend deployment
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: bash
  args:
    - '-c'
    - |
      gcloud run deploy map-art-backend \
        --set-secrets=W3W_API_KEY=W3W_API_KEY:latest \
        # ... other flags
```

### Phase 2: Backend Implementation

#### 2.1 Install Dependencies

**backend/package.json**:
```json
{
  "dependencies": {
    "@what3words/api": "^5.0.0",
    "@google-cloud/vertexai": "^1.0.0"
  }
}
```

#### 2.2 New Backend Endpoints

**backend/src/index.ts**:

##### Endpoint 1: Get Three Words
```typescript
// POST /api/get-three-words
// Request Body:
{
  "waypoints": [
    { "lat": 37.7749, "lng": -122.4194 },
    { "lat": 37.7750, "lng": -122.4195 }
    // ... more waypoints
  ]
}

// Response:
{
  "threeWords": [
    "index.home.raft",
    "clips.atom.trend"
    // ... corresponding three-word addresses
  ]
}
```

**Implementation**:
```typescript
import What3wordsClient from '@what3words/api';

const w3wClient = new What3wordsClient({
  apiKey: await getW3WApiKey()
});

app.post('/api/get-three-words', async (req, res) => {
  try {
    const { waypoints } = req.body;

    if (!waypoints || !Array.isArray(waypoints)) {
      return res.status(400).json({ error: 'Invalid waypoints' });
    }

    const threeWords = await Promise.all(
      waypoints.map(async (point) => {
        const result = await w3wClient.convertTo3wa({
          coordinates: { lat: point.lat, lng: point.lng }
        });
        return result.words;
      })
    );

    res.json({ threeWords });
  } catch (error) {
    console.error('Error fetching three words:', error);
    res.status(500).json({ error: 'Failed to fetch three words' });
  }
});
```

##### Endpoint 2: Generate Poem
```typescript
// POST /api/generate-poem
// Request Body:
{
  "threeWords": ["index.home.raft", "clips.atom.trend"],
  "pathName": "Path 1",
  "distance": "2.5 km",
  "travelMode": "WALKING"
}

// Response:
{
  "poem": "Starting at index.home.raft...\n...",
  "title": "A Journey Through Silicon Valley",
  "style": "narrative"
}
```

**Implementation**:
```typescript
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: 'us-central1'
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-flash'
});

app.post('/api/generate-poem', async (req, res) => {
  try {
    const { threeWords, pathName, distance, travelMode } = req.body;

    const prompt = `Create a poetic journey using these What Three Words addresses from a ${travelMode.toLowerCase()} route:

Route: ${pathName}
Distance: ${distance}
Three Word Addresses: ${threeWords.join(', ')}

Write an 8-12 line poem that:
- Incorporates all or most of the three-word combinations naturally
- Tells a story of the journey from start to finish
- Captures the mood and experience of exploring these places
- Has a consistent rhythm and flow
- Uses vivid, sensory language

Style: Conversational yet lyrical, accessible yet evocative.`;

    const result = await model.generateContent(prompt);
    const poem = result.response.candidates[0].content.parts[0].text;

    // Generate title with separate prompt
    const titlePrompt = `Based on this poem about a walking route, suggest a short, evocative title (3-6 words):\n\n${poem}`;
    const titleResult = await model.generateContent(titlePrompt);
    const title = titleResult.response.candidates[0].content.parts[0].text.trim();

    res.json({
      poem: poem.trim(),
      title: title,
      style: 'narrative'
    });
  } catch (error) {
    console.error('Error generating poem:', error);
    res.status(500).json({ error: 'Failed to generate poem' });
  }
});
```

##### Helper: Get W3W API Key
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

async function getW3WApiKey(): Promise<string> {
  const [version] = await secretClient.accessSecretVersion({
    name: 'projects/mapwalker-477518/secrets/W3W_API_KEY/versions/latest'
  });
  return version.payload?.data?.toString() || '';
}
```

### Phase 3: Frontend Implementation

#### 3.1 Update App State

**src/App.tsx**:
```typescript
type PathPoetry = {
  threeWords: string[];
  poem: string | null;
  poemTitle: string | null;
  isGenerating: boolean;
  error: string | null;
};

const [pathPoetry, setPathPoetry] = useState<Map<string, PathPoetry>>(new Map());
const [showPoetryPanel, setShowPoetryPanel] = useState(false);
```

#### 3.2 Three Words Fetching

**Fetch on Path Selection**:
```typescript
useEffect(() => {
  if (!selectedPathId) return;

  const selectedPath = paths.find(p => p.id === selectedPathId);
  if (!selectedPath || pathPoetry.has(selectedPathId)) return;

  // Fetch three words for waypoints
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
        threeWords: data.threeWords,
        poem: null,
        poemTitle: null,
        isGenerating: false,
        error: null
      }));
    } catch (error) {
      console.error('Error fetching three words:', error);
    }
  };

  fetchThreeWords();
}, [selectedPathId, paths]);
```

#### 3.3 Poetry Panel Component

**src/PoetryPanel.tsx**:
```typescript
import React from 'react';

interface PoetryPanelProps {
  pathName: string;
  distance: string;
  threeWords: string[];
  poem: string | null;
  poemTitle: string | null;
  isGenerating: boolean;
  onGeneratePoem: () => void;
  onClose: () => void;
}

export function PoetryPanel({
  pathName,
  distance,
  threeWords,
  poem,
  poemTitle,
  isGenerating,
  onGeneratePoem,
  onClose
}: PoetryPanelProps) {
  const handleCopyPoem = () => {
    if (poem) {
      navigator.clipboard.writeText(`${poemTitle}\n\n${poem}`);
    }
  };

  return (
    <div
      className="position-absolute bg-white rounded shadow"
      style={{
        top: '20px',
        right: '80px',
        width: '400px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        zIndex: 1002
      }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">🎭 Route Poetry</h6>
          <button
            className="btn btn-sm btn-light"
            onClick={onClose}
            style={{ padding: '2px 8px' }}
          >
            ×
          </button>
        </div>

        {/* Route Info */}
        <div className="mb-3">
          <small className="text-muted">
            {pathName} • {distance}
          </small>
        </div>

        {/* Three Words Chips */}
        <div className="mb-3">
          <small className="text-muted d-block mb-2">Location markers:</small>
          <div className="d-flex flex-wrap gap-1">
            {threeWords.map((words, index) => (
              <span
                key={index}
                className="badge bg-light text-dark"
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  border: '1px solid #dee2e6'
                }}
              >
                {words}
              </span>
            ))}
          </div>
        </div>

        {/* Poem Display */}
        {poem ? (
          <div className="mb-3">
            <div
              className="p-3 rounded"
              style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6'
              }}
            >
              {poemTitle && (
                <h6 className="mb-3 text-center" style={{ fontStyle: 'italic' }}>
                  {poemTitle}
                </h6>
              )}
              <div style={{ whiteSpace: 'pre-line', fontSize: '14px', lineHeight: '1.6' }}>
                {poem}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-3 text-center py-4">
            <small className="text-muted">
              Generate a poem to capture the essence of this journey
            </small>
          </div>
        )}

        {/* Action Buttons */}
        <div className="d-flex gap-2">
          <button
            className="btn btn-primary btn-sm flex-grow-1"
            onClick={onGeneratePoem}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Generating...
              </>
            ) : poem ? (
              'Regenerate Poem'
            ) : (
              'Generate Poem'
            )}
          </button>
          {poem && (
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleCopyPoem}
              title="Copy to clipboard"
            >
              📋
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 3.4 Generate Poem Handler

**src/App.tsx**:
```typescript
const handleGeneratePoem = async () => {
  if (!selectedPathId) return;

  const selectedPath = paths.find(p => p.id === selectedPathId);
  const poetry = pathPoetry.get(selectedPathId);
  if (!selectedPath || !poetry) return;

  // Get route info
  const selectedRoute = routeAlternatives.find(r => r.mode === selectedTravelMode);
  const distance = selectedRoute?.directions?.routes[0]?.legs[0]?.distance?.text || 'Unknown';

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

    setShowPoetryPanel(true);
  } catch (error) {
    console.error('Error generating poem:', error);
    setPathPoetry(prev => new Map(prev).set(selectedPathId, {
      ...poetry,
      isGenerating: false,
      error: 'Failed to generate poem'
    }));
  }
};
```

#### 3.5 Add Poetry Button to Navigation Panel

**src/App.tsx** (in navigation panel):
```tsx
{/* Add after route summary */}
<div className="mb-3">
  <button
    className="btn btn-outline-primary btn-sm w-100"
    onClick={handleGeneratePoem}
    disabled={!pathPoetry.get(selectedPathId)?.threeWords}
  >
    🎭 View Route Poetry
  </button>
</div>
```

#### 3.6 Render Poetry Panel

**src/App.tsx** (in render):
```tsx
{/* Poetry panel */}
{showPoetryPanel && selectedPathId && pathPoetry.has(selectedPathId) && (() => {
  const poetry = pathPoetry.get(selectedPathId)!;
  const selectedPath = paths.find(p => p.id === selectedPathId);
  const selectedRoute = routeAlternatives.find(r => r.mode === selectedTravelMode);
  const distance = selectedRoute?.directions?.routes[0]?.legs[0]?.distance?.text || 'Unknown';

  return (
    <PoetryPanel
      pathName={`Path ${paths.indexOf(selectedPath!) + 1}`}
      distance={distance}
      threeWords={poetry.threeWords}
      poem={poetry.poem}
      poemTitle={poetry.poemTitle}
      isGenerating={poetry.isGenerating}
      onGeneratePoem={handleGeneratePoem}
      onClose={() => setShowPoetryPanel(false)}
    />
  );
})()}
```

## Prompt Engineering

### Poem Generation Prompt Structure

```
Create a poetic journey using these What Three Words addresses from a {mode} route:

Route: {pathName}
Distance: {distance}
Three Word Addresses: {threeWords.join(', ')}

Write an 8-12 line poem that:
- Incorporates all or most of the three-word combinations naturally
- Tells a story of the journey from start to finish
- Captures the mood and experience of exploring these places
- Has a consistent rhythm and flow
- Uses vivid, sensory language

Style: Conversational yet lyrical, accessible yet evocative.
```

### Prompt Variations (Future Enhancement)

**Haiku Style**:
```
Create a haiku for each major waypoint using these three-word addresses:
{threeWords}

Each haiku should capture the essence of that location.
```

**Sonnet Style**:
```
Write a Shakespearean sonnet about this journey...
```

**Limerick Style**:
```
Create a playful limerick incorporating these locations...
```

## UI/UX Design

### Poetry Panel Layout

```
┌────────────────────────────────────┐
│ 🎭 Route Poetry              [×]   │
├────────────────────────────────────┤
│ Path 1 • 2.5 km                    │
│                                    │
│ Location markers:                  │
│ [index.home.raft] [clips.atom...]  │
│ [green.tree.tall] [happy.bird...]  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │   Journey Through the City     │ │
│ │                                │ │
│ │ From index.home.raft we start, │ │
│ │ Through clips.atom.trend we go │ │
│ │ To green.tree.tall, a new part │ │
│ │ Where happy.bird.song does flow│ │
│ │ ...                            │ │
│ └────────────────────────────────┘ │
│                                    │
│ [Generate Poem] [📋 Copy]          │
└────────────────────────────────────┘
```

### Styling Guidelines

- **Font**: System font for UI, Georgia/serif for poem
- **Colors**: Match path color in border/accents
- **Spacing**: Generous padding for readability
- **Animation**: Gentle fade-in when poem generates
- **Mobile**: Collapsible on small screens

## Cost Analysis

### API Costs (per route)

| Service | Cost per Request | Monthly Free Tier | Cost @ 1000 routes/month |
|---------|-----------------|-------------------|--------------------------|
| What3Words | $0.00 | 25,000 requests | $0.00 |
| Gemini Flash | ~$0.00001 | 15 RPM unlimited | $0.01 |
| **Total** | **~$0.00001** | **Effective free** | **$0.01** |

### Scalability Notes

- Cache poems by path geometry hash to avoid regeneration
- Implement rate limiting on frontend to respect API limits
- Consider batch W3W requests if API supports it
- Monitor Gemini token usage (typically ~500 tokens/poem)

## Future Enhancements

### Phase 2 Features

1. **Poetry Styles**: Let users choose haiku, sonnet, limerick, etc.
2. **Share Feature**: Export poem + map as image
3. **Text-to-Speech**: Read poem aloud with natural voice
4. **Poetry History**: Save favorite poems
5. **Community Poems**: Share poems with other users
6. **Translation**: Generate poems in multiple languages
7. **Custom Prompts**: Let users customize the poetry style

### Phase 3 Features

1. **NFT Minting**: Turn poems + routes into NFTs
2. **Audio Poetry**: Generate ambient music to accompany poem
3. **Route Recommendations**: Suggest routes based on poetic themes
4. **Collaborative Poems**: Multiple users contribute lines

## Testing Strategy

### Unit Tests

- Test W3W coordinate conversion accuracy
- Test poem generation with various waypoint counts
- Test error handling for failed API calls
- Test three-word address caching

### Integration Tests

- Test full flow: select path → fetch W3W → generate poem
- Test rate limiting behavior
- Test concurrent poem generation
- Test with routes of varying lengths (2-25 waypoints)

### User Testing

- Test poem quality with real users
- A/B test different prompt styles
- Gather feedback on panel UX
- Test on mobile devices

## Deployment Checklist

- [ ] Register What3Words account
- [ ] Store W3W API key in Secret Manager
- [ ] Enable Vertex AI API
- [ ] Grant IAM permissions
- [ ] Update backend with new endpoints
- [ ] Add npm dependencies
- [ ] Update frontend with Poetry Panel
- [ ] Test in development
- [ ] Deploy to production
- [ ] Monitor API usage
- [ ] Set up error alerting

## Success Metrics

- **Adoption Rate**: % of users who generate at least one poem
- **Engagement**: Average poems generated per session
- **Quality**: User ratings of poem quality
- **Sharing**: Number of poems shared/copied
- **Performance**: Average generation time < 3 seconds
- **Cost**: Stay within free tier limits

## Documentation Links

- [What3Words API Docs](https://developer.what3words.com/public-api)
- [Google Gemini API Docs](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [React Bootstrap Docs](https://react-bootstrap.github.io/)

---

**Status**: Ready for implementation
**Priority**: Medium
**Estimated Time**: 4-6 hours
**Dependencies**: Working map application with path selection
