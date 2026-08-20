/**
 * Smart Ride — Battery Management System (BMS) & Telemetry Controller
 * Provides real-time cell balancing, thermal simulation, power curves, and diagnostics.
 */

class BatteryBMSController {
  constructor() {
    this.soc = 87.4; // State of Charge %
    this.soh = 98.6; // State of Health %
    this.voltage = 53.28; // Pack Voltage (V)
    this.current = -4.85; // Pack Current (A), negative = discharging
    this.power = 258.4; // Power (W)
    this.temp = 28.4; // Pack Temp (°C)
    this.rangeKm = 42.8; // Estimated Range (km)
    this.cycleCount = 142;
    this.chargingMode = 'standard'; // 'fast', 'standard', 'regen', 'idle'
    this.isCharging = false;
    this.fanSpeed = 1450; // RPM

    // 16 Series Cell Matrix (Nominal 3.33V LiFePO4 cells)
    this.cells = [
      { id: 1, v: 3.331, temp: 28.1, balancing: false },
      { id: 2, v: 3.329, temp: 28.3, balancing: false },
      { id: 3, v: 3.330, temp: 28.4, balancing: true },
      { id: 4, v: 3.328, temp: 28.2, balancing: false },
      { id: 5, v: 3.332, temp: 28.6, balancing: true },
      { id: 6, v: 3.330, temp: 28.5, balancing: false },
      { id: 7, v: 3.329, temp: 28.3, balancing: false },
      { id: 8, v: 3.331, temp: 28.2, balancing: false },
      { id: 9, v: 3.330, temp: 28.4, balancing: false },
      { id: 10, v: 3.332, temp: 28.5, balancing: true },
      { id: 11, v: 3.329, temp: 28.7, balancing: false },
      { id: 12, v: 3.331, temp: 28.4, balancing: false },
      { id: 13, v: 3.328, temp: 28.2, balancing: false },
      { id: 14, v: 3.330, temp: 28.3, balancing: false },
      { id: 15, v: 3.331, temp: 28.5, balancing: false },
      { id: 16, v: 3.329, temp: 28.4, balancing: false },
    ];

    this.chartData = [];
    this.maxDataPoints = 40;
    for (let i = 0; i < this.maxDataPoints; i++) {
      this.chartData.push({
        voltage: 53.2 + (Math.random() * 0.2 - 0.1),
        current: 4.8 + (Math.random() * 0.6 - 0.3)
      });
    }

    this.canvas = null;
    this.ctx = null;
    this.animId = null;

    this.init();
  }

  init() {
    this.initElements();
    this.bindControls();
    this.renderCellMatrix();
    this.updatePackStatsUI();
    this.startLiveSimulation();
    this.initBMSChart();
  }

  initElements() {
    this.canvas = document.getElementById('bms-telemetry-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
  }

  bindControls() {
    // Fast Charge Toggle
    const fastChgBtn = document.getElementById('bms-btn-fast-charge');
    if (fastChgBtn) {
      fastChgBtn.addEventListener('click', () => {
        this.toggleCharging('fast');
      });
    }

    // Standard Charge Toggle
    const stdChgBtn = document.getElementById('bms-btn-std-charge');
    if (stdChgBtn) {
      stdChgBtn.addEventListener('click', () => {
        this.toggleCharging('standard');
      });
    }

    // Discharge / Driving Toggle
    const driveBtn = document.getElementById('bms-btn-drive-mode');
    if (driveBtn) {
      driveBtn.addEventListener('click', () => {
        this.isCharging = false;
        this.chargingMode = 'drive';
        this.current = -(4.5 + Math.random() * 3.5);
        this.updateButtonsState();
        this.logBMSEvent('System operating in Dynamic Traction Drive mode');
      });
    }

    // Run Full Diagnostic Self-Test
    const diagBtn = document.getElementById('bms-btn-run-diagnostic');
    if (diagBtn) {
      diagBtn.addEventListener('click', () => {
        this.runDiagnosticSequence(diagBtn);
      });
    }

    // Active Balancer Toggle
    const balanceToggle = document.getElementById('bms-toggle-balancer');
    if (balanceToggle) {
      balanceToggle.addEventListener('change', (e) => {
        const active = e.target.checked;
        this.cells.forEach(c => {
          c.balancing = active && (c.v > 3.330);
        });
        this.renderCellMatrix();
        this.logBMSEvent(active ? 'Passive/Active cell balancer online (Delta threshold 2mV)' : 'Cell balancer paused by operator');
      });
    }
  }

  toggleCharging(mode) {
    if (this.isCharging && this.chargingMode === mode) {
      // Turn off charging
      this.isCharging = false;
      this.chargingMode = 'drive';
      this.current = -3.8;
      this.logBMSEvent('Charging disconnected. Returning to standby power draw.');
    } else {
      this.isCharging = true;
      this.chargingMode = mode;
      if (mode === 'fast') {
        this.current = 18.5; // +18.5A charge current
        this.power = this.voltage * this.current;
        this.logBMSEvent('⚡ 600W DC Ultra-Fast Charger connected. High-rate current ramped.');
      } else {
        this.current = 6.2; // +6.2A standard charge current
        this.power = this.voltage * this.current;
        this.logBMSEvent('🔌 Standard AC Medical Dock connected. Constant Current/Constant Voltage charging.');
      }
    }
    this.updateButtonsState();
  }

  updateButtonsState() {
    const fastBtn = document.getElementById('bms-btn-fast-charge');
    const stdBtn = document.getElementById('bms-btn-std-charge');
    const driveBtn = document.getElementById('bms-btn-drive-mode');

    if (fastBtn) {
      fastBtn.className = (this.isCharging && this.chargingMode === 'fast') 
        ? 'px-4 py-2 rounded-xl bg-primary-container text-white font-bold text-xs shadow-lg ring-2 ring-primary transition-all'
        : 'px-4 py-2 rounded-xl bg-surface hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold transition-all';
    }

    if (stdBtn) {
      stdBtn.className = (this.isCharging && this.chargingMode === 'standard') 
        ? 'px-4 py-2 rounded-xl bg-primary-container text-white font-bold text-xs shadow-lg ring-2 ring-primary transition-all'
        : 'px-4 py-2 rounded-xl bg-surface hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold transition-all';
    }

    if (driveBtn) {
      driveBtn.className = (!this.isCharging) 
        ? 'px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 font-bold text-xs transition-all'
        : 'px-4 py-2 rounded-xl bg-surface hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold transition-all';
    }
  }

  renderCellMatrix() {
    const container = document.getElementById('bms-cell-matrix-grid');
    if (!container) return;

    let minV = 999, maxV = -999;
    this.cells.forEach(c => {
      if (c.v < minV) minV = c.v;
      if (c.v > maxV) maxV = c.v;
    });
    const deltaV = Math.round((maxV - minV) * 1000); // in mV

    const deltaEl = document.getElementById('bms-delta-v');
    if (deltaEl) {
      deltaEl.textContent = `${deltaV} mV`;
      deltaEl.className = deltaV <= 8 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold';
    }

    container.innerHTML = this.cells.map((cell, idx) => {
      const percentage = Math.min(100, Math.max(10, ((cell.v - 3.0) / (3.45 - 3.0)) * 100));
      return `
        <div class="p-3 rounded-xl bg-surface border ${cell.balancing ? 'border-primary/60 bg-primary/5' : 'border-outline-variant/20'} relative flex flex-col justify-between transition-all group hover:border-primary">
          <div class="flex items-center justify-between text-[11px] font-mono">
            <span class="text-outline">C${String(cell.id).padStart(2, '0')}</span>
            ${cell.balancing ? '<span class="flex items-center gap-1 text-[10px] text-primary font-bold"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>BAL</span>' : `<span class="text-on-surface-variant text-[10px]">${cell.temp.toFixed(1)}°C</span>`}
          </div>
          
          <div class="my-2">
            <div class="text-base font-bold font-mono text-on-surface">${cell.v.toFixed(3)}<span class="text-xs text-outline font-normal">V</span></div>
            <div class="w-full bg-surface-container-highest h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div class="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
            </div>
          </div>

          <div class="flex items-center justify-between text-[10px] font-mono text-outline">
            <span>LiFePO4</span>
            <span class="${cell.v >= 3.325 ? 'text-emerald-400' : 'text-amber-400'}">NOM</span>
          </div>
        </div>
      `;
    }).join('');
  }

  updatePackStatsUI() {
    // SOC
    const socEl = document.getElementById('bms-pack-soc');
    const socBar = document.getElementById('bms-pack-soc-bar');
    const socRadial = document.getElementById('bms-soc-radial');
    if (socEl) socEl.textContent = `${this.soc.toFixed(1)}%`;
    if (socBar) socBar.style.width = `${this.soc}%`;
    if (socRadial) {
      const circumference = 283; // 2 * pi * 45
      const offset = circumference - (this.soc / 100) * circumference;
      socRadial.style.strokeDashoffset = offset;
    }

    // SOH
    const sohEl = document.getElementById('bms-pack-soh');
    if (sohEl) sohEl.textContent = `${this.soh.toFixed(1)}%`;

    // Voltage
    const voltEl = document.getElementById('bms-pack-voltage');
    if (voltEl) voltEl.textContent = `${this.voltage.toFixed(2)} V`;

    // Current
    const currEl = document.getElementById('bms-pack-current');
    if (currEl) {
      currEl.textContent = `${this.current >= 0 ? '+' : ''}${this.current.toFixed(2)} A`;
      currEl.className = this.current >= 0 ? 'text-emerald-400 font-bold' : 'text-primary font-bold';
    }

    // Power
    const pwrEl = document.getElementById('bms-pack-power');
    if (pwrEl) {
      const calcPwr = Math.abs(this.voltage * this.current);
      pwrEl.textContent = `${calcPwr.toFixed(1)} W`;
    }

    // Temp
    const tempEl = document.getElementById('bms-pack-temp');
    if (tempEl) tempEl.textContent = `${this.temp.toFixed(1)} °C`;

    // Estimated Range
    const rangeEl = document.getElementById('bms-pack-range');
    if (rangeEl) rangeEl.textContent = `${this.rangeKm.toFixed(1)} km`;

    // Cycles
    const cycleEl = document.getElementById('bms-pack-cycles');
    if (cycleEl) cycleEl.textContent = `${this.cycleCount}`;

    // Fan RPM
    const fanEl = document.getElementById('bms-fan-rpm');
    if (fanEl) fanEl.textContent = `${this.fanSpeed} RPM`;
  }

  startLiveSimulation() {
    setInterval(() => {
      // Simulate live fluctuations
      if (this.isCharging) {
        if (this.soc < 99.8) {
          const increment = this.chargingMode === 'fast' ? 0.04 : 0.015;
          this.soc += increment;
          this.rangeKm += increment * 0.48;
          this.temp = Math.min(36.5, this.temp + 0.02);
          this.fanSpeed = Math.min(2800, this.fanSpeed + 15);
        }
      } else {
        // Minor battery drain when driving / idle
        this.soc = Math.max(5.0, this.soc - 0.004);
        this.rangeKm = Math.max(1.0, (this.soc / 100) * 49.0);
        this.temp = Math.max(26.0, this.temp - 0.01);
        this.fanSpeed = Math.max(1200, this.fanSpeed - 5);
      }

      // Cell voltage fluctuations
      this.cells.forEach(c => {
        const jitter = (Math.random() * 0.002 - 0.001);
        if (this.isCharging) {
          c.v = Math.min(3.42, c.v + (this.chargingMode === 'fast' ? 0.0006 : 0.0002) + jitter);
        } else {
          c.v = Math.max(3.15, c.v - 0.0001 + jitter);
        }
      });

      // Sum voltage
      this.voltage = this.cells.reduce((sum, c) => sum + c.v, 0);

      // Add to chart history
      this.chartData.push({
        voltage: this.voltage,
        current: Math.abs(this.current)
      });
      if (this.chartData.length > this.maxDataPoints) {
        this.chartData.shift();
      }

      this.updatePackStatsUI();
      this.renderCellMatrix();
      this.drawBMSChart();
    }, 1000);
  }

  initBMSChart() {
    this.drawBMSChart();
    window.addEventListener('resize', () => this.drawBMSChart());
  }

  drawBMSChart() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = 'rgba(140, 145, 151, 0.12)';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (this.chartData.length < 2) return;

    // Draw Voltage Curve (Orange / Primary)
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#e37038';

    const vMin = 50.0;
    const vMax = 55.0;
    const stepX = width / (this.maxDataPoints - 1);

    this.chartData.forEach((d, idx) => {
      const x = idx * stepX;
      const normalizedV = (d.voltage - vMin) / (vMax - vMin);
      const y = height - (normalizedV * (height - 30) + 15);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Voltage Fill Gradient
    ctx.lineTo((this.chartData.length - 1) * stepX, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradV = ctx.createLinearGradient(0, 0, 0, height);
    gradV.addColorStop(0, 'rgba(227, 112, 56, 0.25)');
    gradV.addColorStop(1, 'rgba(227, 112, 56, 0.0)');
    ctx.fillStyle = gradV;
    ctx.fill();

    // Draw Current Curve (Amber / Secondary)
    ctx.beginPath();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#e7c17a';

    const cMin = 0;
    const cMax = 25;

    this.chartData.forEach((d, idx) => {
      const x = idx * stepX;
      const normalizedC = (d.current - cMin) / (cMax - cMin);
      const y = height - (normalizedC * (height - 40) + 10);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Live Pulse Dot on newest point
    const lastIdx = this.chartData.length - 1;
    const lastX = lastIdx * stepX;
    const lastVNorm = (this.chartData[lastIdx].voltage - vMin) / (vMax - vMin);
    const lastY = height - (lastVNorm * (height - 30) + 15);

    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb596';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  runDiagnosticSequence(btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">sync</span> Running Diagnostic Matrix...`;
    
    this.logBMSEvent('🔍 Initiating Comprehensive BMS Diagnostics Sequence...');

    setTimeout(() => {
      this.logBMSEvent('✓ Stage 1: MOSFET Gate Driver Integrity & Pre-charge Check — PASS (0.2 ms response)');
    }, 600);

    setTimeout(() => {
      this.logBMSEvent('✓ Stage 2: Cell Interconnect Impedance & ΔV Balancer Scan — PASS (Max ΔV 4mV)');
    }, 1200);

    setTimeout(() => {
      this.logBMSEvent('✓ Stage 3: Dual NTC Thermistor Calibration & Active Cooling Fans — PASS (1450 RPM)');
    }, 1800);

    setTimeout(() => {
      this.logBMSEvent('🟢 ALL 16 BMS SAFETY CRITICAL SYSTEMS PASSED WITH 100% HEALTH INDEX');
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">verified</span> Run Health Diagnostics`;
    }, 2400);
  }

  logBMSEvent(msg) {
    const list = document.getElementById('bms-event-log-list');
    if (!list) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const item = document.createElement('div');
    item.className = 'p-3 rounded-lg bg-surface border border-outline-variant/20 flex items-start gap-2.5 text-xs font-mono';
    item.innerHTML = `
      <span class="text-primary font-bold shrink-0">${timeStr}</span>
      <span class="text-on-surface">${msg}</span>
    `;
    list.prepend(item);

    // Keep max 15 log items
    while (list.children.length > 15) {
      list.removeChild(list.lastChild);
    }
  }
}

window.BatteryBMSController = BatteryBMSController;
