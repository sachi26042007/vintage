/**
 * VINTAGE CAMERA STUDIO — Filter Pipeline
 *
 * Pipeline order (per spec):
 *   1. Temperature   — shift R/B channels
 *   2. Contrast      — pivot around mid-grey
 *   3. Saturation    — luminosity blend
 *   4. Fade          — lift the blacks (matte/print look)
 *   5. Gamma         — midtone brightness
 *   6. Grain         — per-pixel luminance noise
 *   7. Chromatic Aberration — R/B channel spatial shift
 *   8. Blur          — canvas CSS-filter softening  [overlay pass]
 *   9. Vignette      — radial gradient darkening    [overlay pass]
 *
 * All pixel operations work on raw ImageData bytes (Uint8ClampedArray).
 * Overlay effects use the Canvas 2D API directly.
 */

const Filters = (() => {

  /* ───────────────────────────────────────────────
   *  Private state — reusable buffers (avoids GC)
   * ─────────────────────────────────────────────── */
  let _caBuffer   = null;   // Uint8ClampedArray copy for chromatic aberration
  let _blurCanvas = null;   // OffscreenCanvas (or regular Canvas) for blur pass
  let _blurCtx    = null;

  function _ensureBlurCanvas() {
    if (!_blurCanvas) {
      _blurCanvas = document.createElement('canvas');
      _blurCtx    = _blurCanvas.getContext('2d');
    }
  }

  /* ───────────────────────────────────────────────
   *  Inline clamp — faster than Math.min/max calls
   * ─────────────────────────────────────────────── */
  function clamp(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }

  /* ═══════════════════════════════════════════════
   *  PIXEL PASS  — runs every frame on ImageData
   * ═══════════════════════════════════════════════ */
  function applyPixelFilters(imageData, f) {
    const data = imageData.data;
    const len  = data.length;

    /* Pre-compute filter constants to avoid per-pixel recalc */
    const tempAmt    = (f.temperature || 0) * 40;
    const contrast   = f.contrast    ?? 1.0;
    const saturation = f.saturation  ?? 1.0;
    const grain      = (f.grain || 0) * 72;
    const fade       = f.fade        || 0;
    const gamma      = f.gamma       ?? 1.0;
    const invGamma   = Math.abs(gamma - 1.0) > 0.005 ? (1 / gamma) : 0;

    const fadeLift   = fade * 46;
    const fadeScale  = 1 - fade * 0.28;

    /* ── Main pixel loop ── */
    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      /* 1 ── Temperature
         Warm  (+): push R up, G slightly up, B down
         Cool  (–): push R down, G slightly down, B up          */
      if (tempAmt > 0) {
        r = r + tempAmt       > 255 ? 255 : r + tempAmt;
        g = g + tempAmt * 0.12 > 255 ? 255 : g + tempAmt * 0.12;
        b = b - tempAmt * 0.55 <   0 ?   0 : b - tempAmt * 0.55;
      } else if (tempAmt < 0) {
        const a = -tempAmt;
        r = r - a * 0.55 < 0 ?   0 : r - a * 0.55;
        g = g - a * 0.08 < 0 ?   0 : g - a * 0.08;
        b = b + a        > 255 ? 255 : b + a;
      }

      /* 2 ── Contrast  (pivot = 128) */
      if (contrast !== 1.0) {
        r = clamp((r - 128) * contrast + 128);
        g = clamp((g - 128) * contrast + 128);
        b = clamp((b - 128) * contrast + 128);
      }

      /* 3 ── Saturation  (luminosity blend with grayscale) */
      if (saturation !== 1.0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = clamp(lum + (r - lum) * saturation);
        g = clamp(lum + (g - lum) * saturation);
        b = clamp(lum + (b - lum) * saturation);
      }

      /* 4 ── Fade  (lifted blacks, reduced whites — matte print) */
      if (fade > 0) {
        r = clamp(r * fadeScale + fadeLift);
        g = clamp(g * fadeScale + fadeLift);
        b = clamp(b * fadeScale + fadeLift);
      }

      /* 5 ── Gamma */
      if (invGamma) {
        r = (Math.pow(r / 255, invGamma) * 255 + 0.5) | 0;
        g = (Math.pow(g / 255, invGamma) * 255 + 0.5) | 0;
        b = (Math.pow(b / 255, invGamma) * 255 + 0.5) | 0;
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
      }

      /* 6 ── Grain  (correlated noise — same noise across channels
               makes it look like silver-halide, not colour noise) */
      if (grain > 0) {
        const noise = (Math.random() - 0.5) * grain;
        r = clamp(r + noise);
        g = clamp(g + noise * 0.92);
        b = clamp(b + noise * 0.88);
      }

      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
      /* alpha (data[i+3]) is intentionally untouched */
    }

    /* 7 ── Chromatic Aberration (separate pass — needs a copy) */
    const ca = f.chromaticAberration || 0;
    if (ca >= 0.6) {
      _applyChromaticAberration(data, imageData.width, imageData.height, Math.round(ca));
    }

    return imageData;
  }

  /* ═══════════════════════════════════════════════
   *  CHROMATIC ABERRATION
   *  Shifts the Red channel N pixels right,
   *  and the Blue channel N pixels left.
   *  Green stays — this mimics lateral CA in cheap lenses.
   * ═══════════════════════════════════════════════ */
  function _applyChromaticAberration(data, w, h, shift) {
    const len = data.length;

    /* Reuse / create copy buffer */
    if (!_caBuffer || _caBuffer.length !== len) {
      _caBuffer = new Uint8ClampedArray(len);
    }
    _caBuffer.set(data);

    const src = _caBuffer;

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = (row + x) * 4;

        /* R from x + shift (clamped to right edge) */
        const rx = x + shift < w ? x + shift : w - 1;
        data[i] = src[(row + rx) * 4];

        /* B from x − shift (clamped to left edge) */
        const bx = x - shift > 0 ? x - shift : 0;
        data[i + 2] = src[(row + bx) * 4 + 2];
      }
    }
  }

  /* ═══════════════════════════════════════════════
   *  BLUR  (overlay pass — CSS filter trick)
   *  Draw canvas → temp canvas with blur filter
   *  → draw blurred temp back to main canvas.
   * ═══════════════════════════════════════════════ */
  function applyBlur(mainCanvas, mainCtx, amount) {
    if (amount <= 0.05) return;
    _ensureBlurCanvas();

    const bc   = _blurCanvas;
    const bctx = _blurCtx;

    if (bc.width  !== mainCanvas.width)  bc.width  = mainCanvas.width;
    if (bc.height !== mainCanvas.height) bc.height = mainCanvas.height;

    bctx.filter = `blur(${(amount * 1.4).toFixed(1)}px)`;
    bctx.drawImage(mainCanvas, 0, 0);
    bctx.filter = 'none';

    mainCtx.drawImage(bc, 0, 0);
  }

  /* ═══════════════════════════════════════════════
   *  VIGNETTE  (overlay pass — radial gradient)
   * ═══════════════════════════════════════════════ */
  function applyVignette(ctx, w, h, strength) {
    const cx     = w * 0.5;
    const cy     = h * 0.5;
    const innerR = Math.min(w, h) * 0.26;
    const outerR = Math.hypot(cx, cy) * 1.12;

    const g = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    g.addColorStop(0,    'rgba(0,0,0,0)');
    g.addColorStop(0.5,  `rgba(0,0,0,${(strength * 0.22).toFixed(3)})`);
    g.addColorStop(1.0,  `rgba(0,0,0,${Math.min(strength * 0.92, 0.90).toFixed(3)})`);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* ═══════════════════════════════════════════════
   *  PUBLIC API
   * ═══════════════════════════════════════════════ */
  return {
    /**
     * Run the pixel-level filter pass on an ImageData object.
     * Call BEFORE putImageData.
     */
    applyPixelFilters,

    /**
     * Run all canvas-overlay effects (blur → vignette).
     * Call AFTER putImageData.
     */
    applyOverlays(canvas, ctx, filters) {
      if ((filters.blur || 0) > 0.05) {
        applyBlur(canvas, ctx, filters.blur);
      }
      if ((filters.vignette || 0) > 0) {
        applyVignette(ctx, canvas.width, canvas.height, filters.vignette);
      }
    }
  };

})();
