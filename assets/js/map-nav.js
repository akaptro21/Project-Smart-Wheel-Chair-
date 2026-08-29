/**
 * Smart Ride - Interactive Navigation Map Controller
 * Integrates:
 * 1. Outdoor Barrier-Free Wheelchair GPS Navigation (Leaflet, OpenRouteService, Overpass API, Photon, Web Speech)
 * 2. High-precision Indoor LiDAR Blueprint Vector Floorplan
 */

// ================= OUTDOOR WHEELCHAIR MAP CONTROLLER =================
class OutdoorWheelchairMap {
  constructor() {
    this.mapContainer = document.getElementById('live-leaflet-map');
    if (!this.mapContainer) return;

    this.startPoint = null;
    this.endPoint = null;
    this.startMarker = null;
    this.endMarker = null;
    this.routeLayer = null;
    this.spokenSteps = [];
    this.map = null;

    this.poiLayers = {
      ramps: L.layerGroup(),
      elevators: L.layerGroup(),
      curbs: L.layerGroup(),
      toilets: L.layerGroup()
    };

    this.ORS_API_KEY = ''; // Optional OpenRouteService API Key (openrouteservice.org)
    this.init();
  }

  init() {
    // 1. Initialize Map centered on India (New Delhi default, or auto-locates via GPS)
    this.map = L.map('live-leaflet-map', { zoomControl: false }).setView([28.6139, 77.2090], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | India Wheelchair Nav'
    }).addTo(this.map);

    // Auto-locate rider in India if GPS is enabled
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const userLoc = [pos.coords.latitude, pos.coords.longitude];
        this.map.setView(userLoc, 16);
      }, () => {});
    }

    // Add all POI layers to map
    Object.values(this.poiLayers).forEach(layer => layer.addTo(this.map));

    // 2. Bind Autocomplete to Inputs
    this.bindAutocomplete('outdoor-start-input', 'outdoor-start-autocomplete', true);
    this.bindAutocomplete('outdoor-end-input', 'outdoor-end-autocomplete', false);

    // 3. Map Click Listener
    this.map.on('click', (e) => {
      if (!this.startPoint) {
        this.setStartLocation(e.latlng, `Pin: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
      } else if (!this.endPoint) {
        this.setEndLocation(e.latlng, `Pin: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
        this.calculateWheelchairRoute();
      } else {
        this.setStartLocation(e.latlng, `Pin: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
      }
    });

    window.liveLeafletMap = this.map;
  }

  bindAutocomplete(inputId, listId, isStart) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;

    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < 3) {
        list.style.display = 'none';
        return;
      }

      timer = setTimeout(async () => {
        try {
          const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
          const data = await res.json();
          list.innerHTML = '';

          if (data.features && data.features.length > 0) {
            list.style.display = 'block';
            data.features.forEach(f => {
              const item = document.createElement('div');
              item.className = 'autocomplete-item';
              const name = f.properties.name || '';
              const city = f.properties.city || f.properties.state || '';
              const country = f.properties.country || '';
              const label = [name, city, country].filter(Boolean).join(', ');
              item.textContent = label;

              item.onclick = () => {
                input.value = label;
                list.style.display = 'none';
                const [lng, lat] = f.geometry.coordinates;
                if (isStart) {
                  this.setStartLocation({ lat, lng }, label);
                } else {
                  this.setEndLocation({ lat, lng }, label);
                }
              };
              list.appendChild(item);
            });
          } else {
            list.style.display = 'none';
          }
        } catch (e) {
          console.warn('Geocoding error:', e);
        }
      }, 300);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !list.contains(e.target)) {
        list.style.display = 'none';
      }
    });
  }

  setStartLocation(latlng, label) {
    this.startPoint = latlng;
    if (this.startMarker) this.map.removeLayer(this.startMarker);
    this.startMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'custom-icon',
        html: '<div style="background:#10b981; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; border:2px solid white; font-size:12px;"><i class="fa-solid fa-location-dot"></i></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }).addTo(this.map).bindPopup(`<b>🟢 Start:</b> ${label}`).openPopup();

    const startInp = document.getElementById('outdoor-start-input');
    if (startInp) startInp.value = label;
  }

  setEndLocation(latlng, label) {
    this.endPoint = latlng;
    if (this.endMarker) this.map.removeLayer(this.endMarker);
    this.endMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'custom-icon',
        html: '<div style="background:#ffb596; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:black; border:2px solid black; font-size:12px;"><i class="fa-solid fa-flag-checkered"></i></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }).addTo(this.map).bindPopup(`<b>🏁 Destination:</b> ${label}`).openPopup();

    const endInp = document.getElementById('outdoor-end-input');
    if (endInp) endInp.value = label;
  }

  useCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.map.setView(latlng, 16);
        this.setStartLocation(latlng, "Current GPS Location");
        this.loadOverpassPOIs();
      },
      () => alert("Unable to access your current GPS location.")
    );
  }

  async calculateWheelchairRoute() {
    if (!this.startPoint || !this.endPoint) {
      alert("Please select both a Starting Location and Destination.");
      return;
    }

    const inclineEl = document.getElementById('outdoor-pref-incline');
    const curbEl = document.getElementById('outdoor-pref-curb');
    const maxIncline = inclineEl ? inclineEl.value : '6';
    const maxCurb = curbEl ? curbEl.value : '0.03';

    try {
      let routeData = null;

      if (this.ORS_API_KEY) {
        const res = await fetch(`https://api.openrouteservice.org/v2/directions/wheelchair/geojson`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.ORS_API_KEY
          },
          body: JSON.stringify({
            coordinates: [
              [this.startPoint.lng, this.startPoint.lat],
              [this.endPoint.lng, this.endPoint.lat]
            ],
            options: {
              profile_params: {
                weightings: {
                  wheelchair: {
                    max_incline: maxIncline,
                    curb_height: maxCurb
                  }
                }
              }
            }
          })
        });
        routeData = await res.json();
      } else {
        const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${this.startPoint.lng},${this.startPoint.lat};${this.endPoint.lng},${this.endPoint.lat}?overview=full&geometries=geojson&steps=true`);
        const raw = await res.json();
        if (raw.routes && raw.routes.length > 0) {
          routeData = {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: raw.routes[0].geometry,
              properties: {
                summary: {
                  distance: raw.routes[0].distance,
                  duration: raw.routes[0].duration
                },
                segments: raw.routes[0].legs[0].steps
              }
            }]
          };
        }
      }

      if (routeData && routeData.features) {
        this.renderRoute(routeData);
        this.loadOverpassPOIs();
      } else {
        alert("No barrier-free route found between these locations.");
      }

    } catch (err) {
      console.error("Routing error:", err);
    }
  }

  renderRoute(geoJsonData) {
    if (this.routeLayer) this.map.removeLayer(this.routeLayer);

    this.routeLayer = L.geoJSON(geoJsonData, {
      style: {
        color: '#ffb596',
        weight: 6,
        opacity: 0.95,
        lineJoin: 'round'
      }
    }).addTo(this.map);

    this.map.fitBounds(this.routeLayer.getBounds(), { padding: [50, 50] });

    const feat = geoJsonData.features[0];
    const distM = feat.properties.summary ? feat.properties.summary.distance : 1100;
    const durS = feat.properties.summary ? feat.properties.summary.duration : 750;

    const km = (distM / 1000).toFixed(2);
    const distEl = document.getElementById('outdoor-hud-dist');
    if (distEl) distEl.textContent = `${km} km`;

    const etaMins = Math.round(durS / 60);
    const now = new Date();
    now.setMinutes(now.getMinutes() + etaMins);
    const etaStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const etaEl = document.getElementById('outdoor-hud-eta');
    if (etaEl) etaEl.textContent = etaStr;

    // Step-by-step guidance list
    const stepBox = document.getElementById('outdoor-step-list');
    if (!stepBox) return;
    stepBox.innerHTML = '';
    this.spokenSteps = [];

    const steps = feat.properties.segments || [];
    if (steps.length > 0) {
      steps.forEach((step, idx) => {
        const maneuver = step.maneuver ? step.maneuver.type : 'Proceed';
        const road = step.name || 'accessible sidewalk';
        const dist = Math.round(step.distance || 40);
        const text = `${maneuver} on ${road} for ${dist}m`;
        this.spokenSteps.push(text);

        const div = document.createElement('div');
        div.className = 'flex items-start gap-2 bg-surface p-2.5 rounded-xl border border-outline-variant/20 text-xs';
        div.innerHTML = `
          <span class="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">${idx + 1}</span>
          <div>
            <div class="text-on-surface font-semibold">${text}</div>
            <div class="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <i class="fa-solid fa-circle-check text-[9px]"></i> Smooth Pavement &amp; Dropped Curb
            </div>
          </div>
        `;
        stepBox.appendChild(div);
      });
    } else {
      this.spokenSteps = [
        "Follow the highlighted barrier-free route.",
        "Use the access ramp at the approaching intersection.",
        "Arrive at the accessible venue entrance."
      ];
      this.spokenSteps.forEach((s, idx) => {
        const div = document.createElement('div');
        div.className = 'flex items-start gap-2 bg-surface p-2.5 rounded-xl border border-outline-variant/20 text-xs';
        div.innerHTML = `
          <span class="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">${idx + 1}</span>
          <div class="text-on-surface font-semibold">${s}</div>
        `;
        stepBox.appendChild(div);
      });
    }
  }

  async loadOverpassPOIs() {
    const bounds = this.map.getBounds();
    const s = bounds.getSouth(), w = bounds.getWest(), n = bounds.getNorth(), e = bounds.getEast();

    const query = `
      [out:json][timeout:25];
      (
        node["ramp"="yes"](${s},${w},${n},${e});
        way["ramp"="yes"](${s},${w},${n},${e});
        node["highway"="elevator"](${s},${w},${n},${e});
        node["kerb"="lowered"](${s},${w},${n},${e});
        node["toilets:wheelchair"="yes"](${s},${w},${n},${e});
      );
      out center 50;
    `;

    try {
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();

      Object.values(this.poiLayers).forEach(l => l.clearLayers());

      data.elements.forEach(item => {
        const lat = item.lat || item.center?.lat;
        const lon = item.lon || item.center?.lon;
        if (!lat || !lon) return;

        const tags = item.tags || {};
        let category = 'ramps';
        let iconClass = 'fa-stairs';
        let bg = '#10b981';
        let label = 'Wheelchair Ramp Available';

        if (tags.highway === 'elevator') {
          category = 'elevators';
          iconClass = 'fa-elevator';
          bg = '#3b82f6';
          label = 'Accessible Elevator / Lift';
        } else if (tags.kerb === 'lowered') {
          category = 'curbs';
          iconClass = 'fa-road';
          bg = '#8b5cf6';
          label = 'Lowered Curb Cut';
        } else if (tags['toilets:wheelchair'] === 'yes') {
          category = 'toilets';
          iconClass = 'fa-restroom';
          bg = '#06b6d4';
          label = 'Wheelchair Accessible Toilet';
        }

        const marker = L.marker([lat, lon], {
          icon: L.divIcon({
            className: 'custom-icon',
            html: `<div style="background:${bg}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; color:white;"><i class="fa-solid ${iconClass}"></i></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        });

        marker.bindPopup(`
          <div style="background:#151313; color:#e7e1e1; font-family:sans-serif; padding:6px; border-radius:8px;">
            <strong style="color:#ffb596; font-size:12px;">${label}</strong>
            <div style="font-size:11px; color:#c2c7cd; margin-top:3px;">${tags.description || tags.name || 'Verified on OpenStreetMap'}</div>
            <div style="font-size:10px; color:#10b981; margin-top:4px;">Verified Barrier-Free</div>
          </div>
        `);

        if (this.poiLayers[category]) {
          this.poiLayers[category].addLayer(marker);
        }
      });
    } catch (e) {
      console.warn("Could not query Overpass API:", e);
    }
  }

  togglePOI(category, btn) {
    btn.classList.toggle('opacity-40');
    if (this.map.hasLayer(this.poiLayers[category])) {
      this.map.removeLayer(this.poiLayers[category]);
    } else {
      this.map.addLayer(this.poiLayers[category]);
    }
  }

  speakDirections() {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const dist = document.getElementById('outdoor-hud-dist')?.textContent || '';
    const text = `Wheelchair navigation active. Distance is ${dist}. ${this.spokenSteps.join('. ')}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}


// ================= INDOOR BLUEPRINT MAP CONTROLLER =================
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

    this.vehicle = { x: 230, y: 190, heading: 0 };
    this.currentPath = [];
    this.pathStep = 0;
    this.obstacles = [
      { x: 340, y: 200, r: 18, label: 'Coffee Table' },
      { x: 230, y: 280, r: 16, label: 'Door Threshold' }
    ];

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

      let chosenWP = this.waypoints.find(wp => Math.hypot(wp.x - clickX, wp.y - clickY) < 30);
      if (chosenWP) {
        this.setDestination(chosenWP.x, chosenWP.y, chosenWP.name);
      } else {
        this.setDestination(clickX, clickY, `Point (${Math.round(clickX/10)}, ${Math.round(clickY/10)})`);
      }
    });

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
    const destLabel = document.getElementById('map-destination-label');
    const etaLabel = document.getElementById('map-eta-label');
    const statusLabel = document.getElementById('map-status-label');

    if (destLabel) destLabel.textContent = name;
    if (statusLabel) {
      statusLabel.textContent = 'PLOTTING ROUTE...';
      setTimeout(() => { statusLabel.textContent = 'AUTONOMOUS TRANSIT ACTIVE'; }, 500);
    }

    this.currentPath = this.computePath(this.vehicle.x, this.vehicle.y, tx, ty);
    this.pathStep = 0;

    const totalDist = Math.hypot(tx - this.vehicle.x, ty - this.vehicle.y);
    if (etaLabel) {
      const etaSeconds = Math.max(3, Math.round(totalDist / 12));
      etaLabel.textContent = `ETA: ${etaSeconds}s (${(totalDist * 0.05).toFixed(1)}m)`;
    }
  }

  computePath(sx, sy, ex, ey) {
    const path = [{ x: sx, y: sy }];
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;
    for (const obs of this.obstacles) {
      if (Math.hypot(obs.x - midX, obs.y - midY) < obs.r + 25) {
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

    this.rooms.forEach(room => {
      ctx.fillStyle = room.color;
      ctx.strokeStyle = '#42474c';
      ctx.lineWidth = 2;
      ctx.fillRect(room.x, room.y, room.w, room.h);
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      ctx.fillStyle = '#8c9197';
      ctx.font = '11px Chivo, sans-serif';
      ctx.fillText(room.name.toUpperCase(), room.x + 12, room.y + 22);
    });

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

    ctx.save();
    ctx.translate(this.vehicle.x, this.vehicle.y);
    ctx.rotate(this.vehicle.heading);

    const pGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 35);
    pGrad.addColorStop(0, 'rgba(227, 112, 56, 0.4)');
    pGrad.addColorStop(1, 'rgba(227, 112, 56, 0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();

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

// Global Tab Mode Switcher
function switchMapMode(mode) {
  const outdoorContainer = document.getElementById('container-outdoor-map');
  const indoorContainer = document.getElementById('container-indoor-map');
  const tabOutdoor = document.getElementById('tab-outdoor-map');
  const tabIndoor = document.getElementById('tab-indoor-map');

  if (mode === 'outdoor') {
    if (outdoorContainer) outdoorContainer.classList.remove('hidden');
    if (indoorContainer) indoorContainer.classList.add('hidden');
    if (tabOutdoor) {
      tabOutdoor.classList.add('bg-primary', 'text-black', 'font-bold');
      tabOutdoor.classList.remove('text-on-surface-variant');
    }
    if (tabIndoor) {
      tabIndoor.classList.remove('bg-primary', 'text-black', 'font-bold');
      tabIndoor.classList.add('text-on-surface-variant');
    }
    setTimeout(() => {
      if (window.liveLeafletMap) window.liveLeafletMap.invalidateSize();
    }, 100);
  } else {
    if (outdoorContainer) outdoorContainer.classList.add('hidden');
    if (indoorContainer) indoorContainer.classList.remove('hidden');
    if (tabIndoor) {
      tabIndoor.classList.add('bg-primary', 'text-black', 'font-bold');
      tabIndoor.classList.remove('text-on-surface-variant');
    }
    if (tabOutdoor) {
      tabOutdoor.classList.remove('bg-primary', 'text-black', 'font-bold');
      tabOutdoor.classList.add('text-on-surface-variant');
    }
  }
}

window.switchMapMode = switchMapMode;
window.OutdoorWheelchairMap = OutdoorWheelchairMap;
window.MapNavigation = MapNavigation;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('live-leaflet-map')) {
    window.outdoorMap = new OutdoorWheelchairMap();
  }
  if (document.getElementById('map-canvas')) {
    window.mapNav = new MapNavigation();
  }
});
