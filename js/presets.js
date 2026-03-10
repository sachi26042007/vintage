/**
 * VINTAGE CAMERA STUDIO — Camera Presets
 */

const CAMERA_PRESETS = [

  /* ─── WARM & AESTHETIC ─── */
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    shortName: 'Golden Hour',
    category: 'Warm & Aesthetic',
    icon: '🌅',
    swatch: ['#f5c97a','#e0963a','#b05818'],
    description: 'Sunset warmth — heavy vignette, soft blur',
    filters: { temperature: 0.42, contrast: 1.08, saturation: 1.04, grain: 0.28, fade: 0.20, blur: 0.60, vignette: 0.72, chromaticAberration: 0.8, gamma: 1.12 }
  },
  {
    id: 'honey-lomo',
    name: 'Honey Lomo',
    shortName: 'Honey Lomo',
    category: 'Warm & Aesthetic',
    icon: '🍯',
    swatch: ['#f0c060','#c8843a','#9a5020'],
    description: 'Dreamy amber Lomography — lifted blacks, saturation burst',
    filters: { temperature: 0.35, contrast: 1.10, saturation: 1.22, grain: 0.38, fade: 0.22, blur: 0.40, vignette: 0.72, chromaticAberration: 1.2, gamma: 1.08 }
  },
  {
    id: 'summer-99',
    name: "Summer '99",
    shortName: "Summer '99",
    category: 'Warm & Aesthetic',
    icon: '☀️',
    swatch: ['#ffe08a','#f0a840','#c06830'],
    description: 'CCD beach memory, overexposed, lens fringe',
    filters: { temperature: 0.38, contrast: 1.24, saturation: 1.08, grain: 0.12, fade: 0.08, blur: 0.0, vignette: 0.22, chromaticAberration: 2.6, gamma: 0.90 }
  },
  {
    id: 'tuscany',
    name: 'Tuscany',
    shortName: 'Tuscany',
    category: 'Warm & Aesthetic',
    icon: '🌿',
    swatch: ['#ddb87a','#b08040','#7a5428'],
    description: 'Dusty Italian film — heavy grain, matte fade',
    filters: { temperature: 0.28, contrast: 0.96, saturation: 0.90, grain: 0.54, fade: 0.28, blur: 0.50, vignette: 0.60, chromaticAberration: 0.6, gamma: 1.06 }
  },
  {
    id: 'cafe-kodak',
    name: 'Café Kodak',
    shortName: 'Café Kodak',
    category: 'Warm & Aesthetic',
    icon: '☕',
    swatch: ['#e8c090','#c09050','#8a6030'],
    description: 'Warm interior candid — grain and matte fade',
    filters: { temperature: 0.22, contrast: 1.02, saturation: 0.92, grain: 0.42, fade: 0.24, blur: 0.30, vignette: 0.50, chromaticAberration: 0.5, gamma: 1.05 }
  },
  {
    id: 'bronze-age',
    name: 'Bronze Age',
    shortName: 'Bronze Age',
    category: 'Warm & Aesthetic',
    icon: '🏺',
    swatch: ['#c8803a','#a05a20','#783808'],
    description: 'Deep amber contrast — punchy, richly toned',
    filters: { temperature: 0.30, contrast: 1.32, saturation: 1.06, grain: 0.22, fade: 0.14, blur: 0.20, vignette: 0.62, chromaticAberration: 0.9, gamma: 0.98 }
  },

  /* ─── INSTANT CAMERAS ─── */
  {
    id: 'polaroid',
    name: 'Polaroid',
    shortName: 'Polaroid',
    category: 'Instant Camera',
    icon: '📸',
    swatch: ['#f0e0c0','#c8a870','#907040'],
    description: 'Classic Polaroid OneStep — warm fade, heavy vignette',
    filters: { temperature: 0.14, contrast: 1.06, saturation: 0.84, grain: 0.24, fade: 0.20, blur: 0.40, vignette: 0.55, chromaticAberration: 1.4, gamma: 1.06 }
  },
  {
    id: 'instax',
    name: 'Instax',
    shortName: 'Instax',
    category: 'Instant Camera',
    icon: '🎞️',
    swatch: ['#e8f0f8','#a8c0d8','#6890b0'],
    description: 'Fujifilm Instax Mini — punchy, slightly cool, crisp',
    filters: { temperature: 0.06, contrast: 1.14, saturation: 1.10, grain: 0.14, fade: 0.07, blur: 0.10, vignette: 0.26, chromaticAberration: 0.7, gamma: 0.97 }
  },

  /* ─── Y2K DIGICAM ─── */
  {
    id: 'ccd-gold',
    name: 'CCD Gold',
    shortName: 'CCD Gold',
    category: 'Y2K Digicam',
    icon: '✨',
    swatch: ['#f8d070','#d09030','#a06010'],
    description: 'Compact CCD selfie — warm golden sensor, overexposed',
    filters: { temperature: 0.32, contrast: 1.28, saturation: 1.12, grain: 0.10, fade: 0.05, blur: 0.0, vignette: 0.18, chromaticAberration: 2.8, gamma: 0.88 }
  },
  {
    id: 'canon-g9',
    name: 'Canon G9',
    shortName: 'Canon G9',
    category: 'Y2K Digicam',
    icon: '📷',
    swatch: ['#c8d0d8','#8898a8','#486070'],
    description: 'Canon PowerShot G9 — cool, sharp, Y2K digital look',
    filters: { temperature: -0.07, contrast: 1.22, saturation: 0.94, grain: 0.30, fade: 0.04, blur: 0.0, vignette: 0.20, chromaticAberration: 2.4, gamma: 1.0 }
  },
  {
    id: 'canon-ixus',
    name: 'Canon IXUS',
    shortName: 'Canon IXUS',
    category: 'Y2K Digicam',
    icon: '📷',
    swatch: ['#d8c8b0','#a89070','#786040'],
    description: 'Canon IXUS 700 — slight warmth, high contrast, CA fringe',
    filters: { temperature: 0.04, contrast: 1.20, saturation: 1.06, grain: 0.32, fade: 0.06, blur: 0.0, vignette: 0.24, chromaticAberration: 2.0, gamma: 1.02 }
  },
  {
    id: 'fuji-finepix',
    name: 'FinePix F30',
    shortName: 'FinePix F30',
    category: 'Y2K Digicam',
    icon: '📷',
    swatch: ['#a8d0b8','#60a078','#307050'],
    description: 'Fujifilm FinePix F30 — vivid, cool-green, oversharpened',
    filters: { temperature: -0.11, contrast: 1.16, saturation: 1.14, grain: 0.27, fade: 0.03, blur: 0.0, vignette: 0.28, chromaticAberration: 1.7, gamma: 0.96 }
  },

  /* ─── FILM ─── */
  {
    id: 'kodak-portra',
    name: 'Kodak Portra',
    shortName: 'Kodak Portra',
    category: 'Film',
    icon: '🎬',
    swatch: ['#f0d8a8','#c8a060','#906830'],
    description: 'Kodak Portra 400 — warm skin tones, lifted blacks, soft grain',
    filters: { temperature: 0.20, contrast: 0.90, saturation: 0.85, grain: 0.44, fade: 0.24, blur: 0.55, vignette: 0.44, chromaticAberration: 0.4, gamma: 1.10 }
  },
  {
    id: 'fuji-film',
    name: 'Fuji Velvia',
    shortName: 'Fuji Velvia',
    category: 'Film',
    icon: '🎬',
    swatch: ['#b0d8e8','#6090b0','#304870'],
    description: 'Fujifilm Velvia 50 — hyper-saturated, cool shadows, punchy',
    filters: { temperature: -0.15, contrast: 1.10, saturation: 1.18, grain: 0.36, fade: 0.11, blur: 0.25, vignette: 0.38, chromaticAberration: 0.6, gamma: 0.95 }
  }
];
