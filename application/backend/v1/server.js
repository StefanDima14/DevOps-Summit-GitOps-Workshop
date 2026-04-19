const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const GREETING = process.env.GREETING || 'Welcome to Space Gallery';

const images = [
  'https://images-assets.nasa.gov/image/PIA12235/PIA12235~medium.jpg',
  'https://images-assets.nasa.gov/image/PIA17005/PIA17005~medium.jpg',
  'https://images-assets.nasa.gov/image/PIA23122/PIA23122~medium.jpg',
  'https://images-assets.nasa.gov/image/PIA22568/PIA22568~medium.jpg',
  'https://images-assets.nasa.gov/image/PIA21421/PIA21421~medium.jpg'
];

app.get('/api/image', (req, res) => {
  const url = images[Math.floor(Math.random() * images.length)];
  res.json({ url });
});

app.get('/api/config', (_req, res) => {
  res.json({ greeting: GREETING, version: 'v1' });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: 'v1' }));

app.listen(3000, () => console.log('backend v1 listening on 3000'));
