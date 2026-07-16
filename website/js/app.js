/**
 * Spaceman Pattern Dashboard App Logic (100% Vercel Serverless Compatible)
 * Connects directly to game WebSockets, fetches history via Vercel proxy, and runs
 * the pattern matching engine directly in the browser for zero-latency analysis.
 */

document.addEventListener('DOMContentLoaded', () => {
  // CONFIGURATION
  const TABLE_ID = 'spacemanyxe123nh';
  
  // Try to load saved session keys
  let jsessionId = localStorage.getItem('spaceman_jsessionid') || '4-zi-uQtQxBda3Ny4wqpDKrdygkjtvK_YY34P_9Zd__G2jAb_-gn!021770770-f2d7d982';
  
  // Check if we are running on Vercel (same origin) or local debug port
  const defaultApiOrigin = window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3001';
  let apiOrigin = localStorage.getItem('spaceman_api_origin') || defaultApiOrigin;

  // WebSockets & Polling references
  let gameWs = null;
  let broadcastWs = null;
  let pollInterval = null;
  let watchdogInterval = null;
  let lastLiveTickTime = Date.now();
  
  // Simulator State variables
  let isSimulating = false;
  let simTimeout = null;
  let simInterval = null;

  // Initialize Sub-modules
  const patternEngine = new PatternEngine();
  const flightAnim = new SpacemanAnimation('spacemanCanvas');
  const trendChart = new SpacemanChart('trendChart');
  
  flightAnim.reset();

  // DOM Elements
  const connectionStatus = document.getElementById('connectionStatus');
  const serverConfigToggle = document.getElementById('serverConfigToggle');
  const serverModal = document.getElementById('serverModal');
  const serverUrlInput = document.getElementById('serverUrlInput');
  const jsessionIdInput = document.getElementById('jsessionIdInput');
  const saveServerBtn = document.getElementById('saveServerBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  const targetRoundId = document.getElementById('targetRoundId');
  const gameIdText = document.getElementById('gameId');
  const liveMultiplier = document.getElementById('liveMultiplier');
  const liveLabel = document.getElementById('liveLabel');
  const gameStageDescription = document.getElementById('gameStageDescription');
  const progressBarFill = document.getElementById('progressBarFill');
  
  const predTitle = document.getElementById('predTitle');
  const predictionBox = document.querySelector('.prediction-box');
  const predValue = document.getElementById('predValue');
  const expectedMult = document.getElementById('expectedMult');
  const recomBadge = document.getElementById('recomBadge');
  const confidenceVal = document.getElementById('confidenceVal');
  const confidenceFill = document.getElementById('confidenceFill');
  const activePatternSummary = document.getElementById('activePatternSummary');
  const patternStatsText = document.getElementById('patternStatsText');
  
  const probRed = document.getElementById('probRed');
  const probGreen = document.getElementById('probGreen');
  const probGold = document.getElementById('probGold');
  const fillRed = document.getElementById('fillRed');
  const fillGreen = document.getElementById('fillGreen');
  const fillGold = document.getElementById('fillGold');
  
  const statAverage = document.getElementById('statAverage');
  const statTotalGames = document.getElementById('statTotalGames');
  const statStreak = document.getElementById('statStreak');
  
  const percentRed = document.getElementById('percentRed');
  const percentGreen = document.getElementById('percentGreen');
  const percentGold = document.getElementById('percentGold');
  const progressRed = document.getElementById('progressRed');
  const progressGreen = document.getElementById('progressGreen');
  const progressGold = document.getElementById('progressGold');
  
  const historyGrid = document.getElementById('historyGrid');
  const historyCounter = document.getElementById('historyCounter');

  // Load Settings Inputs
  serverUrlInput.value = apiOrigin;
  jsessionIdInput.value = jsessionId;

  // Toggle Settings Modal
  serverConfigToggle.addEventListener('click', () => {
    serverModal.classList.add('active');
  });

  closeModalBtn.addEventListener('click', () => {
    serverModal.classList.remove('active');
  });

  saveServerBtn.addEventListener('click', () => {
    const newUrl = serverUrlInput.value.trim();
    const newSession = jsessionIdInput.value.trim();
    
    if (newUrl) {
      apiOrigin = newUrl;
      localStorage.setItem('spaceman_api_origin', newUrl);
    }
    
    if (newSession) {
      jsessionId = newSession;
      localStorage.setItem('spaceman_jsessionid', newSession);
    }
    
    serverModal.classList.remove('active');
    
    // Restart Connections
    initSystem();
  });

  // Block Developer Inspect Tools for security
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
        (e.ctrlKey && e.key === 'U')) {
      e.preventDefault();
    }
  });

  // FETCH STATISTICS HISTORY
  async function fetchHistory() {
    try {
      console.log(`[HTTP] Fetching history from Serverless function...`);
      
      const endpoint = `${apiOrigin}/api/history?tableId=${TABLE_ID}&JSESSIONID=${encodeURIComponent(jsessionId)}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP Error status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.history && Array.isArray(data.history)) {
        console.log(`[HTTP] History fetched successfully. Size: ${data.history.length}`);
        
        const multipliers = data.history.map(item => {
          if (typeof item === 'object' && item !== null) {
            return parseFloat(item.r || item.result || item.value || 1.00);
          }
          return parseFloat(item);
        }).filter(val => !isNaN(val));

        if (multipliers.length > 0) {
          patternEngine.setHistory(multipliers);
          updateAnalyticsUI();
          
          // Reset watchdog
          lastLiveTickTime = Date.now();
          if (isSimulating) {
            console.log(`[WATCHDOG] Real game API data detected. Deactivating simulator.`);
            stopSimulation();
          }
        } else {
          console.warn(`[HTTP] History multipliers empty.`);
        }
      } else {
        console.warn(`[HTTP] Unexpected history response structure.`);
      }
    } catch (error) {
      console.error(`[HTTP] Error fetching history: ${error.message}`);
    }
  }

  function loadMockHistory() {
    const mocks = [];
    for (let i = 0; i < 300; i++) {
      const rand = Math.random();
      if (rand < 0.1) mocks.push(1.00);
      else if (rand < 0.5) mocks.push(parseFloat((1 + Math.random()).toFixed(2)));
      else if (rand < 0.85) mocks.push(parseFloat((2 + Math.random() * 5).toFixed(2)));
      else if (rand < 0.97) mocks.push(parseFloat((7 + Math.random() * 20).toFixed(2)));
      else mocks.push(parseFloat((30 + Math.random() * 100).toFixed(2)));
    }
    patternEngine.setHistory(mocks);
    updateAnalyticsUI();
  }

  // CONNECT DIRECTLY TO GAME WEBSOCKETS (CLIENT-SIDE)
  function connectGameWS() {
    if (gameWs) {
      gameWs.close();
    }

    const wsUrl = `wss://gs17.domxyrxsfevpzjeg.net/game?bcs=true&JSESSIONID=${encodeURIComponent(jsessionId)}&tableId=${TABLE_ID}`;
    console.log(`[WS] Connecting to Game WebSocket directly...`);
    
    try {
      gameWs = new WebSocket(wsUrl);

      gameWs.onopen = () => {
        console.log(`[WS] Connected to Spaceman Game WebSocket.`);
        connectionStatus.className = 'connection-status online';
        connectionStatus.querySelector('.status-text').textContent = 'LIVE (GAME)';
      };

      gameWs.onmessage = (event) => {
        handleWSMessage(event.data, 'game');
      };

      gameWs.onclose = () => {
        console.warn(`[WS] Game WebSocket closed. Reconnecting in 5s...`);
        connectionStatus.className = 'connection-status offline';
        connectionStatus.querySelector('.status-text').textContent = 'DISCONNECTED';
        setTimeout(() => {
          if (!isSimulating && gameWs.readyState === WebSocket.CLOSED) {
            connectGameWS();
          }
        }, 5000);
      };

      gameWs.onerror = (err) => {
        console.error(`[WS] Game WebSocket error:`, err);
      };
    } catch (e) {
      console.error(`[WS] Direct WS connection failed:`, e);
    }
  }

  function connectBroadcastWS() {
    if (broadcastWs) {
      broadcastWs.close();
    }

    const wsUrl = `wss://broadcaster.domxyrxsfevpzjeg.net/broadcast?JSESSIONID=${encodeURIComponent(jsessionId)}&tableId=${TABLE_ID}`;
    try {
      broadcastWs = new WebSocket(wsUrl);

      broadcastWs.onopen = () => {
        console.log(`[WS] Connected to Broadcaster WebSocket.`);
      };

      broadcastWs.onmessage = (event) => {
        handleWSMessage(event.data, 'broadcaster');
      };

      broadcastWs.onclose = () => {
        setTimeout(() => {
          if (!isSimulating && broadcastWs.readyState === WebSocket.CLOSED) {
            connectBroadcastWS();
          }
        }, 5000);
      };
    } catch (e) {
      // Ignored
    }
  }

  // WEBSOCKET PARSER (BROWSER RUNNING STATE)
  let currentGameState = {
    status: 'WAITING',
    currentMultiplier: 1.00,
    crashMultiplier: null,
    gameId: null,
    lastUpdate: Date.now()
  };

  function handleWSMessage(messageStr, source) {
    try {
      let data = JSON.parse(messageStr);
      let type = data.type || data.action || data.event || '';
      let status = data.status || data.stage || data.state || '';
      let multiplier = parseFloat(data.multiplier || data.mult || data.currentMultiplier || data.r || 0);
      let gameId = data.gameId || data.roundId || data.id || null;

      // Handle Ping
      if (type === 'ping' || data.ping) {
        if (source === 'game' && gameWs.readyState === WebSocket.OPEN) {
          gameWs.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }

      // Fallback decode keys
      if (!status && messageStr.includes('"flying"')) status = 'FLYING';
      if (!status && messageStr.includes('"crash"')) status = 'CRASHED';
      if (!status && messageStr.includes('"betting"')) status = 'WAITING';

      if (isNaN(multiplier) || multiplier === 0) {
        const nestedData = data.data || data.payload || {};
        multiplier = parseFloat(nestedData.multiplier || nestedData.mult || nestedData.value || 0);
        if (data.r) multiplier = parseFloat(data.r);
      }

      // Detect active tick
      let isRealGameEvent = false;
      if (status === 'flying' || status === 'FLYING' || status === 'crashed' || status === 'CRASHED' || status === 'WAITING' || status === 'waiting' || multiplier > 1.00) {
        isRealGameEvent = true;
      }

      if (isRealGameEvent) {
        lastLiveTickTime = Date.now();
        if (isSimulating) {
          console.log(`[WATCHDOG] Real game WS event detected. Deactivating simulator.`);
          stopSimulation();
        }
      }

      // 1. FLYING STATE
      if (status === 'flying' || status === 'FLYING' || multiplier > 1.00) {
        if (currentGameState.status !== 'FLYING') {
          currentGameState.status = 'FLYING';
          currentGameState.gameId = gameId || Date.now();
          
          const displayId = String(currentGameState.gameId).substring(0, 10);
          gameIdText.textContent = `ROUND #${displayId}`;
          liveLabel.textContent = 'FLYING';
          liveMultiplier.className = 'live-value flying';
          gameStageDescription.textContent = 'Spaceman is climbing high...';
          
          if (predTitle) {
            predTitle.textContent = "ACTIVE PREDICTION RUNNING";
            predTitle.style.color = "var(--color-green)";
          }
          if (targetRoundId) {
            targetRoundId.textContent = `RUNNING ROUND: #${displayId}`;
          }
          if (predictionBox) {
            predictionBox.classList.add('running-glow');
          }
          
          progressBarFill.style.width = '100%';
          progressBarFill.style.transition = 'width 15s linear';
          
          document.getElementById('spacemanAvatar').className = 'spaceman-avatar flying';
          flightAnim.startFlight();
        }
        
        if (multiplier > 0) {
          currentGameState.currentMultiplier = multiplier;
          liveMultiplier.textContent = `${multiplier.toFixed(2)}x`;
          flightAnim.updateMultiplier(multiplier);
        }
      }

      // 2. CRASH STATE
      if (status === 'crashed' || status === 'CRASHED' || type === 'crash' || type === 'game_over') {
        const finalMult = multiplier || currentGameState.currentMultiplier;
        
        if (currentGameState.status !== 'CRASHED') {
          console.log(`[WS] Spaceman CRASHED at ${finalMult}x`);
          currentGameState.status = 'CRASHED';
          currentGameState.crashMultiplier = finalMult;
          
          liveLabel.textContent = 'CRASHED';
          liveMultiplier.className = 'live-value crashed';
          liveMultiplier.textContent = `${finalMult.toFixed(2)}x`;
          gameStageDescription.textContent = `Exploded at ${finalMult.toFixed(2)}x. Readying next round...`;
          
          if (predTitle) {
            predTitle.textContent = "UPCOMING ROUND PREDICTION";
            predTitle.style.color = "var(--color-gold)";
          }
          if (predictionBox) {
            predictionBox.classList.remove('running-glow');
          }

          progressBarFill.style.transition = 'none';
          progressBarFill.style.width = '0%';
          
          document.getElementById('spacemanAvatar').className = 'spaceman-avatar crashed';
          flightAnim.crash();
          
          // Save and predict
          patternEngine.addRecord(finalMult);
          updateAnalyticsUI();
          
          // Reset for waiting
          setTimeout(() => {
            currentGameState.status = 'WAITING';
            currentGameState.currentMultiplier = 1.00;
            currentGameState.crashMultiplier = null;
            
            liveLabel.textContent = 'PREPARING';
            liveMultiplier.className = 'live-value';
            liveMultiplier.textContent = '1.00x';
            gameStageDescription.textContent = `Prepare next bets...`;
            
            document.getElementById('spacemanAvatar').className = 'spaceman-avatar';
            flightAnim.reset();
          }, 3000);
        }
      }

    } catch (e) {
      // Regex parsing for text frames
      if (messageStr.includes('crash') || messageStr.includes('crashed')) {
        const match = messageStr.match(/(\d+\.\d+|\d+)x/);
        if (match) {
          const val = parseFloat(match[1]);
          console.log(`[WS-Regex-Fallback] Detected crash at ${val}x`);
          patternEngine.addRecord(val);
          updateAnalyticsUI();
        }
      }
    }
  }

  // Watchdog timer is disabled to keep data strictly real-time.
  function startWatchdog() {
    // No-op
  }

  function startSimulation() {
    isSimulating = true;
    connectionStatus.className = 'connection-status online';
    connectionStatus.querySelector('.status-text').textContent = 'LIVE (SIMULATOR)';
    runSimulatedRound();
  }

  function stopSimulation() {
    isSimulating = false;
    if (simTimeout) clearTimeout(simTimeout);
    if (simInterval) clearInterval(simInterval);
  }

  function runSimulatedRound() {
    if (!isSimulating) return;

    // 1. Waiting phase (5 seconds)
    currentGameState.status = 'WAITING';
    currentGameState.currentMultiplier = 1.00;
    currentGameState.crashMultiplier = null;
    
    liveLabel.textContent = 'PREPARING';
    liveMultiplier.className = 'live-value';
    liveMultiplier.textContent = '1.00x';
    gameStageDescription.textContent = `Prepare next bets...`;
    
    if (predTitle) {
      predTitle.textContent = "UPCOMING ROUND PREDICTION";
      predTitle.style.color = "var(--color-gold)";
    }
    if (predictionBox) {
      predictionBox.classList.remove('running-glow');
    }
    document.getElementById('spacemanAvatar').className = 'spaceman-avatar';
    flightAnim.reset();

    // Trigger prediction update based on last mock rounds
    updateAnalyticsUI();

    simTimeout = setTimeout(() => {
      if (!isSimulating) return;

      // 2. Flying phase
      currentGameState.status = 'FLYING';
      currentGameState.gameId = 'SIM_' + Math.floor(100000 + Math.random() * 900000);
      
      const displayId = String(currentGameState.gameId).substring(0, 10);
      gameIdText.textContent = `ROUND #${displayId}`;
      liveLabel.textContent = 'FLYING';
      liveMultiplier.className = 'live-value flying';
      gameStageDescription.textContent = 'Spaceman is climbing high...';
      
      if (predTitle) {
        predTitle.textContent = "ACTIVE PREDICTION RUNNING";
        predTitle.style.color = "var(--color-green)";
      }
      if (targetRoundId) {
        targetRoundId.textContent = `RUNNING ROUND: #${displayId}`;
      }
      if (predictionBox) {
        predictionBox.classList.add('running-glow');
      }
      
      progressBarFill.style.width = '100%';
      progressBarFill.style.transition = 'width 15s linear';
      
      document.getElementById('spacemanAvatar').className = 'spaceman-avatar flying';
      flightAnim.startFlight();

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
      
      simInterval = setInterval(() => {
        if (!isSimulating) {
          clearInterval(simInterval);
          return;
        }

        const elapsed = (Date.now() - startTime) / 1000; // seconds
        
        // Exponential-like multiplier increase
        currentMult = parseFloat((Math.pow(1.06, elapsed * 10)).toFixed(2));
        
        if (currentMult >= crashTarget) {
          clearInterval(simInterval);
          
          // Crash event
          currentGameState.status = 'CRASHED';
          currentGameState.crashMultiplier = crashTarget;
          
          liveLabel.textContent = 'CRASHED';
          liveMultiplier.className = 'live-value crashed';
          liveMultiplier.textContent = `${crashTarget.toFixed(2)}x`;
          gameStageDescription.textContent = `Exploded at ${crashTarget.toFixed(2)}x. Readying next round...`;
          
          if (predTitle) {
            predTitle.textContent = "UPCOMING ROUND PREDICTION";
            predTitle.style.color = "var(--color-gold)";
          }
          if (predictionBox) {
            predictionBox.classList.remove('running-glow');
          }
          
          progressBarFill.style.transition = 'none';
          progressBarFill.style.width = '0%';
          
          document.getElementById('spacemanAvatar').className = 'spaceman-avatar crashed';
          flightAnim.crash();
          
          patternEngine.addRecord(crashTarget);

          // Schedule next round
          simTimeout = setTimeout(() => {
            runSimulatedRound();
          }, 4000);
        } else {
          // Update event
          currentGameState.currentMultiplier = currentMult;
          liveMultiplier.textContent = `${currentMult.toFixed(2)}x`;
          flightAnim.updateMultiplier(currentMult);
        }
      }, 150);
      
    }, 5000);
  }

  // UPDATE ANALYTICS UI DASHBOARD
  function updateAnalyticsUI() {
    const report = patternEngine.getAnalysisReport();
    if (!report) return;

    const { stats, prediction, last300Games, last20Games } = report;

    // 1. Update Stats Card
    if (stats) {
      statAverage.textContent = `${stats.average.toFixed(2)}x`;
      statTotalGames.textContent = stats.totalGames;
      
      const streakColor = stats.currentStreak.type === 'RED' ? 'var(--color-red)' : 
                          stats.currentStreak.type === 'GREEN' ? 'var(--color-green)' : 'var(--color-gold)';
      statStreak.textContent = `${stats.currentStreak.count} (${stats.currentStreak.type})`;
      statStreak.style.color = streakColor;

      // Update Conic Gauges
      updateGauge(progressRed, percentRed, stats.distribution.red.percent, 'var(--color-red)');
      updateGauge(progressGreen, percentGreen, stats.distribution.green.percent, 'var(--color-green)');
      updateGauge(progressGold, percentGold, stats.distribution.gold.percent, 'var(--color-gold)');
    }

    // 2. Update Prediction Box
    if (prediction) {
      predValue.textContent = prediction.prediction;
      predValue.className = `pred-value ${prediction.prediction}`;
      
      // Calculate upcoming round ID
      const currentId = currentGameState.gameId;
      let upcomingId = 'NEXT';
      if (currentId) {
        if (typeof currentId === 'number') {
          upcomingId = currentId + 1;
        } else if (String(currentId).startsWith('SIM_')) {
          const num = parseInt(String(currentId).split('_')[1]);
          upcomingId = !isNaN(num) ? 'SIM_' + (num + 1) : 'SIM_' + Math.floor(100000 + Math.random() * 900000);
        }
      }
      
      if (targetRoundId && !currentGameState.status === 'FLYING') {
        targetRoundId.textContent = `PREDICTING ROUND: #${upcomingId}`;
      } else if (targetRoundId && currentGameState.status === 'WAITING') {
        targetRoundId.textContent = `PREDICTING ROUND: #${upcomingId}`;
      }

      if (prediction.targetMultiplier) {
        expectedMult.textContent = `TARGET: ${prediction.targetMultiplier.toFixed(2)}x`;
      } else {
        expectedMult.textContent = 'TARGET: --x';
      }
      
      confidenceVal.textContent = `${prediction.confidence}%`;
      confidenceFill.style.width = `${prediction.confidence}%`;

      // Update recommendation badge
      if (prediction.prediction === 'GREEN' && prediction.confidence > 70) {
        recomBadge.textContent = 'SAFE BET (2x Target)';
        recomBadge.className = 'recommendation-badge SAFE';
      } else if (prediction.prediction === 'GOLD' && prediction.confidence > 60) {
        recomBadge.textContent = 'GOLD TARGET (10x hunt)';
        recomBadge.className = 'recommendation-badge GOLD_TARGET';
      } else if (prediction.prediction === 'RED') {
        recomBadge.textContent = 'WAIT / HIGH CRASH PROBABILITY';
        recomBadge.className = 'recommendation-badge WAIT';
      } else {
        recomBadge.textContent = 'WAITING FOR CLEAR PATTERN';
        recomBadge.className = 'recommendation-badge WAIT';
      }

      // Update probability bars
      probRed.textContent = `${prediction.probabilities.RED}%`;
      fillRed.style.width = `${prediction.probabilities.RED}%`;
      
      probGreen.textContent = `${prediction.probabilities.GREEN}%`;
      fillGreen.style.width = `${prediction.probabilities.GREEN}%`;
      
      probGold.textContent = `${prediction.probabilities.GOLD}%`;
      fillGold.style.width = `${prediction.probabilities.GOLD}%`;

      // Update active pattern details
      if (prediction.patternFound && activePatternSummary) {
        const match = prediction.patternFound.match(/\[(.*?)\]/);
        const patternStr = match ? match[1].replace(/ -> /g, ' ➔ ') : 'Global Statistics';
        activePatternSummary.innerHTML = `<i class="fa-solid fa-circle-nodes info-icon" style="color: var(--color-purple)"></i> <span>Pattern Match: ${patternStr}</span>`;
        
        const occMatch = prediction.patternFound.match(/\((\d+) occurrences\)/);
        const count = occMatch ? occMatch[1] : '0';
        if (count !== '0') {
          patternStatsText.textContent = `Out of ${count} historical occurrences of this sequence, ${prediction.probabilities[prediction.prediction]}% of the rounds resulted in a ${prediction.prediction} outcome.`;
        } else {
          patternStatsText.textContent = `Insufficient sequence history. Predictor falling back to global game distribution statistics.`;
        }
      }
    }

    // 3. Update History Grid
    const fullHistory = last300Games || [];
    if (fullHistory.length > 0) {
      historyGrid.innerHTML = '';
      historyCounter.textContent = `Showing ${fullHistory.length} games`;
      
      fullHistory.forEach(item => {
        const cell = document.createElement('div');
        cell.className = `grid-cell ${item.category}`;
        cell.textContent = `${item.multiplier.toFixed(2)}x`;
        cell.title = `Multiplier: ${item.multiplier.toFixed(2)}x (${item.category})`;
        historyGrid.appendChild(cell);
      });
    }

    // 4. Update Trend Chart
    const rawMultipliers = fullHistory.map(item => item.multiplier);
    trendChart.update(rawMultipliers);
  }

  function updateGauge(gaugeEl, textEl, percentage, color) {
    if (!gaugeEl || !textEl) return;
    textEl.textContent = `${percentage}%`;
    const degrees = percentage * 3.6;
    gaugeEl.style.background = `conic-gradient(${color} 0deg, ${color} ${degrees}deg, rgba(255, 255, 255, 0.05) ${degrees}deg, rgba(255, 255, 255, 0.05) 360deg)`;
  }

  // Backup fallback stats polling
  function startPollingFallback() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!isSimulating) {
        await fetchHistory();
      }
    }, 10000);
  }

  // INITIALIZE SYSTEM CONNECTIONS
  async function initSystem() {
    stopSimulation();
    
    // Load history first
    await fetchHistory();
    
    // Connect WebSockets
    connectGameWS();
    connectBroadcastWS();
    
    // Launch watchdogs
    // startWatchdog() is disabled to keep data strictly real-time.
    startPollingFallback();
  }

  // Listen for automatic session updates from the Chrome extension
  window.addEventListener('spaceman_session_updated', (e) => {
    console.log(`[App] Session updated automatically via Chrome extension: ${e.detail}`);
    jsessionId = e.detail;
    if (jsessionIdInput) {
      jsessionIdInput.value = jsessionId;
    }
    initSystem();
  });

  initSystem();
});
