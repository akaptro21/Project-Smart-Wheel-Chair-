/**
 * Smart Ride — Master Application Controller & Router
 * Unifies all modules into an ultra-smooth, responsive Future Mobility OS experience.
 */

class SmartRideApp {
  constructor() {
    this.activeRoute = 'home';
    this.routes = ['home', 'features', 'dashboard', 'battery', 'map', 'camera', 'voice', 'profile', 'auth'];
    this.init();
  }

  init() {
    this.bindNavigation();
    this.initGlobalShortcuts();
    this.initStatusClock();
    this.initSubsystems();

    // Check initial hash
    const initialHash = window.location.hash.replace('#', '') || 'home';
    this.navigateTo(initialHash, false);
  }

  bindNavigation() {
    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-nav-menu');
    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }

    // Nav links (Use event delegation to handle dynamically added/updated elements)
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-nav-target]');
      if (navBtn) {
        e.preventDefault();
        const target = navBtn.getAttribute('data-nav-target');
        this.navigateTo(target);
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
          mobileMenu.classList.add('hidden');
        }
      }
    });

    // Hash change event
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      this.navigateTo(hash, false);
    });
  }

  navigateTo(route, updateHistory = true) {
    if (route === 'detection') route = 'camera';
    if (!this.routes.includes(route)) route = 'home';
    this.activeRoute = route;

    if (updateHistory && window.location.hash !== `#${route}`) {
      window.location.hash = route;
    }

    // Toggle module view containers
    document.querySelectorAll('.module-view').forEach(view => {
      if (view.id === `view-${route}`) {
        view.classList.remove('hidden');
        view.classList.add('block');
      } else {
        view.classList.add('hidden');
        view.classList.remove('block');
      }
    });

    // Update active nav links in header
    document.querySelectorAll('header [data-nav-target]').forEach(link => {
      if (link.getAttribute('data-nav-target') === route) {
        link.classList.add('text-primary');
        link.classList.remove('text-on-surface-variant');
      } else {
        if (!link.id || link.id !== 'nav-auth-btn') {
          link.classList.remove('text-primary');
          link.classList.add('text-on-surface-variant');
        }
      }
    });

    // Scroll to top of view
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Re-trigger renderers if needed
    if (route === 'home' && window.wheelchairAnim) {
      setTimeout(() => {
        window.wheelchairAnim.resizeCanvas();
        window.wheelchairAnim.updateScrollProgress();
      }, 100);
    }

    if (route === 'battery' && window.batteryBMS) {
      setTimeout(() => {
        window.batteryBMS.drawBMSChart();
      }, 100);
    }

    if (route === 'map' && window.liveLeafletMap) {
      setTimeout(() => {
        window.liveLeafletMap.invalidateSize();
      }, 150);
    }
  }

  initGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore when inside input/textarea/select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (this.routes[index]) {
          this.navigateTo(this.routes[index]);
          this.showToast(`Navigated to ${this.routes[index].toUpperCase()}`);
        }
      }

      // 'v' key for voice command
      if (e.key === 'v' || e.key === 'V') {
        this.navigateTo('voice');
        if (window.voiceController) {
          window.voiceController.startListening();
        }
      }
    });
  }

  initStatusClock() {
    const clockEl = document.getElementById('global-status-clock');
    const update = () => {
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      }
    };
    update();
    setInterval(update, 1000);
  }

  showToast(message) {
    const existing = document.querySelectorAll('.app-toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'app-toast fixed bottom-8 right-6 bg-surface-container-high border border-primary/40 text-on-surface px-6 py-3.5 rounded-xl shadow-2xl z-50 flex items-center gap-3 text-sm font-semibold backdrop-blur animate-bounce';
    toast.innerHTML = `<span class="material-symbols-outlined text-primary text-[20px]">info</span> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  initSubsystems() {
    // 1. Fluid Gesture on Home Page
    const fluidCanvas = document.getElementById('fluid-gesture-canvas');
    if (fluidCanvas && window.FluidGestureEffect) {
      window.fluidEffect = new window.FluidGestureEffect(fluidCanvas);
    }

    // 2. 90-Frame Scroll Animation
    if (window.WheelchairScrollAnimation) {
      window.wheelchairAnim = new window.WheelchairScrollAnimation();
    }

    // 3. Telemetry Dashboard
    if (window.TelemetryDashboard) {
      window.telemetryDash = new window.TelemetryDashboard();
    }

    // 4. BMS & Battery Subsystem
    if (window.BatteryBMSController) {
      window.batteryBMS = new window.BatteryBMSController();
    }

    // 5. Map Navigation
    if (window.MapNavigation) {
      window.mapNav = new window.MapNavigation();
    }

    // 6. Object Detection HUD
    if (window.ObjectDetectionHUD) {
      window.objectHUD = new window.ObjectDetectionHUD();
    }

    // 7. Voice Command
    if (window.VoiceCommandController) {
      window.voiceController = new window.VoiceCommandController();
    }

    // 8. Camera System
    if (window.CameraSystemController) {
      window.camController = new window.CameraSystemController();
    }

    // 9. Auth & Profile Controller
    if (window.AuthController) {
      window.authController = new window.AuthController();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appRouter = new SmartRideApp();
});
