/**
 * Spaceman Real-Time Flight Canvas Animation
 * Renders cosmic background, launch trajectory, particle engine, and explosion effects.
 */

class SpacemanAnimation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.animationId = null;
    this.state = 'WAITING'; // WAITING, FLYING, CRASHED
    this.multiplier = 1.00;
    
    // Canvas dimensions
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Animation properties
    this.particles = [];
    this.explosionParticles = [];
    this.rocketX = 50;
    this.rocketY = this.height - 50;
    
    this.flightPathPoints = [];
    
    // Starry speed
    this.speedFactor = 1;
  }

  resize() {
    this.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.parentElement.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // Adjust rocket positioning on resize
    if (this.state === 'WAITING') {
      this.rocketX = 50;
      this.rocketY = this.height - 50;
    }
  }

  startFlight() {
    this.state = 'FLYING';
    this.flightPathPoints = [];
    this.explosionParticles = [];
    this.multiplier = 1.00;
    this.rocketX = 50;
    this.rocketY = this.height - 50;
    
    // Add starting point
    this.flightPathPoints.push({ x: this.rocketX, y: this.rocketY });
    
    if (!this.animationId) {
      this.animate();
    }
  }

  updateMultiplier(mult) {
    if (this.state !== 'FLYING') return;
    this.multiplier = mult;
    
    // Increase speed factor as multiplier grows
    this.speedFactor = Math.min(1 + (mult - 1) * 2, 10);
    
    // Calculate new position based on an exponential-style curve
    // Trajectory starts bottom-left (50, height-50) and goes top-right (width-100, 50)
    const progress = Math.min((mult - 1.00) / 10.00, 1.00); // Caps visual curve height at 10x range
    
    const targetX = 50 + (this.width - 150) * progress;
    // Exponential curve: goes up more steeply
    const targetY = (this.height - 50) - (this.height - 150) * Math.pow(progress, 0.7);
    
    // Smooth interpolation to target
    this.rocketX += (targetX - this.rocketX) * 0.1;
    this.rocketY += (targetY - this.rocketY) * 0.1;
    
    this.flightPathPoints.push({ x: this.rocketX, y: this.rocketY });
    
    // Position the HTML astronaut avatar to match the canvas coordinate
    const avatar = document.getElementById('spacemanAvatar');
    if (avatar) {
      // Offset so avatar is centered on rocket coordinates
      avatar.style.left = `${this.rocketX}px`;
      avatar.style.top = `${this.rocketY}px`;
    }
  }

  crash() {
    this.state = 'CRASHED';
    this.speedFactor = 0;
    
    // Spawn explosion particles
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.explosionParticles.push({
        x: this.rocketX,
        y: this.rocketY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color: Math.random() > 0.5 ? '#ff3366' : '#ffcc00',
        size: 2 + Math.random() * 4
      });
    }
  }

  reset() {
    this.state = 'WAITING';
    this.multiplier = 1.00;
    this.speedFactor = 0.5;
    this.flightPathPoints = [];
    this.explosionParticles = [];
    this.rocketX = this.width / 2;
    this.rocketY = this.height / 2 + 30;
    
    // Reset avatar style
    const avatar = document.getElementById('spacemanAvatar');
    if (avatar) {
      avatar.style.left = '50%';
      avatar.style.top = '65%';
    }
  }

  // Draw background stars
  drawEnvironment() {
    const ctx = this.ctx;
    
    // Clear canvas with dark cosmic space gradient
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#0c0a21');
    grad.addColorStop(1, '#05030d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Handle particles (passing space dust)
    if (this.particles.length < 50) {
      this.particles.push({
        x: this.width + Math.random() * 100,
        y: Math.random() * this.height,
        size: Math.random() * 2,
        speed: 1 + Math.random() * 3,
        alpha: 0.2 + Math.random() * 0.5
      });
    }
    
    ctx.fillStyle = '#ffffff';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      // Move particles left-down according to flying speed
      p.x -= p.speed * this.speedFactor;
      p.y += p.speed * 0.3 * this.speedFactor;
      
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      
      // Remove out of bounds
      if (p.x < 0 || p.y > this.height) {
        this.particles.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // Draw flight curve
  drawTrajectory() {
    if (this.flightPathPoints.length < 2) return;
    
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.flightPathPoints[0].x, this.flightPathPoints[0].y);
    
    for (let i = 1; i < this.flightPathPoints.length; i++) {
      ctx.lineTo(this.flightPathPoints[i].x, this.flightPathPoints[i].y);
    }
    
    // Draw neon trajectory line
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 255, 170, 0.6)';
    ctx.stroke();
    
    // Draw gradient fill below line
    ctx.shadowBlur = 0; // Reset shadow
    ctx.lineTo(this.rocketX, this.height);
    ctx.lineTo(this.flightPathPoints[0].x, this.height);
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, this.rocketY, 0, this.height);
    fillGrad.addColorStop(0, 'rgba(0, 255, 170, 0.15)');
    fillGrad.addColorStop(1, 'rgba(0, 255, 170, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  // Draw explosion particles
  drawExplosion() {
    const ctx = this.ctx;
    
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const ep = this.explosionParticles[i];
      ep.x += ep.vx;
      ep.y += ep.vy;
      ep.vy += 0.1; // gravity pull
      ep.alpha -= 0.02;
      
      if (ep.alpha <= 0) {
        this.explosionParticles.splice(i, 1);
        continue;
      }
      
      ctx.globalAlpha = ep.alpha;
      ctx.fillStyle = ep.color;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  animate() {
    this.drawEnvironment();
    
    if (this.state === 'FLYING') {
      this.drawTrajectory();
    } else if (this.state === 'CRASHED') {
      this.drawTrajectory();
      this.drawExplosion();
    } else {
      // WAITING state floating effect
      const floatOffset = Math.sin(Date.now() / 400) * 10;
      this.rocketY = this.height / 2 + 20 + floatOffset;
      const avatar = document.getElementById('spacemanAvatar');
      if (avatar) {
        avatar.style.top = `calc(65% + ${floatOffset}px)`;
      }
    }
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }
}

// Global initialization helper
window.SpacemanAnimation = SpacemanAnimation;
