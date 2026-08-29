/**
 * Smart Ride — 24V LiFePO4 Battery Management System (BMS) & Telemetry Controller
 * Implements 8S Configuration, Cell Balancing, Thermal Monitoring & Regenerative Telemetry
 */

class BatteryBMSController {
  constructor() {
    this.soc = 88.0; // State of Charge %
    this.soh = 98.0; // State of Health %
    this.voltage = 26.8; // Pack Voltage (V) for 8S LiFePO4
    this.current = -3.2; // Pack Current (A), negative = discharging
    this.power = 85.8; // Power (W)
    this.temp = 28.5; // Pack Temp (°C)
    this.rangeKm = 34.8; // Estimated Range (km)
    this.cycleCount = 142; // Total Cycles
    this.regenEfficiency = 14.2; // +14.2% Dynamic Braking Capture
    this.chargingMode = 'idle'; // 'fast', 'idle', 'drive'
    this.isCharging = false;

    // 8S LiFePO4 Cell Matrix (Nominal 3.20V - 3.40V, 3.35V avg)
    this.cells = [
      { id: 1, label: 'C1', v: 3.36, temp: 28.3, balancing: false },
      { id: 2, label: 'C2', v: 3.34, temp: 28.5, balancing: false },
      { id: 3, label: 'C3', v: 3.36, temp: 28.6, balancing: true },
      { id: 4, label: 'C4', v: 3.34, temp: 28.4, balancing: false },
      { id: 5, label: 'C5', v: 3.36, temp: 28.5, balancing: true },
      { id: 6, label: 'C6', v: 3.34, temp: 28.3, balancing: false },
      { id: 7, label: 'C7', v: 3.36, temp: 28.6, balancing: true },
      { id: 8, label: 'C8', v: 3.34, temp: 28.4, balancing: false },
    ];

    this.chartData = [];
    this.maxDataPoints = 30;
    for (let i = 0; i < this.maxDataPoints; i++) {
      this.chartData.push({
        voltage: 26.8 + (Math.random() * 0.1 - 0.05),
        current: 3.2 + (Math.random() * 0.4 - 0.2)
      });
    }

    this.init();
  }

  init() {
    this.bindControls();
    this.renderCellMatrix();
    this.updatePackStatsUI();
    this.startLiveSimulation();
  }

  bindControls() {
    // 24V Fast Charger Button
    const fastChgBtn = document.getElementById('bms-btn-fast-charge');
    if (fastChgBtn) {
      fastChgBtn.addEventListener('click', () => {
        this.toggleFastCharger();
      });
    }
  }

  toggleFastCharger() {
    this.isCharging = !this.isCharging;
    const btn = document.getElementById('bms-btn-fast-charge');

    if (this.isCharging) {
      this.chargingMode = 'fast';
      this.current = 15.0; // +15.0A fast charge
      this.power = this.voltage * this.current;
      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-pulse">offline_bolt</span> Fast Charging (28.8V 15A)`;
        btn.className = 'flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-xs font-bold transition-all shadow-lg glow-effect ring-2 ring-emerald-400';
      }
      if (window.appRouter) window.appRouter.showToast('⚡ 24V High-Rate Fast Charger Connected: 15A Constant Current');
    } else {
      this.chargingMode = 'idle';
      this.current = -3.2;
      this.power = Math.abs(this.voltage * this.current);
      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">power</span> Connect 24V Fast Charger`;
        btn.className = 'flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-mono text-xs font-bold transition-all shadow-lg glow-effect';
      }
      if (window.appRouter) window.appRouter.showToast('🔌 Fast Charger Disconnected. Returning to LiFePO4 battery power.');
    }
    this.updatePackStatsUI();
  }

  renderCellMatrix() {
    const container = document.getElementById('bms-cell-matrix-grid');
    if (!container) return;

    // Render 8 vertical cell bars matching Image 1
    // Range 3.20V (0% height) to 3.40V (100% height)
    const minV = 3.20;
    const maxV = 3.40;

    container.innerHTML = this.cells.map(cell => {
      const percentage = Math.min(100, Math.max(15, ((cell.v - minV) / (maxV - minV)) * 100));
      return `
        <div class="flex flex-col items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-surface/80 border border-outline-variant/20 hover:border-sky-400/50 transition-all group min-h-[220px]">
          <!-- Cell Top Label -->
          <div class="font-mono text-xs font-bold text-outline group-hover:text-on-surface transition-colors">${cell.label}</div>
          
          <!-- Vertical Cell Slot -->
          <div class="relative w-8 sm:w-10 h-32 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col justify-end p-1 overflow-hidden shadow-inner my-2">
            <!-- Background subtle height markers -->
            <div class="absolute inset-0 flex flex-col justify-between p-1 pointer-events-none opacity-20">
              <div class="w-full h-px bg-white"></div>
              <div class="w-full h-px bg-white"></div>
              <div class="w-full h-px bg-white"></div>
            </div>

            <!-- Gradient Vertical Fill -->
            <div class="w-full rounded-lg bg-gradient-to-t from-emerald-400 to-sky-400 shadow-md transition-all duration-500 relative" style="height: ${percentage}%">
              <!-- Glow cap on top of level -->
              <div class="absolute top-0 left-0 right-0 h-1.5 bg-white/70 rounded-t-lg shadow-sm"></div>
            </div>
          </div>

          <!-- Voltage Label at Bottom -->
          <div class="font-mono text-xs font-bold text-on-surface-variant group-hover:text-sky-400 transition-colors">
            ${cell.v.toFixed(2)}V
          </div>
        </div>
      `;
    }).join('');
  }

  updatePackStatsUI() {
    // Pack Voltage
    const voltEl = document.getElementById('bms-pack-voltage');
    if (voltEl) voltEl.textContent = `${this.voltage.toFixed(1)} V`;

    // Pack Temperature
    const tempEl = document.getElementById('bms-pack-temp');
    if (tempEl) tempEl.textContent = `${this.temp.toFixed(1)} °C`;

    // State of Health (SOH)
    const sohEl = document.getElementById('bms-pack-soh');
    if (sohEl) sohEl.textContent = `${Math.round(this.soh)}%`;

    // Regen Efficiency
    const regenEl = document.getElementById('bms-pack-regen');
    if (regenEl) regenEl.textContent = `+${this.regenEfficiency.toFixed(1)}%`;
  }

  startLiveSimulation() {
    setInterval(() => {
      // Subtle realistic micro-fluctuations
      if (this.isCharging) {
        this.cells.forEach(c => {
          c.v = Math.min(3.40, c.v + (Math.random() * 0.002));
        });
        this.voltage = Math.min(27.2, this.voltage + 0.005);
        this.temp = Math.min(31.0, this.temp + 0.01);
      } else {
        this.cells.forEach((c, i) => {
          // Keep C1, C3, C5, C7 at ~3.36V and C2, C4, C6, C8 at ~3.34V
          const base = (i % 2 === 0) ? 3.36 : 3.34;
          c.v = base + (Math.sin(Date.now() * 0.001 + i) * 0.004);
        });
        this.voltage = 26.8 + (Math.sin(Date.now() * 0.0008) * 0.05);
      }

      this.updatePackStatsUI();
      this.renderCellMatrix();
    }, 2000);
  }
}

window.BatteryBMSController = BatteryBMSController;
