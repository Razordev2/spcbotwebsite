const axios = require('axios');
const WebSocket = require('ws');

const CHROME_DEBUG_URL = 'http://127.0.0.1:9222/json/list';

/**
 * Automatically attempts to find an active Chrome instance with remote debugging enabled,
 * inspects the open tabs to find the Spaceman game/casino site,
 * and extracts the active JSESSIONID cookie using the Chrome DevTools Protocol.
 */
async function autoDetectJSESSIONID() {
  try {
    console.log(`[AutoDetect] Querying Chrome remote debugging port at ${CHROME_DEBUG_URL}...`);
    
    // 1. Fetch active targets list from Chrome debugging port
    const response = await axios.get(CHROME_DEBUG_URL, { timeout: 2000 });
    const tabs = response.data;
    
    if (!Array.isArray(tabs) || tabs.length === 0) {
      console.warn(`[AutoDetect] Chrome debugging port is open, but no active tabs were found.`);
      return null;
    }

    // 2. Scan tabs for casino or game keywords
    // Target domains: kaca189b, eca004, domxyrxsfevpzjeg, crash, spaceman
    const gameTab = tabs.find(tab => {
      const url = tab.url.toLowerCase();
      return url.includes('kaca189b') || 
             url.includes('eca004') || 
             url.includes('domxyrxsfevpzjeg') || 
             url.includes('spaceman') || 
             url.includes('crash');
    });

    if (!gameTab) {
      console.log(`[AutoDetect] Chrome is running, but could not find any active tabs for the Spaceman game.`);
      return null;
    }

    console.log(`[AutoDetect] Found active game tab: "${gameTab.title}"`);
    const wsUrl = gameTab.webSocketDebuggerUrl;
    
    if (!wsUrl) {
      console.warn(`[AutoDetect] Webbrowser target has no debugger URL. Chrome might be restricted.`);
      return null;
    }

    // 3. Connect directly to Chrome tab via WebSockets (CDP protocol)
    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl);
      let resolved = false;

      ws.on('open', () => {
        // Send CDP RPC request to retrieve cookies for the game APIs domain
        const cdpRequest = {
          id: 101,
          method: 'Network.getCookies',
          params: {
            urls: [
              'https://games.domxyrxsfevpzjeg.net', 
              'https://client.domxyrxsfevpzjeg.net',
              'https://eca004.kaca189b.online'
            ]
          }
        };
        ws.send(JSON.stringify(cdpRequest));
      });

      ws.on('message', (messageStr) => {
        try {
          const response = JSON.parse(messageStr.toString());
          
          if (response.id === 101 && response.result && Array.isArray(response.result.cookies)) {
            const cookies = response.result.cookies;
            
            // Find the JSESSIONID cookie
            const jsessionIdCookie = cookies.find(c => c.name === 'JSESSIONID');
            
            if (jsessionIdCookie) {
              console.log(`[AutoDetect] SUCCESS! programmatically extracted JSESSIONID cookie: "${jsessionIdCookie.value}"`);
              resolved = true;
              ws.close();
              resolve(jsessionIdCookie.value);
              return;
            }
          }
        } catch (e) {
          // Parse error
        }
      });

      ws.on('error', (err) => {
        console.error(`[AutoDetect] WebSocket CDP Connection error: ${err.message}`);
        if (!resolved) resolve(null);
      });

      ws.on('close', () => {
        if (!resolved) resolve(null);
      });

      // Timeout connection after 3 seconds
      setTimeout(() => {
        if (!resolved) {
          console.warn(`[AutoDetect] Connection to Chrome debugger tab timed out.`);
          ws.close();
          resolve(null);
        }
      }, 3000);
    });

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`[AutoDetect] Chrome remote debugging port is not open. (Chrome was not started with --remote-debugging-port=9222).`);
    } else {
      console.error(`[AutoDetect] Error checking debugger: ${error.message}`);
    }
    return null;
  }
}

module.exports = { autoDetectJSESSIONID };
