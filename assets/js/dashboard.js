/**
 * Smart Ride — Central Telemetry Dashboard Controller (Control Colony)
 * Features:
 * - Real-time vehicle diagnostics, kinematics & gyro compass
 * - 360° LiDAR radar sweep & velocity torque streaming
 * - Quick Actuators: Headlights, Hazards, Horn Chime, Seat Tilt Slider, E-Stop
 * - Test Hazard Simulation & Interactive Virtual Joystick
 */

class TelemetryDashboard {
  constructor() {
    this.speed = 4.2;
    this.targetSpeed = 4.2;
    this.battery = 88;
    this.headingDeg = 4;
    this.nearestObstacle = 1.90;
    this.isHazardSim = true;
    this.safetyState = 'WARNING';
    this.isEStop = false;
    this.headlightsOn = false;
    this.hazardsOn = false;
    this.seatTilt = 0;
    this.driveMode = 'AUTONOMOUS';

    this.chartData = Array(30).fill(4.0);
    this.radarBlips = [
      { angle: 0.4, dist: 0.6, label: 'Pedestrian', type: 'warn' },
      { angle: 1.8, dist: 0.4, label: 'Pillar', type: 'safe' },
      { angle: 3.5, dist: 0.75, label: 'Doorway', type: 'safe' },
      { angle: 5.2, dist: 0.3, label: 'Stairs', type: 'danger' }
    ];

    this.radarAngle = 0;
    this.init();
  }

  init() {
    this.initRadar();
    this.initChart();
    this.bindControls();
    this.bindJoystick();
    this.startTelemetryInterval();
  }

  initRadar() {
    this.radarCanvas = document.getElementById('radar-canvas');
    if (!this.radarCanvas) return;
    this.radarCtx = this.radarCanvas.getContext('2d');
    
    const drawRadar = () => {
      const ctx = this.radarCtx;
      if (!ctx || !this.radarCanvas) return;
      const w = this.radarCanvas.width;
      const h = this.radarCanvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy) - 10;

      ctx.clearRect(0, 0, w, h);

      // Radar background circles
      ctx.strokeStyle = 'rgba(140, 145, 151, 0.2)';
      ctx.lineWidth = 1;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (radius / 3) * r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();

      // Radar sweep cone
      this.radarAngle += 0.04;
      if (this.radarAngle > Math.PI * 2) this.radarAngle -= Math.PI * 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, this.radarAngle - 0.5, this.radarAngle);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      sweepGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // Draw obstacle blips
      this.radarBlips.forEach(blip => {
        const bx = cx + Math.cos(blip.angle) * (blip.dist * radius);
        const by = cy + Math.sin(blip.angle) * (blip.dist * radius);

        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        if (blip.type === 'danger') {
          ctx.fillStyle = '#ff5449';
        } else if (blip.type === 'warn') {
          ctx.fillStyle = '#f59e0b';
        } else {
          ctx.fillStyle = '#38bdf8';
        }
        ctx.fill();
      });

      // Self center point
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      requestAnimationFrame(drawRadar);
    };

    requestAnimationFrame(drawRadar);
  }

  initChart() {
    this.chartCanvas = document.getElementById('telemetry-chart');
    if (!this.chartCanvas) return;
    this.chartCtx = this.chartCanvas.getContext('2d');

    const drawChart = () => {
      const ctx = this.chartCtx;
      if (!ctx || !this.chartCanvas) return;
      const w = this.chartCanvas.width;
      const h = this.chartCanvas.height;

      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(66, 71, 76, 0.25)';
      ctx.lineWidth = 1;
      for (let y = 20; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw speed line
      ctx.beginPath();
      const step = w / (this.chartData.length - 1);
      this.chartData.forEach((val, i) => {
        const x = i * step;
        const y = h - (val / 8.0) * (h - 20) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Fill area below
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      requestAnimationFrame(drawChart);
    };

    requestAnimationFrame(drawChart);
  }

  playAudioTone(freq = 660, type = 'sine', duration = 0.2) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('WebAudio not supported or blocked:', e);
    }
  }

  bindControls() {
    // 1. Hazard Simulation Button
    const hazardBtn = document.getElementById('btn-test-hazard');
    if (hazardBtn) {
      hazardBtn.addEventListener('click', () => {
        this.isHazardSim = !this.isHazardSim;
        if (this.isHazardSim) {
          this.safetyState = 'WARNING';
          this.nearestObstacle = 1.90;
          this.playAudioTone(880, 'triangle', 0.25);
          if (window.appRouter) window.appRouter.showToast('⚠️ Hazard Simulation: Proximal Obstacle in 1.9m Envelope');
        } else {
          this.safetyState = 'OPTIMAL';
          this.nearestObstacle = 3.85;
          this.playAudioTone(520, 'sine', 0.15);
          if (window.appRouter) window.appRouter.showToast('✅ Safety State: Optimal Navigation Path Clear');
        }
        this.updateSafetyUI();
      });
    }

    // Round Emergency SOS Button in Telemetry
    const roundSosBtn = document.getElementById('telemetry-sos-round-btn');
    const sosStatusText = document.getElementById('telemetry-sos-status-text');
    let sosActive = false;

    if (roundSosBtn) {
      roundSosBtn.addEventListener('click', () => {
        sosActive = !sosActive;
        if (sosActive) {
          roundSosBtn.classList.add('animate-ping-slow', 'ring-8', 'ring-rose-500/50', 'bg-rose-600');
          roundSosBtn.classList.remove('bg-rose-500');
          this.playAudioTone(960, 'sawtooth', 0.3);
          setTimeout(() => this.playAudioTone(640, 'sawtooth', 0.3), 300);
          
          if (sosStatusText) {
            sosStatusText.innerHTML = '<span class="text-rose-400 font-bold animate-pulse">🚨 DISPATCH ACTIVE • GPS BROADCASTING</span>';
          }
          if (window.appRouter) {
            window.appRouter.showToast('🚨 EMERGENCY SOS BROADCAST: Caregiver Elena Mercer & EMT Notified (GPS: 37.7749° N, 122.4194° W)');
          }
          // Engage emergency stop
          this.targetSpeed = 0;
          this.speed = 0;
          this.safetyState = 'EMERGENCY STOP';
          this.updateSafetyUI();
        } else {
          roundSosBtn.classList.remove('animate-ping-slow', 'ring-8', 'ring-rose-500/50', 'bg-rose-600');
          roundSosBtn.classList.add('bg-rose-500');
          if (sosStatusText) {
            sosStatusText.innerHTML = '<span class="text-emerald-400 font-bold">● STANDBY • ARMED FOR DISPATCH</span>';
          }
          if (window.appRouter) {
            window.appRouter.showToast('Emergency SOS Cancelled. System returned to standby.');
          }
        }
      });
    }

    // 6. Emergency Stop Buttons
    const estopAction = () => {
      this.isEStop = !this.isEStop;
      const estopBtn1 = document.getElementById('btn-instant-estop');
      const estopBtn2 = document.getElementById('header-estop-btn');

      if (this.isEStop) {
        this.targetSpeed = 0;
        this.speed = 0;
        this.safetyState = 'EMERGENCY STOP';
        this.playAudioTone(300, 'sawtooth', 0.4);
        if (estopBtn1) estopBtn1.textContent = '🛑 Emergency Interlock Active';
        if (estopBtn2) estopBtn2.textContent = 'STOPPED';
        if (window.appRouter) window.appRouter.showToast('🚨 EMERGENCY STOP ENGAGED: In-Wheel Magnetic Brakes Locked');
      } else {
        this.targetSpeed = 4.2;
        this.safetyState = this.isHazardSim ? 'WARNING' : 'OPTIMAL';
        if (estopBtn1) estopBtn1.innerHTML = '<span class="material-symbols-outlined text-[22px]">pan_tool</span> Instant Emergency Stop';
        if (estopBtn2) estopBtn2.innerHTML = '<span class="material-symbols-outlined text-[16px]">pan_tool</span> E-STOP';
        if (window.appRouter) window.appRouter.showToast('Electromagnetic Brakes Released. Autonomy Restored.');
      }
      this.updateSafetyUI();
    };

    const estopBtn1 = document.getElementById('btn-instant-estop');
    const estopBtn2 = document.getElementById('header-estop-btn');
    if (estopBtn1) estopBtn1.addEventListener('click', estopAction);
    if (estopBtn2) estopBtn2.addEventListener('click', estopAction);

    // 7. Driving Mode Selector
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => {
          b.className = 'mode-btn py-2 rounded-lg bg-surface-container text-on-surface-variant text-center transition-all';
        });
        btn.className = 'mode-btn py-2 rounded-lg bg-sky-500 text-white text-center transition-all shadow font-bold';
        this.driveMode = btn.dataset.mode || 'AUTONOMOUS';
        if (window.appRouter) window.appRouter.showToast(`Driving Mode Switched to: ${this.driveMode}`);
      });
    });

    // 8. Sidebar SOS Button
    const sideSos = document.getElementById('side-sos-btn');
    if (sideSos) {
      sideSos.addEventListener('click', () => {
        if (window.authController) {
          window.authController.triggerEmergencySOS();
        }
      });
    }
  }

  bindJoystick() {
    const openBtn = document.getElementById('btn-open-joystick');
    const sideBtn = document.getElementById('side-joystick-btn');
    const modal = document.getElementById('joystick-modal');
    const closeBtn = document.getElementById('joystick-close-btn');

    const openModal = () => {
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (window.appRouter) window.appRouter.showToast('🎮 Virtual Joystick Armed: Use Arrow Keys or D-Pad');
      }
    };

    const closeModal = () => {
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (sideBtn) sideBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // D-Pad buttons
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    const thumb = document.getElementById('joystick-thumb');

    dpadBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.dir;
        this.handleJoystickDirection(dir, thumb);
      });
    });

    // Arrow keys listener
    window.addEventListener('keydown', (e) => {
      if (!modal || modal.classList.contains('hidden')) return;
      if (e.key === 'ArrowUp') this.handleJoystickDirection('up', thumb);
      if (e.key === 'ArrowDown') this.handleJoystickDirection('down', thumb);
      if (e.key === 'ArrowLeft') this.handleJoystickDirection('left', thumb);
      if (e.key === 'ArrowRight') this.handleJoystickDirection('right', thumb);
      if (e.key === ' ') this.handleJoystickDirection('stop', thumb);
    });
  }

  handleJoystickDirection(dir, thumb) {
    if (dir === 'up') {
      this.targetSpeed = 5.6;
      this.headingDeg = 0;
      if (thumb) thumb.style.transform = 'translateY(-30px)';
    } else if (dir === 'down') {
      this.targetSpeed = 2.0;
      this.headingDeg = 180;
      if (thumb) thumb.style.transform = 'translateY(30px)';
    } else if (dir === 'left') {
      this.headingDeg = (this.headingDeg - 30 + 360) % 360;
      if (thumb) thumb.style.transform = 'translateX(-30px)';
    } else if (dir === 'right') {
      this.headingDeg = (this.headingDeg + 30) % 360;
      if (thumb) thumb.style.transform = 'translateX(30px)';
    } else if (dir === 'stop') {
      this.targetSpeed = 0;
      if (thumb) thumb.style.transform = 'translate(0,0)';
    }

    setTimeout(() => {
      if (thumb && dir !== 'stop') thumb.style.transform = 'translate(0,0)';
    }, 400);
  }

  updateSafetyUI() {
    const kpiState = document.getElementById('kpi-safety-state');
    const kpiSub = document.getElementById('kpi-safety-sub');
    const statusPill = document.getElementById('telemetry-status-pill');
    const statusText = document.getElementById('telemetry-status-text');
    const obstacleVal = document.getElementById('kpi-obstacle');

    if (kpiState) kpiState.textContent = this.safetyState;
    if (obstacleVal) obstacleVal.textContent = `${this.nearestObstacle.toFixed(2)} m`;

    if (this.safetyState === 'WARNING') {
      if (kpiState) kpiState.className = 'text-3xl sm:text-4xl font-display font-black text-amber-400 uppercase';
      if (kpiSub) kpiSub.textContent = 'Auto-Brake: Active (0.5m)';
      if (statusPill) statusPill.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-bold shadow-sm';
      if (statusText) statusText.textContent = 'STATUS: WARNING';
    } else if (this.safetyState === 'EMERGENCY STOP') {
      if (kpiState) kpiState.className = 'text-3xl sm:text-4xl font-display font-black text-rose-500 uppercase';
      if (kpiSub) kpiSub.textContent = 'Brakes Engaged (Locked)';
      if (statusPill) statusPill.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold shadow-sm';
      if (statusText) statusText.textContent = 'STATUS: E-STOP';
    } else {
      if (kpiState) kpiState.className = 'text-3xl sm:text-4xl font-display font-black text-emerald-400 uppercase';
      if (kpiSub) kpiSub.textContent = 'Auto-Brake: Standby (3.0m Clear)';
      if (statusPill) statusPill.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-400 font-bold shadow-sm';
      if (statusText) statusText.textContent = 'STATUS: OPTIMAL';
    }
  }

  startTelemetryInterval() {
    setInterval(() => {
      if (!this.isEStop) {
        // Lerp speed toward target
        this.speed += (this.targetSpeed - this.speed) * 0.18 + (Math.random() - 0.5) * 0.12;
        this.speed = Math.max(0, this.speed);

        // Micro gyro jitter
        this.headingDeg += (Math.random() - 0.5) * 1.5;
        this.headingDeg = (this.headingDeg + 360) % 360;
      }

      this.chartData.push(this.speed);
      this.chartData.shift();

      // UI readouts
      const kpiSpeed = document.getElementById('kpi-speed');
      const pillSpeed = document.getElementById('pill-speed-val');
      const speedDial = document.getElementById('speed-readout');
      const headingKpi = document.getElementById('kpi-heading');
      const compassNeedle = document.getElementById('compass-needle');
      const compassDeg = document.getElementById('compass-deg-text');

      const speedStr = `${this.speed.toFixed(1)} km/h`;
      if (kpiSpeed) kpiSpeed.textContent = speedStr;
      if (pillSpeed) pillSpeed.textContent = speedStr;
      if (speedDial) speedDial.textContent = this.speed.toFixed(1);

      if (headingKpi) headingKpi.textContent = `${this.headingDeg.toFixed(0)}° N • Forward Vector`;
      if (compassNeedle) compassNeedle.style.transform = `rotate(${this.headingDeg}deg)`;
      if (compassDeg) compassDeg.textContent = `${String(Math.round(this.headingDeg)).padStart(3, '0')}° GYRO HEADING`;

    }, 200);
  }
}

window.TelemetryDashboard = TelemetryDashboard;
