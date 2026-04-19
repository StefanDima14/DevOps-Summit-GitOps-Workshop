const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const GREETING = process.env.GREETING || 'Space Gallery';
const THEME_ACCENT = process.env.THEME_ACCENT || '#ffd166';

const images = [
  { url: 'https://images-assets.nasa.gov/image/PIA12235/PIA12235~medium.jpg', title: 'Galactic Wonder' },
  { url: 'https://images-assets.nasa.gov/image/PIA17005/PIA17005~medium.jpg', title: 'Distant Nebula' },
  { url: 'https://images-assets.nasa.gov/image/PIA23122/PIA23122~medium.jpg', title: 'Martian Landscape' },
  { url: 'https://images-assets.nasa.gov/image/PIA22568/PIA22568~medium.jpg', title: 'Saturn Rings' },
  { url: 'https://images-assets.nasa.gov/image/PIA21421/PIA21421~medium.jpg', title: 'Jovian Storm' },
  { url: 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~medium.jpg', title: 'Deep Space Probe' },
  { url: 'https://images-assets.nasa.gov/image/PIA00452/PIA00452~medium.jpg', title: 'Lunar Surface' }
];

app.get('/api/image', (req, res) => {
  const img = images[Math.floor(Math.random() * images.length)];
  res.json(img);
});

app.get('/api/config', (_req, res) => {
  res.json({ greeting: GREETING, themeAccent: THEME_ACCENT, version: 'v2' });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: 'v2' }));

app.listen(3000, () => console.log('backend v2 listening on 3000'));
