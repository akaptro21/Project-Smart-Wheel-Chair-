/**
 * Smart Ride - AI Camera System & Multi-Spectral Feed Controller
 * Features:
 * - 4-view switcher (Optical AI, LiDAR Depth Heatmap, Night Vision Infrared, Rear Cam)
 * - Interactive HUD overlay toggles (Guidance Lines, Clearance Envelope, Semantic Segmentation)
 * - Snapshot capture with instant visual feedback
 */

class CameraSystemController {
  constructor() {
    this.canvas = document.getElementById('camera-feed-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.activeMode = 'optical'; // 'optical', 'depth', 'infrared', 'rear'
    this.showGuidanceLines = true;
    this.showEnvelope = true;
    this.showSemanticMask = false;

    this.init();
  }

  init() {
    this.bindEvents();
    this.startFeedLoop();
  }

  bindEvents() {
    // Mode Buttons
    const modeBtns = document.querySelectorAll('.cam-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('bg-primary-container', 'text-white', 'border-primary'));
        btn.classList.add('bg-primary-container', 'text-white', 'border-primary');
        this.activeMode = btn.dataset.camMode || 'optical';
        const title = document.getElementById('camera-mode-title');
        if (title) title.textContent = btn.textContent.trim().toUpperCase();
      });
    });

    // Overlays
    const guideToggle = document.getElementById('cam-toggle-guidance');
    const envToggle = document.getElementById('cam-toggle-envelope');
    const segToggle = document.getElementById('cam-toggle-seg');
    const snapBtn = document.getElementById('cam-snapshot-btn');

    if (guideToggle) guideToggle.addEventListener('change', (e) => this.showGuidanceLines = e.target.checked);
    if (envToggle) envToggle.addEventListener('change', (e) => this.showEnvelope = e.target.checked);
    if (segToggle) segToggle.addEventListener('change', (e) => this.showSemanticMask = e.target.checked);

    if (snapBtn) {
      snapBtn.addEventListener('click', () => {
        const flash = document.createElement('div');
        flash.className = 'fixed inset-0 bg-white z-[999] opacity-80 transition-opacity duration-300 pointer-events-none';
        document.body.appendChild(flash);
        setTimeout(() => {
          flash.style.opacity = '0';
          setTimeout(() => flash.remove(), 300);
        }, 50);
      });
    }
  }

  renderFeed() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = Date.now() * 0.002;

    ctx.clearRect(0, 0, w, h);

    if (this.activeMode === 'optical') {
      // High-tech RGB scene
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#100e0e');
      bg.addColorStop(0.6, '#1d1b1b');
      bg.addColorStop(1, '#2c292a');
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      for (let y = h * 0.4; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(t + y * 0.05) * 8);
        ctx.lineTo(w, y + Math.sin(t + y * 0.05) * 8);
        ctx.stroke();
      }

    } else if (this.activeMode === 'infrared') {
      // Infrared Thermography
      ctx.fillStyle = '#061a10';
      ctx.fillRect(0, 0, w, h);

      // Noise grain
      for (let i = 0; i < 400; i++) {
        const nx = Math.random() * w;
        const ny = Math.random() * h;
        ctx.fillStyle = `rgba(34, 197, 94, ${Math.random() * 0.25})`;
        ctx.fillRect(nx, ny, 2, 2);
      }

      // Heat silhouettes
      ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
      ctx.beginPath();
      ctx.arc(w * 0.45, h * 0.55, 45, 0, Math.PI * 2);
      ctx.fill();

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
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.4);
      ctx.lineTo(w * 0.65, h * 0.4);
      ctx.lineTo(w * 0.85, h);
      ctx.lineTo(w * 0.15, h);
      ctx.closePath();
      ctx.fill();
    }

    // Reticle center
    ctx.strokeStyle = '#ffb596';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2);
    ctx.moveTo(w / 2 - 20, h / 2); ctx.lineTo(w / 2 + 20, h / 2);
    ctx.moveTo(w / 2, h / 2 - 20); ctx.lineTo(w / 2, h / 2 + 20);
    ctx.stroke();

    // Timestamp & Watermark
    ctx.fillStyle = '#ffb596';
    ctx.font = '10px monospace';
    ctx.fillText(`CAM_FEED_01 // LATENCY: 12ms // FPS: 60`, 16, 24);
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
