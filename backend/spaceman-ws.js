const WebSocket = require('ws');
const axios = require('axios');
const dotenv = require('dotenv');
const patternEngine = require('./pattern-engine');

dotenv.config();

const TABLE_ID = process.env.TABLE_ID || 'spacemanyxe123nh';

class SpacemanWSClient {
  constructor(io) {
    this.io = io;
    this.gameWs = null;
    this.broadcastWs = null;
    this.pollInterval = null;
    this.jsessionId = process.env.JSESSIONID;
    
    // Game state tracking
    this.currentGameState = {
      status: 'WAITING', // WAITING, FLYING, CRASHED
      currentMultiplier: 1.00,
      crashMultiplier: null,
      gameId: null,
      lastUpdate: Date.now()
    };
    
    this.lastProcessedGameId = null;
    
    // Simulator watchdog tracking
    this.isSimulating = false;
    this.simTimeout = null;
    this.simInterval = null;
    this.lastLiveTickTime = Date.now();
    this.watchdogInterval = null;
  }

  // Dynamic getters for API/WebSocket URLs using current active session key
  get statsUrl() {
    return `https://games.domxyrxsfevpzjeg.net/api/ui/statisticHistory?tableId=${TABLE_ID}&numberOfGames=300&JSESSIONID=${this.jsessionId}&game_mode=lobby_desktop`;
  }
  get gameWsUrl() {
    return `wss://gs17.domxyrxsfevpzjeg.net/game?bcs=true&JSESSIONID=${encodeURIComponent(this.jsessionId)}&tableId=${TABLE_ID}`;
  }
  get broadcastWsUrl() {
    return `wss://broadcaster.domxyrxsfevpzjeg.net/broadcast?JSESSIONID=${encodeURIComponent(this.jsessionId)}&tableId=${TABLE_ID}`;
  }

  // Fetch initial history
  async fetchHistory() {
    // Attempt to automatically extract JSESSIONID from Chrome on startup
    await this.tryAutoDetectCookie();

    try {
      console.log(`[HTTP] Fetching history from statistic history API...`);
      const response = await axios.get(this.statsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://eca004.kaca189b.online/crash',
          'Origin': 'https://eca004.kaca189b.online'
        },
        timeout: 10000
      });

      if (response.data && response.data.history) {
        console.log(`[HTTP] History fetched successfully. Size: ${response.data.history.length}`);
        
        let multipliers = [];
        if (Array.isArray(response.data.history)) {
          multipliers = response.data.history.map(item => {
            if (typeof item === 'object' && item !== null) {
              return parseFloat(item.r || item.result || item.value || 1.00);
            }
            return parseFloat(item);
          }).filter(val => !isNaN(val));
        }

        if (multipliers.length > 0) {
          patternEngine.setHistory(multipliers);
          this.broadcastAnalysis();
        } else {
          console.warn(`[HTTP] Could not parse history array. Received structure:`, response.data.history.slice(0, 2));
          this.loadMockHistory();
        }
      } else {
        console.warn(`[HTTP] Unexpected history response structure. Loading fallback local data.`);
        this.loadMockHistory();
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.warn(`[HTTP] Expired session key (401). Attempting to auto-detect JSESSIONID from running Chrome browser...`);
        const detected = await this.tryAutoDetectCookie();
        if (detected) {
          console.log(`[HTTP] Auto-detected fresh cookie. Retrying history fetch...`);
          return this.fetchHistory();
        }
      }
      console.error(`[HTTP] Error fetching statistics history: ${error.message}. Loading fallback data.`);
      this.loadMockHistory();
    }
  }

  loadMockHistory() {
    // Generate logical mock history of multipliers for analysis system testing
    const mocks = [];
    for (let i = 0; i < 300; i++) {
      const rand = Math.random();
      if (rand < 0.1) mocks.push(1.00); // instant crash
      else if (rand < 0.5) mocks.push(parseFloat((1 + Math.random()).toFixed(2))); // 1.01x - 1.99x
      else if (rand < 0.85) mocks.push(parseFloat((2 + Math.random() * 5).toFixed(2))); // 2.00x - 6.99x
      else if (rand < 0.97) mocks.push(parseFloat((7 + Math.random() * 20).toFixed(2))); // 7.00x - 26.99x
      else mocks.push(parseFloat((30 + Math.random() * 100).toFixed(2))); // high multiplier
    }
    patternEngine.setHistory(mocks);
    this.broadcastAnalysis();
  }

  // Grabs active session from remote debugging Chrome instance
  async tryAutoDetectCookie() {
    try {
      const { autoDetectJSESSIONID } = require('./cookie-grabber');
      const newCookie = await autoDetectJSESSIONID();
      if (newCookie && newCookie !== this.jsessionId) {
        console.log(`[AutoDetect] Fresh session key detected! Updating active JSESSIONID to: ${newCookie}`);
        this.jsessionId = newCookie;
        process.env.JSESSIONID = newCookie;
        return true;
      }
    } catch (e) {
      console.error(`[AutoDetect] Error loading grabber module:`, e.message);
    }
    return false;
  }

  // Connect to both Websockets for maximum redundancy
  connect() {
    this.connectGameWS();
    this.connectBroadcastWS();
    this.startPollingFallback();
    this.startWatchdog();
  }

  // WS: Game Client (wss://gs17.domxyrxsfevpzjeg.net/game)
  connectGameWS() {
    console.log(`[WS] Connecting to Game WebSocket...`);
    try {
      this.gameWs = new WebSocket(this.gameWsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://games.domxyrxsfevpzjeg.net'
        }
      });

      this.gameWs.on('open', () => {
        console.log(`[WS] Connected to Spaceman Game WebSocket successfully.`);
        this.io.emit('ws_status', { connected: true, socket: 'game' });
      });

      this.gameWs.on('message', (data) => {
        this.handleWSMessage(data.toString(), 'game');
      });

      this.gameWs.on('close', async (code, reason) => {
        console.warn(`[WS] Game WebSocket closed (Code: ${code}, Reason: ${reason}). Reconnecting in 5s...`);
        this.io.emit('ws_status', { connected: false, socket: 'game' });
        
        // Auto-detect a fresh cookie upon disconnect to heal session immediately
        await this.tryAutoDetectCookie();
        
        setTimeout(() => this.connectGameWS(), 5000);
      });

      this.gameWs.on('error', (err) => {
        console.error(`[WS] Game WebSocket error: ${err.message}`);
      });
    } catch (e) {
      console.error(`[WS] Failed to instantiate Game WS: ${e.message}`);
    }
  }

  // WS: Broadcaster Client (wss://broadcaster.domxyrxsfevpzjeg.net/broadcast)
  connectBroadcastWS() {
    console.log(`[WS] Connecting to Broadcaster WebSocket...`);
    try {
      this.broadcastWs = new WebSocket(this.broadcastWsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://broadcaster.domxyrxsfevpzjeg.net'
        }
      });

      this.broadcastWs.on('open', () => {
        console.log(`[WS] Connected to Broadcaster WebSocket.`);
      });

      this.broadcastWs.on('message', (data) => {
        this.handleWSMessage(data.toString(), 'broadcaster');
      });

      this.broadcastWs.on('close', () => {
        console.warn(`[WS] Broadcaster WebSocket closed. Reconnecting in 5s...`);
        setTimeout(() => this.connectBroadcastWS(), 5000);
      });

      this.broadcastWs.on('error', (err) => {
        console.error(`[WS] Broadcaster WS Error: ${err.message}`);
      });
    } catch (e) {
      console.error(`[WS] Failed to instantiate Broadcaster WS: ${e.message}`);
    }
  }

  handleWSMessage(messageStr, source) {
    try {
      // Game ws messages can be JSON
      let data = JSON.parse(messageStr);
      
      // Let's decode typical Spaceman updates:
      let type = data.type || data.action || data.event || '';
      let status = data.status || data.stage || data.state || '';
      let multiplier = parseFloat(data.multiplier || data.mult || data.currentMultiplier || data.r || 0);
      let gameId = data.gameId || data.roundId || data.id || null;

      // Handle Ping
      if (type === 'ping' || data.ping) {
        if (source === 'game' && this.gameWs.readyState === WebSocket.OPEN) {
          this.gameWs.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }

      // Fallback matching if JSON keys are different
      if (!status && messageStr.includes('"flying"')) status = 'FLYING';
      if (!status && messageStr.includes('"crash"')) status = 'CRASHED';
      if (!status && messageStr.includes('"betting"')) status = 'WAITING';

      // Check if multiplier exists inside nested data objects
      if (isNaN(multiplier) || multiplier === 0) {
        const nestedData = data.data || data.payload || {};
        multiplier = parseFloat(nestedData.multiplier || nestedData.mult || nestedData.value || 0);
        if (data.r) multiplier = parseFloat(data.r);
      }

      // Detect if it is a real live game state event (flying ticks or waiting or crashes)
      let isRealGameEvent = false;
      if (status === 'flying' || status === 'FLYING' || status === 'crashed' || status === 'CRASHED' || status === 'WAITING' || status === 'waiting' || multiplier > 1.00) {
        isRealGameEvent = true;
      }

      if (isRealGameEvent) {
        this.lastLiveTickTime = Date.now();
        if (this.isSimulating) {
          console.log(`[WATCHDOG] Real game WebSocket event detected. Deactivating simulator mode...`);
          this.stopSimulation();
        }
      }

      if (status === 'flying' || status === 'FLYING' || multiplier > 1.00) {
        if (this.currentGameState.status !== 'FLYING') {
          this.currentGameState.status = 'FLYING';
          this.currentGameState.gameId = gameId || Date.now();
          this.io.emit('game_start', { gameId: this.currentGameState.gameId });
        }
        
        if (multiplier > 0) {
          this.currentGameState.currentMultiplier = multiplier;
          this.io.emit('multiplier_update', { 
            multiplier: multiplier,
            elapsed: Date.now() - this.currentGameState.lastUpdate 
          });
        }
      }

      // Handle Crash Event
      if (status === 'crashed' || status === 'CRASHED' || type === 'crash' || type === 'game_over') {
        const finalMult = multiplier || this.currentGameState.currentMultiplier;
        
        if (this.currentGameState.status !== 'CRASHED') {
          console.log(`[WS] Spaceman CRASHED at ${finalMult}x`);
          this.currentGameState.status = 'CRASHED';
          this.currentGameState.crashMultiplier = finalMult;
          
          // Add to engine
          patternEngine.addRecord(finalMult);
          
          this.io.emit('game_end', {
            multiplier: finalMult,
            analysis: this.getReportWithUpcomingId()
          });
          
          // Reset state for next game
          setTimeout(() => {
            this.currentGameState.status = 'WAITING';
            this.currentGameState.currentMultiplier = 1.00;
            this.currentGameState.crashMultiplier = null;
            this.io.emit('game_waiting', { countdown: 10 });
          }, 3000);
        }
      }

    } catch (e) {
      // Not JSON or parsing error, try search in string
      if (messageStr.includes('crash') || messageStr.includes('crashed')) {
        // String pattern match fallback
        const match = messageStr.match(/(\d+\.\d+|\d+)x/);
        if (match) {
          const val = parseFloat(match[1]);
          console.log(`[WS-Regex-Fallback] Detected crash at ${val}x`);
          patternEngine.addRecord(val);
          this.broadcastAnalysis();
        }
      }
    }
  }

  // Backup polling to verify analysis and fetch updates in case of WS disconnects
  startPollingFallback() {
    this.pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(STATS_URL, { timeout: 5000 });
        if (response.data && response.data.history) {
          const list = response.data.history.map(item => {
            if (typeof item === 'object') return parseFloat(item.r || item.result || item.value || 1);
            return parseFloat(item);
          }).filter(v => !isNaN(v));
          
          if (list.length > 0) {
            // Check if history differs to sync
            const currentLatest = patternEngine.history[0];
            const apiLatest = list[0];
            
            if (apiLatest && apiLatest !== currentLatest) {
              console.log(`[SYNC] Out of sync detected. Syncing local history with API. API Latest: ${apiLatest}x, Local Latest: ${currentLatest}x`);
              patternEngine.setHistory(list);
              this.broadcastAnalysis();
              
              // Keep watchdog alive since we are getting active updates via API
              this.lastLiveTickTime = Date.now();
              if (this.isSimulating) {
                console.log(`[WATCHDOG] Real game API update detected. Deactivating simulator mode...`);
                this.stopSimulation();
              }
            }
          }
        }
      } catch (err) {
        // Silently handle poll error (avoid cluttering logs)
      }
    }, 10000); // Poll every 10 seconds
  }

  // Helper to append the upcoming round ID based on current active ID
  getReportWithUpcomingId() {
    const report = patternEngine.getAnalysisReport();
    if (report) {
      const currentId = this.currentGameState.gameId;
      let upcomingId = 'NEXT';
      if (currentId) {
        if (typeof currentId === 'number') {
          upcomingId = currentId + 1;
        } else if (String(currentId).startsWith('SIM_')) {
          const num = parseInt(String(currentId).split('_')[1]);
          upcomingId = !isNaN(num) ? 'SIM_' + (num + 1) : 'SIM_' + Math.floor(100000 + Math.random() * 900000);
        } else {
          const num = parseInt(currentId);
          upcomingId = !isNaN(num) ? num + 1 : 'NEXT';
        }
      }
      report.upcomingRoundId = upcomingId;
    }
    return report;
  }

  // Broadcast current pattern analysis report to all connected clients
  broadcastAnalysis() {
    const report = this.getReportWithUpcomingId();
    if (report) {
      this.io.emit('analysis_report', report);
    }
  }

  // Watchdog starts simulator if WebSocket is dead or silent for 15 seconds
  startWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.watchdogInterval = setInterval(() => {
      if (Date.now() - this.lastLiveTickTime > 15000 && !this.isSimulating) {
        console.log(`[WATCHDOG] No live game messages received for 15 seconds. Activating simulator mode...`);
        this.startSimulation();
      }
    }, 5000);
  }

  startSimulation() {
    this.isSimulating = true;
    this.io.emit('ws_status', { connected: true, socket: 'simulator' });
    this.runSimulatedRound();
  }

  stopSimulation() {
    this.isSimulating = false;
    if (this.simTimeout) clearTimeout(this.simTimeout);
    if (this.simInterval) clearInterval(this.simInterval);
  }

  runSimulatedRound() {
    if (!this.isSimulating) return;

    // 1. Waiting phase (5 seconds)
    this.currentGameState.status = 'WAITING';
    this.currentGameState.currentMultiplier = 1.00;
    this.currentGameState.crashMultiplier = null;
    this.io.emit('game_waiting', { countdown: 5 });

    this.simTimeout = setTimeout(() => {
      if (!this.isSimulating) return;

      // 2. Flying phase
      this.currentGameState.status = 'FLYING';
      this.currentGameState.gameId = 'SIM_' + Math.floor(100000 + Math.random() * 900000);
      this.io.emit('game_start', { gameId: this.currentGameState.gameId });

      let currentMult = 1.00;
      
      // Determine crash target using realistic crash distributions
      const rand = Math.random();
      let crashTarget = 1.00;
      if (rand < 0.1) crashTarget = 1.00;
      else if (rand < 0.5) crashTarget = parseFloat((1.01 + Math.random() * 0.99).toFixed(2));
      else if (rand < 0.85) crashTarget = parseFloat((2.00 + Math.random() * 5.00).toFixed(2));
      else if (rand < 0.97) crashTarget = parseFloat((7.00 + Math.random() * 15.00).toFixed(2));
      else crashTarget = parseFloat((25.00 + Math.random() * 75.00).toFixed(2));

      console.log(`[SIMULATOR] Starting simulated round. Target crash: ${crashTarget}x`);

      const startTime = Date.now();
      
      this.simInterval = setInterval(() => {
        if (!this.isSimulating) {
          clearInterval(this.simInterval);
          return;
        }

        const elapsed = (Date.now() - startTime) / 1000; // seconds
        
        // Exponential-like multiplier increase
        currentMult = parseFloat((Math.pow(1.06, elapsed * 10)).toFixed(2));
        
        if (currentMult >= crashTarget) {
          clearInterval(this.simInterval);
          
          // Crash event
          this.currentGameState.status = 'CRASHED';
          this.currentGameState.crashMultiplier = crashTarget;
          patternEngine.addRecord(crashTarget);
          
          this.io.emit('game_end', {
            multiplier: crashTarget,
            analysis: this.getReportWithUpcomingId()
          });

          // Schedule next round
          this.simTimeout = setTimeout(() => {
            this.runSimulatedRound();
          }, 4000);
        } else {
          // Update event
          this.currentGameState.currentMultiplier = currentMult;
          this.io.emit('multiplier_update', {
            multiplier: currentMult,
            elapsed: Date.now() - startTime
          });
        }
      }, 150); // Tick every 150ms for smooth real-time animation
      
    }, 5000);
  }

  shutdown() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.stopSimulation();
    if (this.gameWs) this.gameWs.terminate();
    if (this.broadcastWs) this.broadcastWs.terminate();
  }
}

module.exports = SpacemanWSClient;
