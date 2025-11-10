// Obsolete: This serverless function is no longer used.
// The chat proxy runs in Backend/server.js and should be deployed separately (e.g., on Render).
export default function handler(req, res) {
  res.status(410).json({ error: 'Gone', message: 'Use Backend/server.js at /api/chat on your backend service.' });
}
