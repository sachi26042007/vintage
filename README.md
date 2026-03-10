# 📷 Vintage Camera Studio

A fully browser-based vintage camera app.  
Take photos with **live film presets**, or upload an existing image and apply vintage camera looks — all processed locally, no server required.

---

## 🚀 How to Run

### Option A — Open directly (Chrome / Edge recommended)

Just double-click `index.html`.

> ⚠️ **Camera access requires HTTPS or localhost in most browsers.**  
> If the camera doesn't work when opening as a local file, use Option B.

### Option B — Serve locally (recommended for camera + PWA)

If you have Python installed:

```bash
cd vintage-camera-studio
python3 -m http.server 8080
```

Then open: **http://localhost:8080**

Or with Node.js:

```bash
npx serve .
```

### Option C — Host online (full PWA)

Upload the folder to any static host (Netlify, GitHub Pages, Vercel).  
The app works fully offline after first load thanks to the service worker.

---

## 📁 Project Structure

```
vintage-camera-studio/
│
├── index.html          ← Main UI — all HTML structure
├── styles.css          ← All styling (dark theme, filmstrip, controls)
├── manifest.json       ← PWA manifest (install to home screen)
├── sw.js               ← Service worker (offline caching)
│
├── js/
│   ├── presets.js      ← 7 camera preset definitions
│   ├── filters.js      ← Complete filter pipeline (pixel + overlay)
│   └── app.js          ← Main app controller (camera, UI, capture)
│
└── icons/
    ├── icon.svg        ← Scalable vector icon
    ├── icon-192.png    ← PWA icon (small)
    └── icon-512.png    ← PWA icon (large)
```

---

## 🎞️ Camera Presets

| Preset | Category | Character |
|--------|----------|-----------|
| Polaroid | Instant Camera | Warm, faded, heavy vignette |
| Instax | Instant Camera | Punchy, slightly cool, crisp |
| Canon G9 | Y2K Digicam | Cool, sharp, strong CA fringe |
| Canon IXUS | Y2K Digicam | Warm, high contrast, CA fringe |
| FinePix | Y2K Digicam | Vivid, cool-green, oversharpened |
| Kodak Portra | Film | Warm skin tones, lifted blacks, soft |
| Fuji Velvia | Film | Hyper-saturated, cool shadows, punchy |

---

## ⚙️ Filter Pipeline (in order)

1. **Temperature** — shifts red/blue channels (warm vs cool)
2. **Contrast** — pivots around mid-grey (128)
3. **Saturation** — luminosity blend between colour and grayscale
4. **Fade** — lifts the blacks (matte/print look)
5. **Gamma** — midtone brightness correction
6. **Grain** — correlated luminance noise (per-pixel, random)
7. **Chromatic Aberration** — shifts R channel right, B channel left
8. **Blur** — CSS-filter softening via offscreen canvas
9. **Vignette** — radial gradient overlay (dark edges)

---

## ✨ Features

- **Live camera** with real-time filters at ~30fps
- **Front/back camera switch** (mobile)
- **Image upload** — apply presets to any photo
- **Photo capture** — downloads as `vintagecam_YYYY_MM_DD_HHMM.jpg`
- **Flash simulation** on capture
- **Random preset** button (🎲 or press R)
- **Category filter tabs** — All / Instant / Y2K / Film
- **PWA** — installable on iOS & Android home screen
- **Offline support** via service worker
- **Keyboard shortcuts**: Space = capture, R = random preset

---

## 📱 Installing as a Phone App (PWA)

**iOS (Safari):**
1. Open the URL in Safari
2. Tap the Share button → "Add to Home Screen"

**Android (Chrome):**
1. Open the URL in Chrome
2. Tap the three-dot menu → "Add to Home Screen" or "Install App"

---

## 🔧 Adding / Editing Presets

Open `js/presets.js`. Each preset has this shape:

```js
{
  id:          'my-preset',       // unique string
  name:        'My Camera',       // shown in UI
  shortName:   'MyCam',           // shown on the filmstrip button
  category:    'Film',            // 'Instant Camera' | 'Y2K Digicam' | 'Film'
  icon:        '📷',              // emoji shown on button
  description: 'A brief note',
  filters: {
    temperature:          0.0,    // -1.0 (cool) → +1.0 (warm)
    contrast:             1.0,    // 0.5 (flat) → 2.0 (punchy)
    saturation:           1.0,    // 0.0 (B&W) → 1.5 (vivid)
    grain:                0.0,    // 0.0 (none) → 1.0 (heavy)
    fade:                 0.0,    // 0.0 (deep blacks) → 0.5 (matte)
    blur:                 0.0,    // 0.0 (sharp) → 2.0 (soft)
    vignette:             0.0,    // 0.0 (none) → 1.0 (heavy)
    chromaticAberration:  0.0,    // 0.0 (none) → 3.0 (strong fringe)
    gamma:                1.0     // 0.8 (darker mids) → 1.2 (brighter mids)
  }
}
```

Save the file and reload the page — your new preset will appear.

---

## 🌐 Browser Compatibility

| Browser | Camera | Upload | PWA |
|---------|--------|--------|-----|
| Chrome (Android) | ✅ | ✅ | ✅ |
| Safari (iOS 14.3+) | ✅ | ✅ | ✅ |
| Firefox (Android) | ✅ | ✅ | ⚠️ |
| Chrome (Desktop) | ✅ | ✅ | ✅ |
| Safari (Desktop) | ✅ | ✅ | ✅ |

> Camera requires **HTTPS** or **localhost** in all modern browsers.

---

## 🐛 Troubleshooting

**Camera not working?**
- Ensure you're on HTTPS or localhost (not a file:// URL)
- Check browser permissions — look for a camera icon in the address bar
- On iOS: go to Settings → Safari → Camera → Allow

**Photos downloading as .jpg but look wrong?**
- Some older browsers may export at lower quality — this is expected

**Filters seem slow?**
- The pixel loop processes every frame — reduce browser zoom or close other tabs
- On very old phones, performance may be limited

---

*Built with vanilla HTML/CSS/JS — no frameworks, no build step, no server.*
