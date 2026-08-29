/**
 * Smart Ride - High Performance 90-Frame Scroll Sequence Animation
 * Features:
 * - Preloaded frame memory caching
 * - High-DPI canvas rendering with aspect ratio preservation
 * - Lerped requestAnimationFrame scroll smoothing (zero lag / jitter)
 * - Sticky scroll bounding with telemetry stage overlays
 */

class WheelchairScrollAnimation {
  constructor(options = {}) {
    this.container = document.getElementById(options.containerId || 'scroll-showcase');
    this.stickyContainer = document.getElementById(options.stickyId || 'sticky-frame-viewport');
    this.canvas = document.getElementById(options.canvasId || 'frame-canvas');
    this.progressBar = document.getElementById('preloader-fill');
    this.preloader = document.getElementById('scroll-preloader');
    this.scrubber = document.getElementById('manual-scrubber');

    if (!this.container || !this.canvas) {
      console.warn('Scroll showcase elements not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.frameCount = 90;
    this.frames = [];
    this.loadedCount = 0;
    this.isLoaded = false;

    this.targetFrameIndex = 0;
    this.currentFrameIndex = 0;
    this.lerpSpeed = 0.16;

    this.telemetryOverlays = [
      {
        id: 'telemetry-stage-1',
        range: [0.0, 0.25],
        title: 'SYS.01 // AERO-CARBON CHASSIS',
        subtitle: 'Structural Rigidity & Low CoG',
        metric: '72 kg NET WEIGHT • 180 kg PAYLOAD'
      },
      {
        id: 'telemetry-stage-2',
        range: [0.25, 0.50],
        title: 'SYS.02 // 360° LIDAR PERCEPTION',
        subtitle: 'Tri-Frequency Spatial Scanning',
        metric: '200,000 PTS/SEC • 0.02s LATENCY'
      },
      {
        id: 'telemetry-stage-3',
        range: [0.50, 0.75],
        title: 'SYS.03 // DUAL VECTOR HUB MOTORS',
        subtitle: 'High-Torque Regenerative Drive',
        metric: '120 Nm TORQUE • 35 KM RANGE'
      },
      {
        id: 'telemetry-stage-4',
        range: [0.75, 1.0],
        title: 'SYS.04 // NEURAL MOBILITY KERNEL',
        subtitle: 'Edge AI Autonomous Navigation',
        metric: 'VOICE INTENT & INSTANT AVOIDANCE'
      }
    ];

    this.init();
  }

  init() {
    this.resizeCanvas();
    this.preloadFrames();
    this.bindEvents();
    this.startRenderLoop();
  }

  getFramePath(index) {
    const pad = String(index + 1).padStart(3, '0');
    return `assets/frames/ezgif-frame-${pad}.png`;
  }

  preloadFrames() {
    for (let i = 0; i < this.frameCount; i++) {
      const img = new Image();
      img.src = this.getFramePath(i);
      img.onload = () => {
        this.loadedCount++;
        if (this.progressBar) {
          const pct = Math.round((this.loadedCount / this.frameCount) * 100);
          this.progressBar.style.width = `${pct}%`;
        }
        // Render first frame as soon as ready
        if (i === 0 && !this.isLoaded) {
          this.renderFrame(0);
        }
        if (this.loadedCount === this.frameCount) {
          this.isLoaded = true;
          if (this.preloader) {
            this.preloader.style.opacity = '0';
            setTimeout(() => {
              this.preloader.style.display = 'none';
            }, 500);
          }
        }
      };
      img.onerror = () => {
        this.loadedCount++;
      };
      this.frames[i] = img;
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    
    const displayWidth = Math.floor(rect.width || window.innerWidth);
    const displayHeight = Math.floor(rect.height || window.innerHeight);

    if (this.canvas.width !== displayWidth * dpr || this.canvas.height !== displayHeight * dpr) {
      this.canvas.width = displayWidth * dpr;
      this.canvas.height = displayHeight * dpr;
      this.canvas.style.width = `${displayWidth}px`;
      this.canvas.style.height = `${displayHeight}px`;
      this.ctx.scale(dpr, dpr);
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.renderFrame(Math.round(this.currentFrameIndex));
    });

    window.addEventListener('scroll', () => {
      this.updateScrollProgress();
    }, { passive: true });

    if (this.scrubber) {
      this.scrubber.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.targetFrameIndex = Math.min(this.frameCount - 1, Math.max(0, Math.round(val * (this.frameCount - 1))));
      });
    }
  }

  updateScrollProgress() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const totalScrollable = this.container.offsetHeight - window.innerHeight;
    
    if (totalScrollable <= 0) return;

    // Calculate clamped progress [0, 1] strictly within this sticky container
    const scrolled = -rect.top;
    const progress = Math.min(Math.max(scrolled / totalScrollable, 0), 1);

    this.targetFrameIndex = progress * (this.frameCount - 1);

    if (this.scrubber) {
      this.scrubber.value = progress;
    }

    this.updateTelemetry(progress);
  }

  updateTelemetry(progress) {
    const stage1 = document.getElementById('stage-card-1');
    const stage2 = document.getElementById('stage-card-2');
    const stage3 = document.getElementById('stage-card-3');
    const stage4 = document.getElementById('stage-card-4');
    const progressText = document.getElementById('telemetry-progress-text');
    const radialDegree = document.getElementById('telemetry-angle-text');

    if (progressText) {
      progressText.textContent = `${Math.round(progress * 100)}% ROTATION`;
    }
    if (radialDegree) {
      radialDegree.textContent = `${Math.round(progress * 360)}°`;
    }

    const cards = [stage1, stage2, stage3, stage4];
    cards.forEach((card, idx) => {
      if (!card) return;
      const minP = idx * 0.25;
      const maxP = (idx + 1) * 0.25;
      if (progress >= minP && progress <= maxP) {
        card.classList.remove('opacity-20', 'scale-95');
        card.classList.add('opacity-100', 'scale-100', 'border-primary', 'shadow-2xl', 'glow-effect');
      } else {
        card.classList.remove('opacity-100', 'scale-100', 'border-primary', 'shadow-2xl', 'glow-effect');
        card.classList.add('opacity-20', 'scale-95');
      }
    });
  }

  renderFrame(frameIndex) {
    const img = this.frames[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = this.canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
    const canvasHeight = this.canvas.height / (Math.min(window.devicePixelRatio || 1, 2));

    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Compute aspect-ratio contain sizing
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      renderHeight = canvasHeight * 0.88;
      renderWidth = renderHeight * imgRatio;
    } else {
      renderWidth = canvasWidth * 0.92;
      renderHeight = renderWidth / imgRatio;
    }

    offsetX = (canvasWidth - renderWidth) / 2;
    offsetY = (canvasHeight - renderHeight) / 2;

    // Draw subtle glowing backplate behind wheelchair
    const glowGradient = this.ctx.createRadialGradient(
      canvasWidth / 2, canvasHeight / 2, renderWidth * 0.1,
      canvasWidth / 2, canvasHeight / 2, renderWidth * 0.55
    );
    glowGradient.addColorStop(0, 'rgba(227, 112, 56, 0.16)');
    glowGradient.addColorStop(0.6, 'rgba(227, 112, 56, 0.04)');
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    this.ctx.fillStyle = glowGradient;
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Render 3D Frame Image
    this.ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
  }

  startRenderLoop() {
    const loop = () => {
      // Lerp frame calculation
      const diff = this.targetFrameIndex - this.currentFrameIndex;
      if (Math.abs(diff) > 0.005) {
        this.currentFrameIndex += diff * this.lerpSpeed;
        const frameToDraw = Math.min(this.frameCount - 1, Math.max(0, Math.round(this.currentFrameIndex)));
        this.renderFrame(frameToDraw);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.WheelchairScrollAnimation = WheelchairScrollAnimation;
