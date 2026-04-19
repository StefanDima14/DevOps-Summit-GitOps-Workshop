const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const GREETING = process.env.GREETING || 'Space Explorer';
const THEME_ACCENT = process.env.THEME_ACCENT || '#c084fc';
const API_TOKEN = process.env.API_TOKEN || '';
const PREMIUM = API_TOKEN.length > 0;

const baseImages = [
  { url: 'https://images-assets.nasa.gov/image/PIA12235/PIA12235~medium.jpg', title: 'Galactic Wonder' },
  { url: 'https://images-assets.nasa.gov/image/PIA17005/PIA17005~medium.jpg', title: 'Distant Nebula' },
  { url: 'https://images-assets.nasa.gov/image/PIA23122/PIA23122~medium.jpg', title: 'Martian Landscape' },
  { url: 'https://images-assets.nasa.gov/image/PIA22568/PIA22568~medium.jpg', title: 'Saturn Rings' },
  { url: 'https://images-assets.nasa.gov/image/PIA21421/PIA21421~medium.jpg', title: 'Jovian Storm' },
  { url: 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~medium.jpg', title: 'Deep Space Probe' },
  { url: 'https://images-assets.nasa.gov/image/PIA00452/PIA00452~medium.jpg', title: 'Lunar Surface' }
];

const premiumImages = [
  { url: 'https://images-assets.nasa.gov/image/PIA13005/PIA13005~medium.jpg', title: '⭐ Stellar Nursery' },
  { url: 'https://images-assets.nasa.gov/image/PIA15415/PIA15415~medium.jpg', title: '⭐ Helix Nebula' },
  { url: 'https://images-assets.nasa.gov/image/PIA03519/PIA03519~medium.jpg', title: '⭐ Andromeda' }
];

const baseFacts = [
  'A day on Venus is longer than a year on Venus.',
  'Neutron stars can spin 600 times per second.',
  'The Sun accounts for 99.86% of the mass in the Solar System.',
  'Jupiter has 95 known moons.',
  'One million Earths could fit inside the Sun.',
  'Saturn would float if you could find a bathtub big enough.'
];

const premiumFacts = [
  '⭐ Light from Andromeda takes 2.5 million years to reach us.',
  '⭐ A teaspoon of neutron star material weighs ~6 billion tons.'
];

app.get('/api/image', (req, res) => {
  const pool = PREMIUM ? baseImages.concat(premiumImages) : baseImages;
  const facts = PREMIUM ? baseFacts.concat(premiumFacts) : baseFacts;
  const img = pool[Math.floor(Math.random() * pool.length)];
  const fact = facts[Math.floor(Math.random() * facts.length)];
  res.json({ ...img, fact });
});

app.get('/api/config', (_req, res) => {
  res.json({ greeting: GREETING, themeAccent: THEME_ACCENT, premium: PREMIUM, version: 'v3' });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: 'v3' }));

app.listen(3000, () => console.log(`backend v3 listening on 3000 (premium=${PREMIUM})`));
