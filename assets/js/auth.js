/**
 * Smart Ride — Authentication & Patient/Operator Profile Controller
 * Manages user identity, split-screen login, profile telemetry HUD, biometric access,
 * EHR data synchronization, emergency SOS beacons, and medical ID export.
 */

class AuthController {
  constructor() {
    this.storageKey = 'smartride_user_profile';
    this.currentUser = this.loadUser();
    this.init();
  }

  getDefaultUser() {
    return {
      name: 'Alex Mercer',
      email: 'alex.mercer@smartride.os',
      patientId: 'SR-PAT-7492',
      doctorName: 'Dr. Arthur Bennett, MD',
      emergencyContact: '+1 (555) 019-2834 (Elena Mercer)',
      bloodGroup: 'O+',
      primaryCondition: 'Motor Neuropathy Gr. 2',
      allergies: 'Penicillin, NSAIDs, Latex Sensitivity',
      unitModel: 'SmartRide Kinetic V4.2.1 Pro',
      serialNo: 'SR-KX-9024-ALPHA',
      clearance: 'TIER-4 AUTONOMY',
      batterySOH: '99.1% SOH',
      firmware: 'v2.4.8 Kinetic OS',
      authDate: 'Aug 20, 2026'
    };
  }

  loadUser() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Object.assign(this.getDefaultUser(), parsed);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    return this.getDefaultUser();
  }

  saveUser() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
    localStorage.setItem('smartride_auth', 'true');
    this.updateUserUI();
    this.updateProfileView();
  }

  init() {
    this.bindEvents();
    this.prefillLoginForm();
    this.updateUserUI();
    this.updateProfileView();
  }

  bindEvents() {
    // 1. Handle Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLoginSubmit();
      });
    }

    // Quick Fill Demo Data
    const quickFillBtn = document.getElementById('btn-quick-fill-demo');
    if (quickFillBtn) {
      quickFillBtn.addEventListener('click', () => {
        this.prefillLoginForm(true);
        if (window.appRouter) window.appRouter.showToast('Demo Patient credentials loaded.');
      });
    }

    // 2. Profile Actions
    const editBtn = document.getElementById('profile-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.openEditModal());
    }

    const exportBtn = document.getElementById('profile-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportMedicalCard());
    }

    const sosBtn = document.getElementById('profile-sos-btn');
    if (sosBtn) {
      sosBtn.addEventListener('click', () => this.triggerEmergencySOS());
    }

    const lockBtn = document.getElementById('profile-lock-btn');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        if (window.appRouter) {
          window.appRouter.navigateTo('auth');
          window.appRouter.showToast('Session Locked. Please sign in or scan biometrics.');
        }
      });
    }

    // 3. Edit Profile Modal
    const modal = document.getElementById('profile-edit-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const form = document.getElementById('edit-profile-form');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeEditModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeEditModal());
    
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeEditModal();
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleProfileFormSave();
      });
    }

    // 4. Biometric Trigger
    const bioTrigger = document.getElementById('biometric-scan-trigger');
    const bioRing = document.getElementById('bio-scan-ring');
    if (bioTrigger) bioTrigger.addEventListener('click', () => this.simulateBiometricScan());
    if (bioRing) bioRing.addEventListener('click', () => this.simulateBiometricScan());
  }

  prefillLoginForm(forceDemo = false) {
    const user = forceDemo ? this.getDefaultUser() : this.currentUser;
    const nameIn = document.getElementById('login-patient-name');
    const emailIn = document.getElementById('login-email');
    const bloodIn = document.getElementById('login-blood-group');
    const docIn = document.getElementById('login-doctor-name');
    const conIn = document.getElementById('login-emergency-contact');
    const condIn = document.getElementById('login-condition');
    const algIn = document.getElementById('login-allergies');

    if (nameIn) nameIn.value = user.name || '';
    if (emailIn) emailIn.value = user.email || '';
    if (bloodIn) bloodIn.value = user.bloodGroup || 'O+';
    if (docIn) docIn.value = user.doctorName || '';
    if (conIn) conIn.value = user.emergencyContact || '';
    if (condIn) condIn.value = user.primaryCondition || '';
    if (algIn) algIn.value = user.allergies || '';
  }

  handleLoginSubmit() {
    const nameIn = document.getElementById('login-patient-name');
    const emailIn = document.getElementById('login-email');
    const bloodIn = document.getElementById('login-blood-group');
    const docIn = document.getElementById('login-doctor-name');
    const conIn = document.getElementById('login-emergency-contact');
    const condIn = document.getElementById('login-condition');
    const algIn = document.getElementById('login-allergies');

    const name = nameIn ? nameIn.value.trim() : '';
    const email = emailIn ? emailIn.value.trim() : '';
    const bloodGroup = bloodIn ? bloodIn.value : 'O+';
    const doctorName = docIn ? docIn.value.trim() : 'Dr. Arthur Bennett, MD';
    const emergencyContact = conIn ? conIn.value.trim() : '+1 (555) 019-2834 (Elena Mercer)';
    const primaryCondition = condIn ? condIn.value.trim() : 'Motor Neuropathy Gr. 2';
    const allergies = algIn ? algIn.value.trim() : 'Penicillin, NSAIDs';

    if (!name || !email) {
      this.showLoginFeedback('Please enter at least Patient Name and Email Address.', 'error');
      return;
    }

    this.currentUser = {
      name: name,
      email: email,
      patientId: 'SR-PAT-' + Math.floor(1000 + Math.random() * 9000),
      doctorName: doctorName,
      emergencyContact: emergencyContact,
      bloodGroup: bloodGroup,
      primaryCondition: primaryCondition,
      allergies: allergies,
      unitModel: 'SmartRide Kinetic V4.2.1 Pro',
      serialNo: 'SR-KX-9024-ALPHA',
      clearance: 'TIER-4 AUTONOMY',
      batterySOH: '99.1% SOH',
      firmware: 'v2.4.8 Kinetic OS',
      authDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    this.saveUser();
    this.showLoginFeedback(`✓ Identity Initialized for ${name}. Loading Telemetry OS...`, 'success');

    setTimeout(() => {
      if (window.appRouter) {
        window.appRouter.navigateTo('dashboard');
        window.appRouter.showToast(`Welcome back, ${this.currentUser.name}`);
      }
    }, 600);
  }

  showLoginFeedback(msg, type = 'success') {
    const feedback = document.getElementById('login-feedback');
    if (!feedback) return;

    feedback.textContent = msg;
    feedback.classList.remove('hidden');
    if (type === 'error') {
      feedback.className = 'p-3.5 rounded-xl bg-error/15 border border-error/40 text-error text-xs font-mono text-center shadow-lg';
    } else {
      feedback.className = 'p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-mono text-center shadow-lg font-bold';
    }
  }

  simulateBiometricScan() {
    const bioRing = document.getElementById('bio-scan-ring');
    const bioStatus = document.getElementById('bio-status-label');

    if (bioRing) {
      bioRing.classList.add('border-primary', 'animate-pulse', 'scale-110');
    }
    if (bioStatus) {
      bioStatus.textContent = 'SCANNING DERMAL & FACIAL BIOMETRICS...';
      bioStatus.className = 'font-mono text-[11px] text-primary animate-pulse font-bold';
    }

    setTimeout(() => {
      if (bioStatus) {
        bioStatus.textContent = `MATCH CONFIRMED: ${this.currentUser.name.toUpperCase()}`;
        bioStatus.className = 'font-mono text-[11px] text-emerald-400 font-bold';
      }

      setTimeout(() => {
        if (bioRing) {
          bioRing.classList.remove('border-primary', 'animate-pulse', 'scale-110');
        }
        if (bioStatus) {
          bioStatus.textContent = `MATCH READY FOR ${this.currentUser.name.toUpperCase()}`;
          bioStatus.className = 'font-mono text-[11px] text-outline';
        }
        if (window.appRouter) {
          window.appRouter.navigateTo('dashboard');
          window.appRouter.showToast(`Biometric Signature Verified: ${this.currentUser.name}`);
        }
      }, 500);
    }, 500);
  }

  openEditModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (!modal) return;

    const nameIn = document.getElementById('edit-user-name');
    const emailIn = document.getElementById('edit-user-email');
    const bloodIn = document.getElementById('edit-user-blood');
    const condIn = document.getElementById('edit-user-condition');
    const docIn = document.getElementById('edit-user-doctor');
    const conIn = document.getElementById('edit-user-contact');
    const algIn = document.getElementById('edit-user-allergies');

    if (nameIn) nameIn.value = this.currentUser.name || '';
    if (emailIn) emailIn.value = this.currentUser.email || '';
    if (bloodIn) bloodIn.value = this.currentUser.bloodGroup || 'O+';
    if (condIn) condIn.value = this.currentUser.primaryCondition || '';
    if (docIn) docIn.value = this.currentUser.doctorName || '';
    if (conIn) conIn.value = this.currentUser.emergencyContact || '';
    if (algIn) algIn.value = this.currentUser.allergies || '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeEditModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  handleProfileFormSave() {
    const nameIn = document.getElementById('edit-user-name');
    const emailIn = document.getElementById('edit-user-email');
    const bloodIn = document.getElementById('edit-user-blood');
    const condIn = document.getElementById('edit-user-condition');
    const docIn = document.getElementById('edit-user-doctor');
    const conIn = document.getElementById('edit-user-contact');
    const algIn = document.getElementById('edit-user-allergies');

    if (nameIn && nameIn.value.trim()) this.currentUser.name = nameIn.value.trim();
    if (emailIn && emailIn.value.trim()) this.currentUser.email = emailIn.value.trim();
    if (bloodIn) this.currentUser.bloodGroup = bloodIn.value;
    if (condIn) this.currentUser.primaryCondition = condIn.value.trim();
    if (docIn) this.currentUser.doctorName = docIn.value.trim();
    if (conIn) this.currentUser.emergencyContact = conIn.value.trim();
    if (algIn) this.currentUser.allergies = algIn.value.trim();

    this.saveUser();
    this.closeEditModal();
    this.prefillLoginForm();

    if (window.appRouter) {
      window.appRouter.showToast('Profile and clinical information saved.');
    }
  }

  updateUserUI() {
    const nameEl = document.getElementById('nav-user-name');
    const headerBtn = document.getElementById('nav-auth-btn');
    const sideDoctor = document.getElementById('side-doctor-name');

    if (nameEl) nameEl.textContent = this.currentUser.name;
    if (headerBtn) {
      headerBtn.setAttribute('data-nav-target', 'profile');
    }
    if (sideDoctor) {
      sideDoctor.textContent = this.currentUser.doctorName;
    }
  }

  updateProfileView() {
    const u = this.currentUser;

    const nameEl = document.getElementById('profile-display-name');
    const emailEl = document.getElementById('profile-display-email');
    const idEl = document.getElementById('profile-display-id');
    const clearanceEl = document.getElementById('profile-display-clearance');
    const dateEl = document.getElementById('profile-display-date');
    const bloodEl = document.getElementById('profile-display-blood');
    const condEl = document.getElementById('profile-display-condition');
    const docEl = document.getElementById('profile-display-doctor');
    const conEl = document.getElementById('profile-display-contact');
    const algEl = document.getElementById('profile-display-allergies');
    const unitEl = document.getElementById('profile-display-unit');
    const serialEl = document.getElementById('profile-display-serial');
    const batteryEl = document.getElementById('profile-display-battery-soh');
    const firmwareEl = document.getElementById('profile-display-firmware');
    const initialsEl = document.getElementById('profile-avatar-initials');

    if (nameEl) nameEl.textContent = u.name;
    if (emailEl) emailEl.innerHTML = `<span class="material-symbols-outlined text-[16px] text-primary">mail</span> ${u.email}`;
    if (idEl) idEl.textContent = u.patientId;
    if (clearanceEl) clearanceEl.textContent = u.clearance;
    if (dateEl) dateEl.textContent = u.authDate;
    if (bloodEl) bloodEl.textContent = `${u.bloodGroup} (Rh ${u.bloodGroup.includes('-') ? 'Negative' : 'Positive'})`;
    if (condEl) condEl.textContent = u.primaryCondition;
    if (docEl) docEl.textContent = u.doctorName;
    if (conEl) conEl.textContent = u.emergencyContact;
    if (algEl) algEl.textContent = u.allergies;
    if (unitEl) unitEl.textContent = u.unitModel;
    if (serialEl) serialEl.textContent = u.serialNo;
    if (batteryEl) batteryEl.textContent = u.batterySOH;
    if (firmwareEl) firmwareEl.textContent = u.firmware;

    if (initialsEl) {
      const parts = u.name.trim().split(' ');
      const initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
      initialsEl.textContent = initials || 'SR';
    }
  }

  triggerEmergencySOS() {
    const u = this.currentUser;
    alert(
      `🚨 [SMART RIDE EMERGENCY SOS PROTOCOL ACTIVATED]\n\n` +
      `Emergency Telemetry Beacon Transmitted:\n` +
      `• Patient / Operator: ${u.name} (ID: ${u.patientId})\n` +
      `• Blood Group: ${u.bloodGroup}\n` +
      `• Live GPS Location: 37°46'29.4"N 122°25'10.2"W (Sub-station 4)\n` +
      `• Supervising Physician: ${u.doctorName}\n` +
      `• Priority Caregiver Contact: ${u.emergencyContact}\n\n` +
      `Automated medical telemetry packet and audible vehicle alert dispatched.`
    );
  }

  exportMedicalCard() {
    const u = this.currentUser;
    const cardContent = `
================================================================
          SMART RIDE FUTURE MOBILITY OS — PATIENT MEDICAL ID
================================================================
PATIENT / OPERATOR : ${u.name}
SYSTEM PATIENT ID  : ${u.patientId}
EMAIL ADDRESS      : ${u.email}
BLOOD GROUP        : ${u.bloodGroup}
PRIMARY CONDITION  : ${u.primaryCondition}
KNOWN ALLERGIES    : ${u.allergies}

SUPERVISING DOCTOR : ${u.doctorName}
EMERGENCY CONTACT  : ${u.emergencyContact}

PAIRED HARDWARE    : ${u.unitModel}
HARDWARE SERIAL NO : ${u.serialNo}
CLEARANCE TIER     : ${u.clearance}
BATTERY STATE      : ${u.batterySOH}
FIRMWARE REVISION  : ${u.firmware}
REGISTERED DATE    : ${u.authDate}
================================================================
        ISSUED BY KINETIC LOGIC AUTONOMOUS TELEMETRY KERNEL
================================================================
`;

    const blob = new Blob([cardContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartRide_MedicalID_${u.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.appRouter) {
      window.appRouter.showToast('Medical Emergency ID Card downloaded.');
    }
  }
}

window.AuthController = AuthController;
