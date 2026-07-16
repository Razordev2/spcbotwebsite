/**
 * Spaceman Pattern Dashboard App Logic
 * Manages Socket.IO client connections, UI updates, and gauge renders.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Configurable Backend URL
  const defaultBackend = window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3001';
  let backendUrl = localStorage.getItem('spaceman_backend_url') || defaultBackend;
  let socket = null;
  
  // Initialize Sub-modules
  const flightAnim = new SpacemanAnimation('spacemanCanvas');
  const trendChart = new SpacemanChart('trendChart');
  
  // Start animation loop in WAITING mode
  flightAnim.reset();
  
  // DOM Elements
  const connectionStatus = document.getElementById('connectionStatus');
  const serverConfigToggle = document.getElementById('serverConfigToggle');
  const activeServerText = document.getElementById('activeServerText');
  const serverModal = document.getElementById('serverModal');
  const serverUrlInput = document.getElementById('serverUrlInput');
  const saveServerBtn = document.getElementById('saveServerBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  const gameIdText = document.getElementById('gameId');
  const liveMultiplier = document.getElementById('liveMultiplier');
  const liveLabel = document.getElementById('liveLabel');
  const gameStageDescription = document.getElementById('gameStageDescription');
  const progressBarFill = document.getElementById('progressBarFill');
  
  const targetRoundId = document.getElementById('targetRoundId');
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

  // Server config modal listeners removed for security (hidden in UI)

  // Connect Socket.IO
  function connectSocket() {
    if (socket) {
      socket.disconnect();
    }
    
    console.log(`[Socket] Connecting to backend: ${backendUrl}`);
    
    // Status UI
    connectionStatus.className = 'connection-status offline';
    connectionStatus.querySelector('.status-text').textContent = 'CONNECTING...';
    
    socket = io(backendUrl, {
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log(`[Socket] Connected to backend!`);
      connectionStatus.className = 'connection-status online';
      connectionStatus.querySelector('.status-text').textContent = 'CONNECTED';
    });

    socket.on('disconnect', () => {
      console.warn(`[Socket] Disconnected from backend.`);
      connectionStatus.className = 'connection-status offline';
      connectionStatus.querySelector('.status-text').textContent = 'DISCONNECTED';
      flightAnim.reset();
    });

    socket.on('ws_status', (status) => {
      console.log(`[Game WS Status]`, status);
      if (status.connected) {
        connectionStatus.className = 'connection-status online';
        connectionStatus.querySelector('.status-text').textContent = `LIVE (${status.socket.toUpperCase()})`;
      }
    });

    // Real-Time Game Events
    socket.on('game_start', (data) => {
      console.log(`[Game] Started:`, data.gameId);
      const displayId = String(data.gameId).substring(0, 10);
      gameIdText.textContent = `ROUND #${displayId}`;
      liveLabel.textContent = 'FLYING';
      liveMultiplier.className = 'live-value flying';
      gameStageDescription.textContent = 'Spaceman is climbing high...';
      
      // Update Prediction Panel Status to ACTIVE/RUNNING
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
      progressBarFill.style.transition = 'width 15s linear'; // visual countdown estimate
      
      // Update HTML rocket class to trigger animations
      document.getElementById('spacemanAvatar').className = 'spaceman-avatar flying';
      
      flightAnim.startFlight();
    });

    socket.on('multiplier_update', (data) => {
      // Set text to two decimal places
      liveMultiplier.textContent = `${data.multiplier.toFixed(2)}x`;
      flightAnim.updateMultiplier(data.multiplier);
    });

    socket.on('game_end', (data) => {
      console.log(`[Game] Crashed at:`, data.multiplier);
      liveLabel.textContent = 'CRASHED';
      liveMultiplier.className = 'live-value crashed';
      liveMultiplier.textContent = `${data.multiplier.toFixed(2)}x`;
      gameStageDescription.textContent = `Exploded at ${data.multiplier.toFixed(2)}x. Readying next round...`;
      
      // Update Prediction Panel Status to UPCOMING (analyzing next game)
      if (predTitle) {
        predTitle.textContent = "UPCOMING ROUND PREDICTION";
        predTitle.style.color = "var(--color-gold)";
      }
      if (predictionBox) {
        predictionBox.classList.remove('running-glow');
      }

      progressBarFill.style.transition = 'none';
      progressBarFill.style.width = '0%';
      
      // Update HTML rocket class to trigger animations
      document.getElementById('spacemanAvatar').className = 'spaceman-avatar crashed';
      
      flightAnim.crash();
      
      // Update stats and predictions instantly
      if (data.analysis) {
        updateAnalyticsUI(data.analysis);
      }
    });

    socket.on('game_waiting', (data) => {
      liveLabel.textContent = 'PREPARING';
      liveMultiplier.className = 'live-value';
      liveMultiplier.textContent = '1.00x';
      gameStageDescription.textContent = `Prepare next bets...`;
      
      // Update Prediction Panel Status to UPCOMING (user has betting window now)
      if (predTitle) {
        predTitle.textContent = "UPCOMING ROUND PREDICTION";
        predTitle.style.color = "var(--color-gold)";
      }
      if (predictionBox) {
        predictionBox.classList.remove('running-glow');
      }

      document.getElementById('spacemanAvatar').className = 'spaceman-avatar';
      flightAnim.reset();
    });

    // Full analysis report update
    socket.on('analysis_report', (report) => {
      console.log(`[Analysis] Report received:`, report);
      updateAnalyticsUI(report);
    });
  }

  // Update whole UI dashboard
  function updateAnalyticsUI(report) {
    if (!report) return;

    const { stats, prediction, last20Games } = report;

    // 1. Update stats
    if (stats) {
      statAverage.textContent = `${stats.average.toFixed(2)}x`;
      statTotalGames.textContent = stats.totalGames;
      
      const streakColor = stats.currentStreak.type === 'RED' ? 'var(--color-red)' : 
                          stats.currentStreak.type === 'GREEN' ? 'var(--color-green)' : 'var(--color-gold)';
      statStreak.textContent = `${stats.currentStreak.count} (${stats.currentStreak.type})`;
      statStreak.style.color = streakColor;

      // Update gauges (Conic gradient progress)
      updateGauge(progressRed, percentRed, stats.distribution.red.percent, 'var(--color-red)');
      updateGauge(progressGreen, percentGreen, stats.distribution.green.percent, 'var(--color-green)');
      updateGauge(progressGold, percentGold, stats.distribution.gold.percent, 'var(--color-gold)');
    }

    // 2. Update prediction
    if (prediction) {
      predValue.textContent = prediction.prediction;
      predValue.className = `pred-value ${prediction.prediction}`;
      
      // Update target round ID
      if (report.upcomingRoundId && targetRoundId) {
        targetRoundId.textContent = `PREDICTING ROUND: #${report.upcomingRoundId}`;
      }
      
      if (prediction.targetMultiplier) {
        expectedMult.textContent = `TARGET: ${prediction.targetMultiplier.toFixed(2)}x`;
      } else {
        expectedMult.textContent = 'TARGET: --x';
      }
      
      confidenceVal.textContent = `${prediction.confidence}%`;
      confidenceFill.style.width = `${prediction.confidence}%`;
      
      // Update active pattern sequence label
      if (prediction.patternFound && activePatternSummary) {
        const match = prediction.patternFound.match(/\[(.*?)\]/);
        const patternStr = match ? match[1].replace(/ -> /g, ' ➔ ') : 'Global Statistics';
        activePatternSummary.innerHTML = `<i class="fa-solid fa-circle-nodes info-icon" style="color: var(--color-purple)"></i> <span>Pattern Match: ${patternStr}</span>`;
        
        // Update stats analysis text
        const occMatch = prediction.patternFound.match(/\((\d+) occurrences\)/);
        const count = occMatch ? occMatch[1] : '0';
        if (count !== '0') {
          patternStatsText.textContent = `Out of ${count} historical occurrences of this sequence, ${prediction.probabilities[prediction.prediction]}% of the rounds resulted in a ${prediction.prediction} outcome.`;
        } else {
          patternStatsText.textContent = `Insufficient sequence history. Predictor falling back to global game distribution statistics.`;
        }
      }

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
    }

    // 3. Update History Grid (if full engine history list exists, or fallback to last20Games)
    const historyList = report.stats ? report.stats.totalGames > 0 ? report.stats : null : null;
    
    // We can populate the history grid. The report contains a list of historical multipliers.
    // If backend sent the full list inside stats or if we fetch it. Let's make sure we have access.
    // In our backend, we sent patternEngine.history as a whole or as part of stats?
    // Let's check: patternEngine.history is the source of stats.
    // Actually, report contains last20Games, and stats has totalGames. Let's make sure the backend sends the history.
    // Wait! Let's check pattern-engine.js code. It contains getAnalysisReport which sends last20Games.
    // Let's modify pattern-engine.js or send the history grid items directly.
    // Since showing 300 games in grid is requested, let's render as many as we have.
    // If the backend has full history, let's render the list.
    // Let's see: patternEngine.history has up to 500 items. Let's check if the backend transmits this.
    // In server.js, we emit analysis_report containing the output of getAnalysisReport().
    // Let's check what getAnalysisReport sends:
    // stats, prediction, last20Games.
    // To support 300 games grid, let's modify getAnalysisReport to include the first 300 games from history!
    // But wait, the client can render the history list. Let's make sure it handles both.
    // If report has history, use it. Otherwise use last20Games.
    const fullHistory = report.history || report.last300Games || report.last20Games || [];
    
    // Let's populate grid
    if (fullHistory.length > 0) {
      historyGrid.innerHTML = '';
      historyCounter.textContent = `Showing ${fullHistory.length} games`;
      
      fullHistory.forEach(item => {
        let val = 1.00;
        let cat = 'RED';
        
        if (typeof item === 'object') {
          val = item.multiplier;
          cat = item.category;
        } else {
          val = item;
          if (val < 2.00) cat = 'RED';
          else if (val < 10.00) cat = 'GREEN';
          else cat = 'GOLD';
        }
        
        const cell = document.createElement('div');
        cell.className = `grid-cell ${cat}`;
        cell.textContent = `${val.toFixed(2)}x`;
        cell.title = `Multiplier: ${val.toFixed(2)}x (${cat})`;
        historyGrid.appendChild(cell);
      });
    }

    // 4. Update Trend Chart
    // Extract raw multipliers (whether they are objects or floats)
    const rawMultipliers = fullHistory.map(item => typeof item === 'object' ? item.multiplier : item);
    trendChart.update(rawMultipliers);
  }

  // Update circular gauge styles
  function updateGauge(gaugeEl, textEl, percentage, color) {
    if (!gaugeEl || !textEl) return;
    textEl.textContent = `${percentage}%`;
    const degrees = percentage * 3.6;
    gaugeEl.style.background = `conic-gradient(${color} 0deg, ${color} ${degrees}deg, rgba(255, 255, 255, 0.05) ${degrees}deg, rgba(255, 255, 255, 0.05) 360deg)`;
  }

  // Initiate initial connection
  connectSocket();
});
