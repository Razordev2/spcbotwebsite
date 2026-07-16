/**
 * Spaceman Pattern Analysis Engine (Browser Version)
 * Analyzes historical game multiplier data and predicts next game trends using pattern matching.
 */

class PatternEngine {
  constructor() {
    this.history = []; // Array of historical multipliers, newest first
    this.maxHistorySize = 500;
  }

  setHistory(multipliers) {
    this.history = multipliers.slice(0, this.maxHistorySize);
    console.log(`[PatternEngine] Loaded ${this.history.length} historical records.`);
  }

  addRecord(multiplier) {
    this.history.unshift(multiplier);
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }
    console.log(`[PatternEngine] Added new result: ${multiplier}x. Active history: ${this.history.length}`);
  }

  classify(multiplier) {
    if (multiplier < 2.00) return 'RED';
    if (multiplier < 10.00) return 'GREEN';
    return 'GOLD';
  }

  getStats() {
    if (this.history.length === 0) return null;

    let redCount = 0;
    let greenCount = 0;
    let goldCount = 0;
    let sum = 0;

    this.history.forEach(val => {
      sum += val;
      const category = this.classify(val);
      if (category === 'RED') redCount++;
      else if (category === 'GREEN') greenCount++;
      else if (category === 'GOLD') goldCount++;
    });

    const total = this.history.length;
    
    // Calculate current streaks
    let currentStreakType = null;
    let currentStreakCount = 0;
    
    for (let i = 0; i < this.history.length; i++) {
      const cat = this.classify(this.history[i]);
      if (i === 0) {
        currentStreakType = cat;
        currentStreakCount = 1;
      } else {
        if (cat === currentStreakType) {
          currentStreakCount++;
        } else {
          break;
        }
      }
    }

    return {
      totalGames: total,
      average: parseFloat((sum / total).toFixed(2)),
      distribution: {
        red: { count: redCount, percent: parseFloat(((redCount / total) * 100).toFixed(1)) },
        green: { count: greenCount, percent: parseFloat(((greenCount / total) * 100).toFixed(1)) },
        gold: { count: goldCount, percent: parseFloat(((goldCount / total) * 100).toFixed(1)) }
      },
      currentStreak: {
        type: currentStreakType,
        count: currentStreakCount
      }
    };
  }

  predictNext() {
    if (this.history.length < 10) {
      return {
        prediction: 'WAIT',
        targetMultiplier: 1.00,
        confidence: 0,
        probabilities: { RED: 33, GREEN: 33, GOLD: 34 },
        patternFound: 'Insufficient Data'
      };
    }

    const categories = this.history.map(m => this.classify(m));

    let matchLength = 3;
    let matches = [];
    let patternStr = '';

    while (matchLength > 0) {
      const currentPattern = categories.slice(0, matchLength);
      patternStr = [...currentPattern].reverse().join(' -> ');

      for (let i = matchLength; i < categories.length - 1; i++) {
        let isMatch = true;
        for (let j = 0; j < matchLength; j++) {
          if (categories[i + j] !== currentPattern[j]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          matches.push({
            category: categories[i - 1],
            multiplier: this.history[i - 1]
          });
        }
      }

      if (matches.length >= 3 || matchLength === 1) {
        break;
      }
      matchLength--;
      matches = [];
    }

    if (matches.length === 0) {
      const stats = this.getStats();
      const fallbackPrediction = stats.distribution.red.percent > 55 ? 'GREEN' : 'RED';
      return {
        prediction: fallbackPrediction,
        targetMultiplier: fallbackPrediction === 'GREEN' ? 2.10 : 1.25,
        confidence: 45,
        probabilities: {
          RED: stats.distribution.red.percent,
          GREEN: stats.distribution.green.percent,
          GOLD: stats.distribution.gold.percent
        },
        patternFound: 'Fallback (Global Statistics)'
      };
    }

    let matchRed = 0;
    let matchGreen = 0;
    let matchGold = 0;
    const rawMultipliers = [];

    matches.forEach(m => {
      rawMultipliers.push(m.multiplier);
      if (m.category === 'RED') matchRed++;
      else if (m.category === 'GREEN') matchGreen++;
      else if (m.category === 'GOLD') matchGold++;
    });

    const totalMatches = matches.length;
    const probRed = Math.round((matchRed / totalMatches) * 100);
    const probGreen = Math.round((matchGreen / totalMatches) * 100);
    const probGold = Math.round((matchGold / totalMatches) * 100);

    let prediction = 'RED';
    let maxProb = probRed;

    if (probGreen > maxProb) {
      prediction = 'GREEN';
      maxProb = probGreen;
    }
    if (probGold > maxProb && probGold > 20) {
      prediction = 'GOLD';
      maxProb = probGold;
    }

    rawMultipliers.sort((a, b) => a - b);
    const trimCount = Math.floor(rawMultipliers.length * 0.1);
    const trimmed = rawMultipliers.slice(trimCount, rawMultipliers.length - trimCount);
    
    let targetMultiplier = 1.50;
    if (trimmed.length > 0) {
      const sumTrimmed = trimmed.reduce((acc, v) => acc + v, 0);
      targetMultiplier = parseFloat((sumTrimmed / trimmed.length).toFixed(2));
    } else {
      const sumAll = rawMultipliers.reduce((acc, v) => acc + v, 0);
      targetMultiplier = parseFloat((sumAll / rawMultipliers.length).toFixed(2));
    }

    if (prediction === 'RED' && targetMultiplier >= 2.00) {
      targetMultiplier = parseFloat((1.05 + Math.random() * 0.8).toFixed(2));
    } else if (prediction === 'GREEN' && targetMultiplier < 2.00) {
      targetMultiplier = parseFloat((2.05 + Math.random() * 1.5).toFixed(2));
    } else if (prediction === 'GOLD' && targetMultiplier < 10.00) {
      targetMultiplier = parseFloat((10.10 + Math.random() * 15.0).toFixed(2));
    }

    const lengthWeight = matchLength * 20;
    const consistencyWeight = maxProb * 0.4;
    let confidence = Math.min(Math.round(lengthWeight + consistencyWeight), 95);

    if (totalMatches < 5) {
      confidence = Math.round(confidence * 0.7);
    }

    return {
      prediction,
      targetMultiplier,
      confidence,
      probabilities: {
        RED: probRed,
        GREEN: probGreen,
        GOLD: probGold
      },
      patternFound: `Matched [${patternStr}] (${totalMatches} occurrences)`
    };
  }

  getAnalysisReport() {
    const stats = this.getStats();
    if (!stats) return null;

    const prediction = this.predictNext();
    
    return {
      stats,
      prediction,
      last300Games: this.history.slice(0, 300).map(m => ({
        multiplier: m,
        category: this.classify(m)
      })),
      last20Games: this.history.slice(0, 20).map(m => ({
        multiplier: m,
        category: this.classify(m)
      }))
    };
  }
}

// Bind to window
window.PatternEngine = PatternEngine;
