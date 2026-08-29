/**
 * Smart Ride - Neural Voice Command Controller
 * Features:
 * - Real-time acoustic waveform visualizer canvas
 * - Speech recognition integration (Web Speech API + instant preset test triggers)
 * - Natural Language Intent Parsing & Autonomous Action Dispatch
 * - Audio speech synthesis feedback
 */

class VoiceCommandController {
  constructor() {
    this.canvas = document.getElementById('audio-waveform-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.isListening = false;
    this.audioData = Array(40).fill(0);
    this.commandHistory = [];

    this.initSpeechRecognition();
    this.bindEvents();
    this.startWaveformLoop();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.setListeningState(true);
      };

      this.recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(r => r[0].transcript)
          .join('');
        this.updateTranscriptUI(transcript, event.results[0].isFinal);
        if (event.results[0].isFinal) {
          this.processCommand(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.setListeningState(false);
      };

      this.recognition.onend = () => {
        this.setListeningState(false);
      };
    }
  }

  bindEvents() {
    const micButton = document.getElementById('voice-mic-trigger');
    if (micButton) {
      micButton.addEventListener('click', () => {
        if (this.isListening) {
          this.stopListening();
        } else {
          this.startListening();
        }
      });
    }

    // Sample command chip buttons
    const commandChips = document.querySelectorAll('.sample-command-chip');
    commandChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.dataset.command || chip.textContent.trim().replace(/^"|"$/g, '');
        this.updateTranscriptUI(cmd, true);
        this.processCommand(cmd);
      });
    });

    // Custom voice input form
    const voiceInput = document.getElementById('voice-text-input');
    const voiceSubmit = document.getElementById('voice-text-submit');
    if (voiceInput && voiceSubmit) {
      const submit = () => {
        if (voiceInput.value.trim()) {
          this.updateTranscriptUI(voiceInput.value.trim(), true);
          this.processCommand(voiceInput.value.trim());
          voiceInput.value = '';
        }
      };
      voiceSubmit.addEventListener('click', submit);
      voiceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
    }
  }

  startListening() {
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        this.setListeningState(true);
      }
    } else {
      this.setListeningState(true);
    }
  }

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this.setListeningState(false);
  }

  setListeningState(active) {
    this.isListening = active;
    const micBtn = document.getElementById('voice-mic-trigger');
    const statusText = document.getElementById('voice-status-text');

    if (micBtn) {
      if (active) {
        micBtn.classList.add('bg-error', 'animate-pulse', 'ring-4', 'ring-primary-container');
        micBtn.classList.remove('bg-primary-container');
      } else {
        micBtn.classList.remove('bg-error', 'animate-pulse', 'ring-4', 'ring-primary-container');
        micBtn.classList.add('bg-primary-container');
      }
    }

    if (statusText) {
      statusText.textContent = active ? 'LISTENING FOR SPOKEN INTENT...' : 'MIC READY • PRESS TO SPEAK';
    }
  }

  updateTranscriptUI(text, isFinal) {
    const liveBox = document.getElementById('voice-live-transcript');
    if (liveBox) {
      liveBox.textContent = `"${text}"`;
      liveBox.classList.toggle('text-primary', isFinal);
    }
  }

  processCommand(rawText) {
    const lower = rawText.toLowerCase();
    let action = 'UNKNOWN_INTENT';
    let reply = 'Command received. Processing mobility instructions.';
    let intentBadge = 'GENERAL';

    if (lower.includes('kitchen')) {
      action = 'NAV_WAYPOINT_KITCHEN';
      reply = 'Plotting route to Kitchen counter. Avoiding 2 obstacles.';
      intentBadge = 'NAVIGATION';
      if (window.mapNav) window.mapNav.setDestination(460, 200, 'Kitchen & Dining');
    } else if (lower.includes('living') || lower.includes('hall')) {
      action = 'NAV_WAYPOINT_LIVING';
      reply = 'Navigating to Living Room main hub.';
      intentBadge = 'NAVIGATION';
      if (window.mapNav) window.mapNav.setDestination(230, 190, 'Living Room Hub');
    } else if (lower.includes('bedroom')) {
      action = 'NAV_WAYPOINT_BEDROOM';
      reply = 'Routing to Master Bedroom bedside station.';
      intentBadge = 'NAVIGATION';
      if (window.mapNav) window.mapNav.setDestination(220, 380, 'Master Bedroom');
    } else if (lower.includes('dock') || lower.includes('charge')) {
      action = 'NAV_WAYPOINT_DOCK';
      reply = 'Initiating docking sequence. Autonomous alignment engaged.';
      intentBadge = 'POWER';
      if (window.mapNav) window.mapNav.setDestination(650, 185, 'Autonomous Charging Dock');
    } else if (lower.includes('stop') || lower.includes('halt') || lower.includes('emergency')) {
      action = 'EMERGENCY_HALT';
      reply = 'Emergency braking engaged! Wheelchair brought to immediate stop.';
      intentBadge = 'SAFETY';
      if (window.telemetryDash) {
        window.telemetryDash.isEStop = true;
        window.telemetryDash.targetSpeed = 0;
      }
    } else if (lower.includes('speed') || lower.includes('faster')) {
      action = 'ADJUST_SPEED';
      reply = 'Speed governor set to 5.0 km/h.';
      intentBadge = 'DRIVE';
      if (window.telemetryDash) window.telemetryDash.targetSpeed = 5.0;
    } else if (lower.includes('status') || lower.includes('diagnostics') || lower.includes('battery')) {
      action = 'SYSTEM_DIAGNOSTICS';
      reply = 'All systems nominal. Battery at 87%, LiDAR array 100% operational.';
      intentBadge = 'TELEMETRY';
    }

    this.speakResponse(reply);
    this.addHistoryLog(rawText, reply, intentBadge);
  }

  speakResponse(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  addHistoryLog(cmd, response, badge) {
    const historyList = document.getElementById('voice-history-list');
    if (!historyList) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const item = document.createElement('div');
    item.className = 'p-md bg-surface border border-outline-variant/20 rounded-xl space-y-xs animate-fadeIn';
    item.innerHTML = `
      <div class="flex items-center justify-between text-xs">
        <span class="text-primary font-technical">${timeStr}</span>
        <span class="px-2 py-0.5 rounded bg-primary-container/20 text-primary text-[10px] font-semibold">${badge}</span>
      </div>
      <div class="font-semibold text-on-surface text-sm">"${cmd}"</div>
      <div class="text-on-surface-variant text-xs">${response}</div>
    `;

    historyList.prepend(item);
  }

  startWaveformLoop() {
    if (!this.canvas || !this.ctx) return;

    const drawWave = () => {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Generate animated waveform bars
      const bars = 36;
      const barWidth = w / bars - 3;

      for (let i = 0; i < bars; i++) {
        const heightFactor = this.isListening 
          ? Math.sin(Date.now() * 0.01 + i * 0.3) * 0.4 + 0.5 + Math.random() * 0.4
          : Math.sin(Date.now() * 0.003 + i * 0.2) * 0.15 + 0.15;

        const barHeight = Math.max(4, heightFactor * (h - 10));
        const x = i * (barWidth + 3);
        const y = (h - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#ffb596');
        grad.addColorStop(1, '#e37038');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      requestAnimationFrame(drawWave);
    };

    requestAnimationFrame(drawWave);
  }
}

window.VoiceCommandController = VoiceCommandController;
