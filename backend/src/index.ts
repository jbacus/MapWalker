import express from 'express';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

console.log(`Starting backend server...`);
console.log(`PORT environment variable: ${process.env.PORT}`);
console.log(`Will listen on port: ${port}`);

const secretManagerClient = new SecretManagerServiceClient();

async function accessSecretVersion() {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: process.env.SECRET_NAME,
  });

  const payload = version.payload?.data?.toString();
  return payload;
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

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Backend server listening on port ${port}`);
  console.log(`Server is ready to accept connections`);
});

server.on('error', (error: any) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
