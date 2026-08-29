/**
 * Smart Ride - AI Object Detection & Vision HUD Controller
 * Features:
 * - Real-time animated optical simulator feed
 * - Dynamic AI object bounding boxes with confidence scores & distances
 * - Collision warning radar & proximity alert states
 * - Multi-layer HUD filtering (Bounding Boxes, Depth Field, Semantic Segmentation)
 */

class ObjectDetectionHUD {
  constructor() {
    this.canvas = document.getElementById('detection-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.showBoundingBoxes = true;
    this.showDistances = true;
    this.showOpticalFlow = true;

    this.detectedObjects = [
      { id: 1, label: 'Pedestrian', x: 220, y: 140, w: 90, h: 210, vx: 0.6, dist: 3.2, conf: 0.96, type: 'person' },
      { id: 2, label: 'Office Chair', x: 480, y: 220, w: 80, h: 110, vx: -0.2, dist: 1.8, conf: 0.94, type: 'obstacle' },
      { id: 3, label: 'Step / Threshold', x: 140, y: 320, w: 120, h: 40, vx: 0, dist: 1.1, conf: 0.91, type: 'hazard' },
      { id: 4, label: 'Doorway Frame', x: 50, y: 80, w: 110, h: 260, vx: 0, dist: 4.5, conf: 0.98, type: 'safe' }
    ];

    this.init();
  }

  init() {
    this.bindControls();
    this.startDetectionLoop();
  }

  bindControls() {
    const boxToggle = document.getElementById('toggle-boxes');
    const distToggle = document.getElementById('toggle-dist');
    const flowToggle = document.getElementById('toggle-flow');

    if (boxToggle) boxToggle.addEventListener('change', (e) => this.showBoundingBoxes = e.target.checked);
    if (distToggle) distToggle.addEventListener('change', (e) => this.showDistances = e.target.checked);
    if (flowToggle) flowToggle.addEventListener('change', (e) => this.showOpticalFlow = e.target.checked);
  }

  drawSyntheticCameraFeed() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Simulated indoor hallway scene
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#100e0e');
    grad.addColorStop(0.5, '#1e1c1c');
    grad.addColorStop(1, '#2c292a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Perspective floor lines
    ctx.strokeStyle = 'rgba(227, 112, 56, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(0, h);
    ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w * 0.25, h);
    ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w * 0.5, h);
    ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w * 0.75, h);
    ctx.moveTo(w / 2, h * 0.4); ctx.lineTo(w, h);
    ctx.stroke();

    // AI scan line
    const scanY = (Date.now() * 0.15) % h;
    ctx.strokeStyle = 'rgba(227, 112, 56, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(w, scanY);
    ctx.stroke();
  }

  drawObjects() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    let closestDist = 999;
    let closestLabel = 'Clear';

    this.detectedObjects.forEach(obj => {
      // Simulate subtle target movement
      obj.x += obj.vx;
      if (obj.x < 30 || obj.x + obj.w > w - 30) obj.vx *= -1;

      if (obj.dist < closestDist) {
        closestDist = obj.dist;
        closestLabel = obj.label;
      }

      if (!this.showBoundingBoxes) return;

      let color = '#38bdf8'; // Blue safe
      if (obj.dist < 1.5) color = '#ff5449'; // Red danger
      else if (obj.dist < 2.5) color = '#e7c17a'; // Amber warn

      // Bounding box corners
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);

      // Corner accent brackets
      const cl = 8;
      ctx.fillStyle = color;
      ctx.fillRect(obj.x, obj.y, cl, 2);
      ctx.fillRect(obj.x, obj.y, 2, cl);
      ctx.fillRect(obj.x + obj.w - cl, obj.y, cl, 2);
      ctx.fillRect(obj.x + obj.w - 2, obj.y, 2, cl);

      // Label background & text
      ctx.fillStyle = 'rgba(21, 19, 19, 0.85)';
      ctx.fillRect(obj.x, obj.y - 20, obj.w, 18);

      ctx.fillStyle = color;
      ctx.font = 'bold 11px Chivo, monospace';
      ctx.fillText(`${obj.label} ${(obj.conf * 100).toFixed(0)}%`, obj.x + 4, obj.y - 6);

      // Distance tag
      if (this.showDistances) {
        ctx.fillStyle = '#e7e1e1';
        ctx.font = '10px monospace';
        ctx.fillText(`DIST: ${obj.dist.toFixed(1)}m`, obj.x + 4, obj.y + obj.h + 14);
      }
    });

    // Update proximity hazard banner
    const proxBanner = document.getElementById('proximity-alert-banner');
    const proxVal = document.getElementById('closest-dist-value');
    if (proxVal) proxVal.textContent = `${closestDist.toFixed(1)}m (${closestLabel})`;

    if (proxBanner) {
      if (closestDist < 1.5) {
        proxBanner.className = 'px-md py-xs rounded bg-error text-on-error font-technical text-technical animate-pulse';
        proxBanner.textContent = 'CRITICAL PROXIMITY HAZARD';
      } else if (closestDist < 2.5) {
        proxBanner.className = 'px-md py-xs rounded bg-secondary-container text-on-secondary-container font-technical text-technical';
        proxBanner.textContent = 'OBJECT IN PATH (CAUTION)';
      } else {
        proxBanner.className = 'px-md py-xs rounded bg-surface-container text-primary font-technical text-technical';
        proxBanner.textContent = 'PATH CLEAR • SAFE CLEARANCE';
      }
    }
  }

  startDetectionLoop() {
    const loop = () => {
      this.drawSyntheticCameraFeed();
      this.drawObjects();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.ObjectDetectionHUD = ObjectDetectionHUD;
