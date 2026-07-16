/**
 * Spaceman Game Trend Chart Visualizations
 * Setup and updates the historical trend chart using Chart.js.
 */

class SpacemanChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.chart = null;
    this.initChart();
  }

  initChart() {
    const ctx = this.canvas.getContext('2d');
    
    // Create neon gradients
    const lineGradient = ctx.createLinearGradient(0, 0, 0, 200);
    lineGradient.addColorStop(0, 'rgba(138, 43, 226, 0.4)');
    lineGradient.addColorStop(1, 'rgba(138, 43, 226, 0.0)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [], // Game IDs/Indices
        datasets: [{
          label: 'Multiplier',
          data: [],
          borderColor: '#8a2be2',
          borderWidth: 2,
          pointBackgroundColor: [],
          pointBorderColor: [],
          pointRadius: 4,
          pointHoverRadius: 6,
          backgroundColor: lineGradient,
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // We use our custom legend in HTML
          },
          tooltip: {
            backgroundColor: '#0f0c24',
            titleColor: '#9f9cb5',
            bodyColor: '#fff',
            borderColor: '#8a2be2',
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return `Multiplier: ${context.parsed.y.toFixed(2)}x`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.03)',
              drawBorder: false
            },
            ticks: {
              color: '#64617a',
              font: { size: 9 },
              maxRotation: 0
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.03)',
              drawBorder: false
            },
            ticks: {
              color: '#64617a',
              font: { size: 10 },
              callback: function(value) {
                return value + 'x';
              }
            },
            min: 1.00
          }
        }
      }
    });
  }

  // Update chart data with chronological multipliers (left-to-right oldest first)
  update(multipliers) {
    if (!this.chart) return;
    
    // Take the last 30 games and reverse them so they flow chronologically (oldest to newest)
    const recentGames = multipliers.slice(0, 30).reverse();
    
    // Build labels
    const labels = recentGames.map((_, index) => `#${index + 1}`);
    
    // Map point colors based on category
    const pointColors = recentGames.map(val => {
      if (val < 2.00) return '#ff3366'; // Red
      if (val < 10.00) return '#00ffaa'; // Green
      return '#ffcc00'; // Gold
    });

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = recentGames;
    this.chart.data.datasets[0].pointBackgroundColor = pointColors;
    this.chart.data.datasets[0].pointBorderColor = pointColors;
    
    // Automatically scale Y-axis limit depending on the values to keep it readable, max scaling to 50x or 100x if jackpot exists
    const maxVal = Math.max(...recentGames);
    this.chart.options.scales.y.max = maxVal > 15 ? Math.min(Math.round(maxVal * 1.1), 100) : 15;
    
    this.chart.update();
  }
}

// Global initialization helper
window.SpacemanChart = SpacemanChart;
