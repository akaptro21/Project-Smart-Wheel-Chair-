/**
 * Smart Ride - Interactive Navigation Map Controller
 * Features:
 * - High-precision indoor LiDAR blueprint vector floorplan
 * - Interactive waypoint selection & autonomous pathfinding
 * - Animated Smart Ride vehicle location marker with heading vector
 * - Dynamic obstacle simulation and re-routing calculations
 */

class MapNavigation {
  constructor() {
    this.canvas = document.getElementById('map-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.rooms = [
      { id: 'living', name: 'Living Room', x: 120, y: 110, w: 220, h: 160, color: '#2c292a' },
      { id: 'kitchen', name: 'Kitchen & Dining', x: 370, y: 110, w: 180, h: 200, color: '#2c292a' },
      { id: 'bedroom', name: 'Master Bedroom', x: 120, y: 300, w: 200, h: 160, color: '#2c292a' },
      { id: 'office', name: 'Tech Study / Office', x: 350, y: 340, w: 200, h: 120, color: '#2c292a' },
      { id: 'dock', name: 'Autonomous Charging Dock', x: 580, y: 130, w: 140, h: 110, color: '#373434' },
      { id: 'patio', name: 'Accessible Patio', x: 580, y: 280, w: 140, h: 180, color: '#211f1f' }
    ];

    this.waypoints = [
      { id: 'wp-living', name: 'Living Room Hub', x: 230, y: 190 },
      { id: 'wp-kitchen', name: 'Kitchen Counter', x: 460, y: 200 },
      { id: 'wp-bedroom', name: 'Bedside Station', x: 220, y: 380 },
      { id: 'wp-office', name: 'Work Desk', x: 450, y: 400 },
      { id: 'wp-dock', name: 'Fast Charger', x: 650, y: 185 },
      { id: 'wp-patio', name: 'Garden View', x: 650, y: 370 }
    ];

    this.vehicle = {
      x: 230,
      y: 190,
      targetX: 230,
      targetY: 190,
      heading: 0,
      speed: 0.04
    };

    this.currentPath = [];
    this.pathStep = 0;
    this.obstacles = [
      { x: 340, y: 200, r: 18, label: 'Coffee Table' },
      { x: 230, y: 280, r: 16, label: 'Door Threshold' }
    ];

    this.activeDestination = 'Living Room Hub';
    this.init();
  }

  init() {
    this.bindEvents();
    this.startAnimationLoop();
  }

  bindEvents() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Check if clicked near a waypoint
      let chosenWP = this.waypoints.find(wp => Math.hypot(wp.x - clickX, wp.y - clickY) < 30);
      if (chosenWP) {
        this.setDestination(chosenWP.x, chosenWP.y, chosenWP.name);
      } else {
        this.setDestination(clickX, clickY, `Custom Coord (${Math.round(clickX/10)}, ${Math.round(clickY/10)})`);
      }
    });

    // Waypoint button clicks
    const wpBtns = document.querySelectorAll('.waypoint-btn');
    wpBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const wpId = btn.dataset.wp;
        const targetWP = this.waypoints.find(w => w.id === wpId);
        if (targetWP) {
          this.setDestination(targetWP.x, targetWP.y, targetWP.name);
          wpBtns.forEach(b => b.classList.remove('bg-primary-container', 'text-white'));
          btn.classList.add('bg-primary-container', 'text-white');
        }
      });
    });
  }

  setDestination(tx, ty, name) {
    this.activeDestination = name;
    const destLabel = document.getElementById('map-destination-label');
    const etaLabel = document.getElementById('map-eta-label');
    const statusLabel = document.getElementById('map-status-label');

    if (destLabel) destLabel.textContent = name;
    if (statusLabel) {
      statusLabel.textContent = 'PLOTTING ROUTE...';
      setTimeout(() => {
        statusLabel.textContent = 'AUTONOMOUS TRANSIT ACTIVE';
      }, 500);
    }

    // Build intelligent path avoiding obstacles
    this.currentPath = this.computePath(this.vehicle.x, this.vehicle.y, tx, ty);
    this.pathStep = 0;

    const totalDist = Math.hypot(tx - this.vehicle.x, ty - this.vehicle.y);
    if (etaLabel) {
      const etaSeconds = Math.max(3, Math.round(totalDist / 12));
      etaLabel.textContent = `ETA: ${etaSeconds}s (${(totalDist * 0.05).toFixed(1)}m)`;
    }
  }

  computePath(sx, sy, ex, ey) {
    // Generate intermediate waypoint for obstacle avoidance if direct line crosses obstacle
    const path = [{ x: sx, y: sy }];
    
    // Check if middle area needs waypoint
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;
    
    let detourNeeded = false;
    for (const obs of this.obstacles) {
      if (Math.hypot(obs.x - midX, obs.y - midY) < obs.r + 25) {
        detourNeeded = true;
        path.push({ x: midX + 35, y: midY - 35 });
        break;
      }
    }

    path.push({ x: ex, y: ey });
    return path;
  }

  drawFloorplan() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background grid
    ctx.fillStyle = '#151313';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(66, 71, 76, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Rooms
    this.rooms.forEach(room => {
      ctx.fillStyle = room.color;
      ctx.strokeStyle = '#42474c';
      ctx.lineWidth = 2;
      ctx.fillRect(room.x, room.y, room.w, room.h);
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      // Room Title
      ctx.fillStyle = '#8c9197';
      ctx.font = '11px Chivo, sans-serif';
      ctx.fillText(room.name.toUpperCase(), room.x + 12, room.y + 22);
    });

    // Obstacles
    this.obstacles.forEach(obs => {
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#ff5449';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffb4ab';
      ctx.font = '9px monospace';
      ctx.fillText(obs.label, obs.x - obs.r, obs.y + obs.r + 12);
    });

    // Waypoints
    this.waypoints.forEach(wp => {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb596';
      ctx.fill();
      ctx.strokeStyle = '#e37038';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#e7e1e1';
      ctx.font = '10px monospace';
      ctx.fillText(wp.name, wp.x + 12, wp.y + 4);
    });
  }

  drawPathAndVehicle() {
    const ctx = this.ctx;

    // Draw active trajectory path
    if (this.currentPath.length > 1) {
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#e37038';
      ctx.lineWidth = 3;
      this.currentPath.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vehicle transit animation
    if (this.currentPath.length > 1 && this.pathStep < this.currentPath.length - 1) {
      const target = this.currentPath[this.pathStep + 1];
      const dx = target.x - this.vehicle.x;
      const dy = target.y - this.vehicle.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 2) {
        this.vehicle.heading = Math.atan2(dy, dx);
        this.vehicle.x += (dx / dist) * 1.8;
        this.vehicle.y += (dy / dist) * 1.8;
      } else {
        this.pathStep++;
      }
    }

    // Draw Smart Ride Vehicle Icon
    ctx.save();
    ctx.translate(this.vehicle.x, this.vehicle.y);
    ctx.rotate(this.vehicle.heading);

    // Glowing perception field
    const pGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 35);
    pGrad.addColorStop(0, 'rgba(227, 112, 56, 0.4)');
    pGrad.addColorStop(1, 'rgba(227, 112, 56, 0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();

    // Wheelchair Base
    ctx.fillStyle = '#e37038';
    ctx.fillRect(-12, -8, 24, 16);
    ctx.fillStyle = '#ffdea4';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(4, -6);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  startAnimationLoop() {
    const loop = () => {
      this.drawFloorplan();
      this.drawPathAndVehicle();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.MapNavigation = MapNavigation;
