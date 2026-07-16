const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const SpacemanWSClient = require('./spaceman-ws');
const patternEngine = require('./pattern-engine');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS setup
app.use(cors({
  origin: '*', // Allow all origins for easy development and deployment
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../website')));

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', time: new Date() });
});

app.get('/api/analysis', (req, res) => {
  const report = patternEngine.getAnalysisReport();
  if (report) {
    res.json(report);
  } else {
    res.status(503).json({ error: 'System starting up, history not yet initialized.' });
  }
});

app.post('/api/update-session', (req, res) => {
  const { jsessionId } = req.body;
  if (!jsessionId) {
    return res.status(400).json({ error: 'jsessionId is required' });
  }
  
  console.log(`[API] Received manual session key update request. Updating cookie...`);
  wsClient.jsessionId = jsessionId;
  process.env.JSESSIONID = jsessionId;
  
  // Trigger history fetch and reconnect
  wsClient.fetchHistory();
  wsClient.connect();
  
  res.json({ success: true, message: 'Session key updated, reconnecting...' });
});

// Create Server
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log(`[Socket.IO] New client connected: ${socket.id}`);
  
  // Immediately send current analysis report if available
  const report = patternEngine.getAnalysisReport();
  if (report) {
    socket.emit('analysis_report', report);
  }

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Initialize WS Client
const wsClient = new SpacemanWSClient(io);

// Start
async function startServer() {
  console.log(`[Server] Initializing Spaceman Dashboard Backend...`);
  
  // 1. Fetch initial statistics and populate pattern engine
  await wsClient.fetchHistory();
  
  // 2. Connect to live game sockets
  wsClient.connect();
  
  // 3. Listen HTTP
  server.listen(port, () => {
    console.log(`[Server] Backend listening on port ${port}`);
    console.log(`[Server] Health check: http://localhost:${port}/api/health`);
    console.log(`[Server] Analysis API: http://localhost:${port}/api/analysis`);
  });
}

startServer().catch(err => {
  console.error('[Server] Critical startup error:', err);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down gracefully...');
  wsClient.shutdown();
  server.close(() => {
    console.log('[Server] Server closed.');
    process.exit(0);
  });
});
