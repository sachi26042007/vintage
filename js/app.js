/**
 * VINTAGE CAMERA STUDIO — App Controller v2
 * Mobile-first: orientation handling, shutter sound, light leak, fast taps
 */
'use strict';

const App = {
  video: null,
  canvas: null,
  ctx: null,
  stream: null,
  facingMode: 'environment',
  animId: null,
  isLiveCamera: true,
  uploadedImage: null,
  currentPreset: null,

  /* ── Render loop frame-rate cap ── */
  _lastFrameTime: 0,
  _frameBudget: 1000 / 60,   /* target max 60 fps */

  /* ── Shutter debounce ── */
  _shutterBusy: false,

  async init() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.currentPreset = CAMERA_PRESETS[0];

    this._setupEventListeners();
    this._renderPresets('all');
    this._updateNameOverlay(this.currentPreset);
    this._highlightPreset(this.currentPreset.id);

    /* Try to lock orientation to portrait (works in installed PWAs) */
    this._tryLockOrientation();

    /* Listen for orientation change to resize canvas & update layout */
    this._setupOrientationListener();

    await this.startCamera();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('[SW] registered'))
        .catch(e => console.warn('[SW] failed', e));
    }
  },

  /* ══════════════════════════════════════════════
     ORIENTATION
     ══════════════════════════════════════════════

     Logic:
       1. First we TRY to lock to portrait (works in installed PWA).
       2. If that fails (regular browser tab / iOS), we fall back to
          the CSS landscape sidebar layout — controls are always readable.
       3. On every orientation change we recalculate the canvas size
          to match the new video stream dimensions.
  */
  _tryLockOrientation() {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(() => {
        /* Expected to fail in non-PWA context — CSS fallback handles it */
      });
    }
  },

  _setupOrientationListener() {
    const handler = () => this._handleOrientationChange();

    if (screen.orientation) {
      screen.orientation.addEventListener('change', handler);
    } else {
      /* iOS Safari fallback */
      window.addEventListener('orientationchange', () => {
        /* Wait for layout to reflow before recalculating */
        setTimeout(handler, 200);
      });
    }

    /* Also recalculate on resize (desktop, split-screen, etc.) */
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(handler, 150);
    });
  },

  _handleOrientationChange() {
    /* Update body data attribute — CSS can key off this */
    const isLandscape = window.innerWidth > window.innerHeight;
    document.body.dataset.orientation = isLandscape ? 'landscape' : 'portrait';

    /* Resize canvas to match viewfinder display size.
       This ensures the canvas pixels map 1:1 to screen pixels,
       so CSS never has to stretch or squish it. */
    this._setCanvasToViewfinder();

    /* Tab indicator also needs to reposition after reflow */
    setTimeout(() => {
      const activeTab = document.querySelector('.cat-tab.active');
      if (window._updateTabIndicator) window._updateTabIndicator(activeTab);
    }, 50);
  },

  /* ══════════════════════════════════════════════
     CANVAS SIZING
     ══════════════════════════════════════════════

     Logic:
       We set the canvas's internal pixel dimensions to match
       the viewfinder's CSS layout size exactly.
       This means CSS never has to scale the canvas element,
       eliminating one source of distortion.

       devicePixelRatio is intentionally NOT multiplied here —
       we don't want a 3× canvas for pixel-filter performance reasons.
       The viewfinder CSS pixel size gives us enough resolution.
  */
  _setCanvasToViewfinder() {
    const vf = this.canvas.parentElement;
    if (!vf) return;
    const rect = vf.getBoundingClientRect();
    const w = Math.round(rect.width) || window.innerWidth;
    const h = Math.round(rect.height) || window.innerHeight;
    if (w > 0 && h > 0) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  },

  /* ══════════════════════════════════════════════
     COVER-CROP DRAW
     ══════════════════════════════════════════════

     Logic:
       Standard ctx.drawImage(src, 0, 0, cw, ch) stretches
       the source to fill the destination — the same as
       object-fit: fill — causing facial distortion.

       We instead implement object-fit: cover:
         scale = max(canvasW/srcW, canvasH/srcH)
           → the LARGER ratio ensures both axes are covered
         Then centre-crop the source:
           ox = (srcW - canvasW/scale) / 2  ← pixels cropped from each side
           oy = (srcH - canvasH/scale) / 2

       The 6-argument form of drawImage:
         ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh)
       lets us specify exactly which rectangle of the source
       to draw, and where to put it in the destination.

       For front-camera (selfie mirror) we apply a horizontal
       flip via ctx.scale(-1, 1) before drawing.
  */
  _drawCover(source, srcW, srcH) {
    const { canvas, ctx } = this;
    const cw = canvas.width;
    const ch = canvas.height;
    if (!cw || !ch || !srcW || !srcH) return;

    const scale = Math.max(cw / srcW, ch / srcH);
    const ox = (srcW - cw / scale) / 2;
    const oy = (srcH - ch / scale) / 2;
    const ow = cw / scale;
    const oh = ch / scale;

    ctx.drawImage(source, ox, oy, ow, oh, 0, 0, cw, ch);
  },

  /* ── CAMERA ── */
  async startCamera() {
    this._stopCamera();
    document.getElementById('permission-error').classList.add('hidden');

    try {
      /* Request explicit 16:9 aspect ratio.
         Without this, some devices (especially front cameras) return
         a 4:3 stream, which then gets stretched into the 16:9 viewfinder
         causing the concave / fish-eye distortion on faces.
         The cover-crop draw below handles mismatches gracefully,
         but matching at source reduces cropping. */
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 }
        },
        audio: false
      });
      this.video.srcObject = this.stream;
      await new Promise((res, rej) => {
        this.video.onloadedmetadata = res;
        this.video.onerror = rej;
      });
      await this.video.play();

      /* Size the canvas to match the viewfinder's layout dimensions.
         We do NOT use the raw video stream size here — that would make
         the canvas aspect ratio depend on the stream, causing CSS to
         stretch/squish it to fit the viewfinder container. */
      this._setCanvasToViewfinder();

      this.isLiveCamera = true;
      this.uploadedImage = null;
      this._setModeIndicator('LIVE', true);
      this._startRenderLoop();

      /* Set initial orientation state */
      this._handleOrientationChange();
    } catch (err) {
      console.error('[Camera]', err);
      document.getElementById('permission-error').classList.remove('hidden');
      this._setCanvasToViewfinder();
      this._startRenderLoop();
    }
  },

  _stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  },

  async flipCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this._stopRenderLoop();
    await this.startCamera();
    this.showToast(this.facingMode === 'user' ? '↺ Front camera' : '↺ Back camera');
  },

  /* ── RENDER LOOP ──
     
     Frame-rate cap: we skip rendering if the last frame was drawn
     less than _frameBudget ms ago. This prevents burning CPU/GPU on
     high-refresh screens (120 Hz ProMotion iPhones) unnecessarily.
  */
  _startRenderLoop() {
    this._stopRenderLoop();
    const tick = (timestamp) => {
      this.animId = requestAnimationFrame(tick);
      const delta = timestamp - this._lastFrameTime;
      if (delta < this._frameBudget) return; /* skip frame, not enough time yet */
      this._lastFrameTime = timestamp - (delta % this._frameBudget);
      this._renderFrame();
    };
    this.animId = requestAnimationFrame(tick);
  },

  _stopRenderLoop() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  _renderFrame() {
    const { canvas, ctx, video, isLiveCamera, uploadedImage, currentPreset } = this;
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;

    if (isLiveCamera) {
      if (video.readyState < 2) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (this.facingMode === 'user') {
        /* Flip horizontally for selfie mirror before cover-drawing.
           Translate to right edge, scale X by -1, then draw normally. */
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        this._drawCover(video, vw, vh);
        ctx.restore();
      } else {
        /* _drawCover crops video centre to fill canvas —
           no stretch, no distortion, correct proportions. */
        this._drawCover(video, vw, vh);
      }
    } else if (uploadedImage) {
      /* Same cover logic for uploaded photos */
      this._drawCover(uploadedImage, uploadedImage.naturalWidth, uploadedImage.naturalHeight);
    } else {
      return;
    }

    const imageData = ctx.getImageData(0, 0, w, h);
    Filters.applyPixelFilters(imageData, currentPreset.filters);
    ctx.putImageData(imageData, 0, 0);
    Filters.applyOverlays(canvas, ctx, currentPreset.filters);
  },

  /* ══════════════════════════════════════════════
     CAPTURE — Flash + Light Leak + Shutter Sound
     ══════════════════════════════════════════════ */
  capturePhoto() {
    /* Debounce: ignore rapid repeated presses */
    if (this._shutterBusy) return;
    this._shutterBusy = true;
    setTimeout(() => { this._shutterBusy = false; }, 800);

    this._triggerFlash();
    this._triggerLightLeak();
    this._playShutterSound();

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fname = `vintagecam_${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.jpg`;

    this.canvas.toBlob(blob => {
      if (!blob) { this.showToast('Capture failed'); return; }
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: fname });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.showToast(`📷 Saved — ${fname}`);
    }, 'image/jpeg', 0.93);
  },

  _triggerFlash() {
    const el = document.getElementById('flash');
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 200);
  },

  /* ══════════════════════════════════════════════
     LIGHT LEAK (Dazz Cam feature)
     ══════════════════════════════════════════════

     Logic:
       A translucent amber/orange gradient sweeps across the screen
       when the shutter fires. The .light-leak div is positioned
       above the canvas (z-index 9998) but below the flash (9999).
       CSS animation handles the actual sweep — JS just toggles
       the .active class and removes it when the animation ends.
  */
  _triggerLightLeak() {
    const el = document.getElementById('light-leak');
    if (!el) return;

    /* Remove any previous animation to allow re-triggering */
    el.classList.remove('active');
    /* Force reflow so the browser re-starts the animation */
    void el.offsetWidth;
    el.classList.add('active');

    /* Remove class after animation completes (0.45s in CSS) */
    setTimeout(() => el.classList.remove('active'), 500);
  },

  /* ══════════════════════════════════════════════
     SHUTTER SOUND (Dazz Cam feature)
     ══════════════════════════════════════════════

     Logic:
       We synthesize a mechanical shutter click using the Web Audio API.
       No audio file needed — zero load time, works offline.

       The sound is built from:
         1. A short noise burst (white noise filtered to mid-freq)
            → the initial "click" transient
         2. A very short sine tone (2.5 kHz) that decays immediately
            → the metallic "snap" resonance

       Both are routed through a GainNode that ramps down fast
       → makes it punchy like a real shutter, not buzzy.
  */
  _playShutterSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      /* Reuse audio context across calls to avoid iOS limits */
      if (!this._audioCtx) {
        this._audioCtx = new AudioCtx();
      }
      const ctx = this._audioCtx;

      /* Resume context if suspended (required by iOS autoplay policy) */
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      /* ── 1. Noise burst (click transient) ── */
      const bufferSize = ctx.sampleRate * 0.06; /* 60ms of noise */
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = (Math.random() * 2 - 1);
      }

      /* Band-pass filter — center around 1.2 kHz for realistic click */
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = 1200;
      bpf.Q.value = 1.4;

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      noiseSource.connect(bpf);
      bpf.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(now);
      noiseSource.stop(now + 0.06);

      /* ── 2. Metallic snap resonance (sine tone) ── */
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2500, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.035);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.18, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);

    } catch (e) {
      /* Audio not available — silent fail, camera still works */
      console.warn('[ShutterSound]', e);
    }
  },

  /* ── UPLOAD ── */
  handleUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      this.showToast('Choose an image file');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      this._stopCamera();
      this._stopRenderLoop();

      /* Size canvas to the viewfinder display area — NOT the image dimensions.
         The _drawCover() call in _renderFrame handles centre-cropping the image
         to fill the canvas correctly, without distortion. */
      this._setCanvasToViewfinder();

      this.isLiveCamera = false;
      this.uploadedImage = img;
      this._setModeIndicator('PHOTO', false);
      this._startRenderLoop();
      URL.revokeObjectURL(url);
      this.showToast('Photo loaded — pick a camera!');
    };
    img.onerror = () => {
      this.showToast('Could not load image');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  },

  switchToCamera() {
    this.isLiveCamera = true;
    this.uploadedImage = null;
    this.startCamera();
  },

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
      btn.className = 'preset-btn';
      btn.dataset.presetId = preset.id;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', `${preset.name} — ${preset.category}`);

      const sw = (preset.swatch || ['#888', '#666', '#444']);
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

      /* Use pointerdown for zero-delay response
         pointerdown fires immediately on touch — no 300ms wait.
         We call setPreset directly; touch-action: manipulation in CSS
         ensures the browser doesn't interfere with scroll detection. */
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.setPreset(preset);
      });

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
    const catEl = document.getElementById('cam-cat-tag');
    if (nameEl) {
      nameEl.style.opacity = '0';
      setTimeout(() => {
        nameEl.textContent = preset.name;
        nameEl.style.opacity = '1';
      }, 120);
    }
    if (catEl) catEl.textContent = preset.category;
  },

  _setModeIndicator(text, isLive) {
    const el = document.getElementById('mode-indicator');
    const txt = document.getElementById('mode-text');
    txt.textContent = text;
    el.classList.toggle('live', isLive);
    el.classList.toggle('photo', !isLive);
  },

  showToast(msg, duration = 2400) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
  },

  /* ── EVENT LISTENERS ── */
  _setupEventListeners() {

    /* ── Shutter — pointerdown for instant response ──
       Logic: pointerdown fires the moment the finger touches the screen.
       We call capturePhoto() immediately with no delay.
       The _shutterBusy debounce prevents double-triggers. */
    const captureBtn = document.getElementById('capture-btn');
    captureBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.capturePhoto();
    });

    /* Flip */
    document.getElementById('flip-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.flipCamera();
    });

    /* Random */
    document.getElementById('random-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.randomPreset();
    });

    /* File upload */
    document.getElementById('file-input').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) this.handleUpload(f);
      e.target.value = '';
    });

    /* Mode toggle (camera vs back-to-live) */
    document.getElementById('mode-toggle-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this.isLiveCamera) this.switchToCamera();
      else this.flipCamera();
    });

    /* Retry camera permission */
    document.getElementById('retry-camera-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.startCamera();
    });

    /* Category tabs — delegate */
    document.getElementById('cat-tabs').addEventListener('pointerdown', e => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      e.preventDefault();
      this._renderPresets(tab.dataset.category);
      setTimeout(() => {
        const activeTab = document.querySelector('.cat-tab.active');
        if (window._updateTabIndicator) window._updateTabIndicator(activeTab);
      }, 10);
    });

    /* Keyboard shortcuts (desktop) */
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        this.capturePhoto();
      }
      if (e.code === 'KeyR') this.randomPreset();
    });

    /* Prevent iOS double-tap zoom on interactive elements */
    document.addEventListener('touchend', e => {
      if (e.target.closest('.preset-btn,.shutter-btn,.side-btn,.tb-btn,.cat-tab,.perm-btn')) {
        e.preventDefault();
      }
    }, { passive: false });

    /* Prevent pinch-zoom on the viewfinder */
    document.querySelector('.viewfinder').addEventListener('touchmove', e => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    /* Pause render loop when tab is hidden (battery saving) */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._stopRenderLoop();
      } else {
        this._startRenderLoop();
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
