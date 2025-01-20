import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from the mobile directory
app.use(express.static(join(__dirname, 'www')));

// Serve the main HTML file for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'www', 'index.html'));
});

app.listen(port, () => {
  console.log(`Mobile app server running at http://localhost:${port}`);
});