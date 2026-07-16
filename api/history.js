const https = require('https');

module.exports = async (req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { tableId, JSESSIONID } = req.query;
  
  if (!tableId || !JSESSIONID) {
    res.status(400).json({ error: 'tableId and JSESSIONID query parameters are required' });
    return;
  }

  const url = `https://games.domxyrxsfevpzjeg.net/api/ui/statisticHistory?tableId=${tableId}&numberOfGames=300&JSESSIONID=${JSESSIONID}&game_mode=lobby_desktop`;

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://eca004.kaca189b.online/crash',
      'Origin': 'https://eca004.kaca189b.online'
    },
    timeout: 8000
  };

  https.get(url, options, (apiRes) => {
    let data = '';

    apiRes.on('data', (chunk) => {
      data += chunk;
    });

    apiRes.on('end', () => {
      try {
        if (apiRes.statusCode === 200) {
          const parsedData = JSON.parse(data);
          res.status(200).json(parsedData);
        } else {
          res.status(apiRes.statusCode).json({ 
            error: `API returned status code ${apiRes.statusCode}`,
            details: data 
          });
        }
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse JSON response from game server', details: data });
      }
    });

  }).on('error', (err) => {
    res.status(500).json({ error: `HTTPS request failed: ${err.message}` });
  });
};
