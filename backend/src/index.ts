import express from 'express';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const secretManagerClient = new SecretManagerServiceClient();

async function accessSecretVersion() {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: process.env.SECRET_NAME,
  });

  const payload = version.payload?.data?.toString();
  return payload;
}

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

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
