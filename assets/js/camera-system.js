/**
 * Smart Ride — Unified AI Camera & Vision System Controller
 * Integrates Computer Vision Object Detection & Multi-Spectral Camera Views:
 * - AI Vision HUD (Bounding Boxes, Proximity Hazards, Optical Flow)
 * - Front AI Optical Camera
 * - LiDAR Depth False-Color Heatmap
 * - Rear Reverse Camera
 * Features top-right mode switcher.
 */

class CameraSystemController {
  constructor() {
    this.canvas = document.getElementById('camera-feed-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.activeMode = 'ai_vision'; // 'ai_vision', 'optical', 'depth', 'rear'
    this.showBoundingBoxes = true;
    this.showDistances = true;
    this.showOpticalFlow = true;
    this.showGuidanceLines = true;
    this.showEnvelope = true;

    // AI Detected Spatial Objects
    this.detectedObjects = [
      { id: 1, label: 'Pedestrian', x: 220, y: 130, w: 85, h: 200, vx: 0.6, dist: 3.2, conf: 0.96, type: 'person' },
      { id: 2, label: 'Office Chair', x: 480, y: 210, w: 80, h: 110, vx: -0.3, dist: 1.8, conf: 0.94, type: 'obstacle' },
      { id: 3, label: 'Step / Threshold', x: 140, y: 310, w: 120, h: 40, vx: 0, dist: 1.1, conf: 0.91, type: 'hazard' },
      { id: 4, label: 'Doorway Frame', x: 50, y: 80, w: 110, h: 260, vx: 0, dist: 4.5, conf: 0.98, type: 'safe' }
    ];

    this.init();
  }

  init() {
    this.bindEvents();
    this.startFeedLoop();
  }

  bindEvents() {
    // Mode Switcher Buttons (Top-Right segmented switch)
    const modeBtns = document.querySelectorAll('.cam-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => {
          b.className = 'cam-mode-btn px-3 sm:px-4 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface transition-all font-mono text-xs font-bold';
        });
        btn.className = 'cam-mode-btn px-3 sm:px-4 py-1.5 rounded-lg bg-primary-container text-white border border-primary font-mono text-xs font-bold transition-all shadow-md';
        
        this.activeMode = btn.dataset.camMode || 'ai_vision';
        const title = document.getElementById('camera-mode-title');
        if (title) title.textContent = btn.textContent.trim().toUpperCase();

        const banner = document.getElementById('cam-status-banner');
        if (banner) {
          if (this.activeMode === 'ai_vision') {
            banner.textContent = 'AI SPATIAL INFERENCE ACTIVE • 50 FPS';
            banner.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-primary-container/20 text-primary border border-primary/30';
          } else if (this.activeMode === 'depth') {
            banner.textContent = 'LiDAR DEPTH STREAM • ISOLINES 360°';
            banner.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
          } else if (this.activeMode === 'rear') {
            banner.textContent = 'REAR REVERSING RADAR ENGAGED';
            banner.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
          } else {
            banner.textContent = 'OPTICAL FEED: 1080p 60FPS';
            banner.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          }
        }
      });
    });

    // Interactive HUD Overlays
    const boxToggle = document.getElementById('cam-toggle-boxes');
    const distToggle = document.getElementById('cam-toggle-dist');
    const flowToggle = document.getElementById('cam-toggle-flow');
    const guideToggle = document.getElementById('cam-toggle-guidance');

    if (boxToggle) boxToggle.addEventListener('change', (e) => this.showBoundingBoxes = e.target.checked);
    if (distToggle) distToggle.addEventListener('change', (e) => this.showDistances = e.target.checked);
    if (flowToggle) flowToggle.addEventListener('change', (e) => this.showOpticalFlow = e.target.checked);
    if (guideToggle) guideToggle.addEventListener('change', (e) => this.showGuidanceLines = e.target.checked);
  }

  renderFeed() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = Date.now() * 0.002;

    ctx.clearRect(0, 0, w, h);

    if (this.activeMode === 'ai_vision') {
      // AI Vision Mode Feed
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#100e0e');
      bg.addColorStop(0.5, '#1e1c1c');
      bg.addColorStop(1, '#2c292a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // AI perspective floor lines
      ctx.strokeStyle = 'rgba(227, 112, 56, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(0, h);
      ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w * 0.25, h);
      ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w * 0.5, h);
      ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w * 0.75, h);
      ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w, h);
      ctx.stroke();

      // Scanline
      const scanY = (Date.now() * 0.15) % h;
      ctx.strokeStyle = 'rgba(227, 112, 56, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.stroke();

      // Render Detected Objects
      this.renderDetectedObjects(ctx, w, h);

    } else if (this.activeMode === 'optical') {
      // Clean Optical AI view
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#121010');
      bg.addColorStop(0.6, '#1d1b1b');
      bg.addColorStop(1, '#2a2728');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Floor grid
      ctx.strokeStyle = 'rgba(227, 112, 56, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 40) {
        ctx.beginPath();
        ctx.moveTo(w / 2, h * 0.35);
        ctx.lineTo(i, h);
        ctx.stroke();
      }

    } else if (this.activeMode === 'depth') {
      // LiDAR Depth False-Color Heatmap
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1e1b4b'); // Deep blue
      grad.addColorStop(0.4, '#0284c7'); // Cyan
      grad.addColorStop(0.7, '#eab308'); // Yellow
      grad.addColorStop(1, '#ef4444'); // Red near
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Depth contour isolines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      for (let y = h * 0.4; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(t + y * 0.05) * 8);
        ctx.lineTo(w, y + Math.sin(t + y * 0.05) * 8);
        ctx.stroke();
      }

    } else if (this.activeMode === 'rear') {
      // Rear camera with reversing grid
      ctx.fillStyle = '#151313';
      ctx.fillRect(0, 0, w, h);
      
      // Reversing guide tracks
      ctx.strokeStyle = '#ef4444'; // Red 0.5m
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.85); ctx.lineTo(w * 0.75, h * 0.85);
      ctx.stroke();

      ctx.strokeStyle = '#eab308'; // Yellow 1.5m
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * 0.65); ctx.lineTo(w * 0.7, h * 0.65);
      ctx.stroke();

      ctx.strokeStyle = '#22c55e'; // Green 3.0m
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.45); ctx.lineTo(w * 0.65, h * 0.45);
      ctx.stroke();
    }

    // Dynamic Overlays
    if (this.showGuidanceLines) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.4); ctx.lineTo(w * 0.15, h);
      ctx.moveTo(w * 0.65, h * 0.4); ctx.lineTo(w * 0.85, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.showEnvelope) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.4);
      ctx.lineTo(w * 0.65, h * 0.4);
      ctx.lineTo(w * 0.85, h);
      ctx.lineTo(w * 0.15, h);
      ctx.closePath();
      ctx.fill();
    }

    // Center Crosshair Reticle
    ctx.strokeStyle = '#ffb596';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 12, 0, Math.PI * 2);
    ctx.moveTo(w / 2 - 18, h / 2); ctx.lineTo(w / 2 + 18, h / 2);
    ctx.moveTo(w / 2, h / 2 - 18); ctx.lineTo(w / 2, h / 2 + 18);
    ctx.stroke();

    // Timestamp & Watermark
    ctx.fillStyle = '#ffb596';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(`CAM_STREAM // LATENCY: 12ms // MODE: ${this.activeMode.toUpperCase()}`, 16, 24);
  }

  renderDetectedObjects(ctx, w, h) {
    let closestDist = 999;
    let closestLabel = 'Clear';

    this.detectedObjects.forEach(obj => {
      obj.x += obj.vx;
      if (obj.x < 30 || obj.x + obj.w > w - 30) obj.vx *= -1;

      if (obj.dist < closestDist) {
        closestDist = obj.dist;
        closestLabel = obj.label;
      }

      if (!this.showBoundingBoxes) return;

      let color = '#38bdf8'; // Blue safe
      if (obj.dist < 1.5) color = '#ff5449'; // Red danger
      else if (obj.dist < 2.5) color = '#e7c17a'; // Yellow warning

      // Corner brackets bounding box
      const corner = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(obj.x, obj.y + corner); ctx.lineTo(obj.x, obj.y); ctx.lineTo(obj.x + corner, obj.y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(obj.x + obj.w - corner, obj.y); ctx.lineTo(obj.x + obj.w, obj.y); ctx.lineTo(obj.x + obj.w, obj.y + corner);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(obj.x, obj.y + obj.h - corner); ctx.lineTo(obj.x, obj.y + obj.h); ctx.lineTo(obj.x + corner, obj.y + obj.h);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(obj.x + obj.w - corner, obj.y + obj.h); ctx.lineTo(obj.x + obj.w, obj.y + obj.h); ctx.lineTo(obj.x + obj.w, obj.y + obj.h - corner);
      ctx.stroke();

      // Label Tag
      ctx.fillStyle = color;
      ctx.fillRect(obj.x, obj.y - 20, Math.max(90, obj.label.length * 9), 18);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText(`${obj.label} ${(obj.conf * 100).toFixed(0)}%`, obj.x + 4, obj.y - 7);

      // Distance Tag
      if (this.showDistances) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(obj.x, obj.y + obj.h + 2, 55, 16);
        ctx.fillStyle = color;
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(`${obj.dist.toFixed(1)}m`, obj.x + 4, obj.y + obj.h + 14);
      }

      // Optical flow vector
      if (this.showOpticalFlow && Math.abs(obj.vx) > 0.05) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const centerX = obj.x + obj.w / 2;
        const centerY = obj.y + obj.h / 2;
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + obj.vx * 35, centerY);
        ctx.stroke();
      }
    });

    const closestEl = document.getElementById('closest-dist-value');
    if (closestEl) {
      closestEl.textContent = `${closestDist.toFixed(1)}m (${closestLabel})`;
    }
  }

  startFeedLoop() {
    const loop = () => {
      this.renderFeed();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.CameraSystemController = CameraSystemController;
