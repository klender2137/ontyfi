// dotenv is used to load environment variables from a .env file.
// During development you can install it via `npm install dotenv` or
// just run `npm install` to pull all dependencies listed in package.json.
// If for some reason the package is missing (e.g. dependencies weren't
// installed yet), we catch the error so the server can still start.
let dotenvLoaded = false;

try {
  // top-level await is allowed in ESM modules
  await import('dotenv/config');
  dotenvLoaded = true;
} catch (err) {
  console.warn('dotenv package not found; continuing without loading .env');
}

import app from './app.js';

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/tree`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the other process or use a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
