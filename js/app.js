/**
 * VINTAGE CAMERA STUDIO — App Controller (Redesigned UI)
 */
'use strict';

const App = {
  video:       null,
  canvas:      null,
  ctx:         null,
  stream:      null,
  facingMode:  'environment',
  animId:      null,
  isLiveCamera:   true,
  uploadedImage:  null,
  currentPreset:  null,

  async init() {
    this.video  = document.getElementById('video');
    this.canvas = document.getElementById('main-canvas');
    this.ctx    = this.canvas.getContext('2d', { willReadFrequently: true });

    this.currentPreset = CAMERA_PRESETS[0];

    this._setupEventListeners();
    this._renderPresets('all');
    this._updateNameOverlay(this.currentPreset);
    this._highlightPreset(this.currentPreset.id);

    await this.startCamera();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('[SW] registered'))
        .catch(e => console.warn('[SW] failed', e));
    }
  },

  /* ── CAMERA ── */
  async startCamera() {
    this._stopCamera();
    document.getElementById('permission-error').classList.add('hidden');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      this.video.srcObject = this.stream;
      await new Promise((res, rej) => { this.video.onloadedmetadata = res; this.video.onerror = rej; });
      await this.video.play();

      const vw = this.video.videoWidth  || 1280;
      const vh = this.video.videoHeight || 720;
      const s  = vw > 1280 ? 1280 / vw : 1;
      this.canvas.width  = Math.round(vw * s);
      this.canvas.height = Math.round(vh * s);

      this.isLiveCamera  = true;
      this.uploadedImage = null;
      this._setModeIndicator('LIVE', true);
      this._startRenderLoop();
    } catch (err) {
      console.error('[Camera]', err);
      document.getElementById('permission-error').classList.remove('hidden');
      this._startRenderLoop();
    }
  },

  _stopCamera() {
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.video.srcObject = null;
  },

  async flipCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this._stopRenderLoop();
    await this.startCamera();
    this.showToast(this.facingMode === 'user' ? '↺ Front camera' : '↺ Back camera');
  },

  /* ── RENDER LOOP ── */
  _startRenderLoop() {
    this._stopRenderLoop();
    const tick = () => { this._renderFrame(); this.animId = requestAnimationFrame(tick); };
    this.animId = requestAnimationFrame(tick);
  },
  _stopRenderLoop() {
    if (this.animId !== null) { cancelAnimationFrame(this.animId); this.animId = null; }
  },

  _renderFrame() {
    const { canvas, ctx, video, isLiveCamera, uploadedImage, currentPreset } = this;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;

    if (isLiveCamera) {
      if (video.readyState < 2) return;
      if (this.facingMode === 'user') {
        ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h); ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, w, h);
      }
    } else if (uploadedImage) {
      ctx.drawImage(uploadedImage, 0, 0, w, h);
    } else { return; }

    const imageData = ctx.getImageData(0, 0, w, h);
    Filters.applyPixelFilters(imageData, currentPreset.filters);
    ctx.putImageData(imageData, 0, 0);
    Filters.applyOverlays(canvas, ctx, currentPreset.filters);
  },

  /* ── CAPTURE ── */
  capturePhoto() {
    this._triggerFlash();
    const now = new Date(), pad = n => String(n).padStart(2,'0');
    const fname = `vintagecam_${now.getFullYear()}_${pad(now.getMonth()+1)}_${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.jpg`;
    this.canvas.toBlob(blob => {
      if (!blob) { this.showToast('Capture failed'); return; }
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: fname });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.showToast(`📷 Saved — ${fname}`);
    }, 'image/jpeg', 0.93);
  },

  _triggerFlash() {
    const el = document.getElementById('flash');
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 220);
  },

  /* ── UPLOAD ── */
  handleUpload(file) {
    if (!file || !file.type.startsWith('image/')) { this.showToast('Choose an image file'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      this._stopCamera(); this._stopRenderLoop();
      const s = img.width > 1280 ? 1280 / img.width : 1;
      this.canvas.width  = Math.round(img.width  * s);
      this.canvas.height = Math.round(img.height * s);
      this.isLiveCamera  = false;
      this.uploadedImage = img;
      this._setModeIndicator('PHOTO', false);
      this._startRenderLoop();
      URL.revokeObjectURL(url);
      this.showToast('Photo loaded — pick a camera!');
    };
    img.onerror = () => { this.showToast('Could not load image'); URL.revokeObjectURL(url); };
    img.src = url;
  },

  switchToCamera() { this.isLiveCamera = true; this.uploadedImage = null; this.startCamera(); },

  /* ── PRESETS ── */
  setPreset(preset) {
    this.currentPreset = preset;
    this._updateNameOverlay(preset);
    this._highlightPreset(preset.id);
    if (navigator.vibrate) navigator.vibrate(12);
  },

  randomPreset() {
    const idx = Math.floor(Math.random() * CAMERA_PRESETS.length);
    this.setPreset(CAMERA_PRESETS[idx]);
    this.showToast(`🎲 ${CAMERA_PRESETS[idx].name}`);
  },

  _renderPresets(category) {
    const list = document.getElementById('preset-list');
    list.innerHTML = '';
    const filtered = category === 'all'
      ? CAMERA_PRESETS
      : CAMERA_PRESETS.filter(p => p.category === category);

    filtered.forEach(preset => {
      const btn = document.createElement('button');
      btn.className        = 'preset-btn';
      btn.dataset.presetId = preset.id;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', `${preset.name} — ${preset.category}`);

      // Build swatch strips
      const sw = (preset.swatch || ['#888','#666','#444']);
      const swatchHTML = sw.map(c => `<div class="pb-swatch-chunk" style="background:${c}"></div>`).join('');

      btn.innerHTML = `
        <div class="pb-swatch">${swatchHTML}</div>
        <div class="pb-body">
          <span class="pb-icon">${preset.icon}</span>
          <span class="pb-name">${preset.shortName}</span>
          <div class="pb-check">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="1.5,5 4,7.5 8.5,2.5"/>
            </svg>
          </div>
        </div>
      `;
      btn.addEventListener('click', () => this.setPreset(preset));
      list.appendChild(btn);
    });

    this._highlightPreset(this.currentPreset.id);
  },

  _highlightPreset(id) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.presetId === id);
    });
  },

  _updateNameOverlay(preset) {
    const nameEl = document.getElementById('cam-name-big');
    const catEl  = document.getElementById('cam-cat-tag');
    if (nameEl) { nameEl.style.opacity = '0'; setTimeout(() => { nameEl.textContent = preset.name; nameEl.style.opacity = '1'; }, 120); }
    if (catEl)  catEl.textContent = preset.category;
  },

  _setModeIndicator(text, isLive) {
    const el  = document.getElementById('mode-indicator');
    const txt = document.getElementById('mode-text');
    txt.textContent = text;
    el.classList.toggle('live',  isLive);
    el.classList.toggle('photo', !isLive);
  },

  showToast(msg, duration = 2400) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
  },

  /* ── EVENTS ── */
  _setupEventListeners() {
    document.getElementById('capture-btn').addEventListener('click', () => this.capturePhoto());
    document.getElementById('flip-btn').addEventListener('click', () => this.flipCamera());
    document.getElementById('random-btn').addEventListener('click', () => this.randomPreset());
    document.getElementById('file-input').addEventListener('change', e => {
      const f = e.target.files[0]; if (f) this.handleUpload(f); e.target.value = '';
    });
    document.getElementById('mode-toggle-btn').addEventListener('click', () => {
      if (!this.isLiveCamera) this.switchToCamera(); else this.flipCamera();
    });
    document.getElementById('retry-camera-btn').addEventListener('click', () => this.startCamera());

    /* Category tabs — delegate to _renderPresets */
    document.getElementById('cat-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      this._renderPresets(tab.dataset.category);
      /* Re-run tabs indicator update after render */
      setTimeout(() => {
        const activeTab = document.querySelector('.cat-tab.active');
        if (window._updateTabIndicator) window._updateTabIndicator(activeTab);
      }, 10);
    });

    /* Keyboard shortcuts */
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); this.capturePhoto(); }
      if (e.code === 'KeyR') this.randomPreset();
    });

    /* Prevent iOS double-tap zoom */
    document.addEventListener('touchend', e => {
      if (e.target.closest('.preset-btn,.shutter-btn,.side-btn,.tb-btn,.cat-tab')) e.preventDefault();
    }, { passive: false });

    /* Pause render when tab hidden */
    document.addEventListener('visibilitychange', () => {
      document.hidden ? this._stopRenderLoop() : this._startRenderLoop();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
