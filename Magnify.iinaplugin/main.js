const { core, mpv, input, event, overlay, menu } = iina;

// Zoom is mpv's video-zoom: log2 of the scale factor (0 = 1x, 1 = 2x, ...).
const ZOOM_STEP = 0.5;
const MAX_ZOOM = 4; // 16x

let zoom = 0;
let panX = 0; // mpv video-pan-x/y, fraction of the scaled video size
let panY = 0;
let minimapVisible = false;
let aspect = 16 / 9;

// ─── State ────────────────────────────────────────────────────────────────────

function scale() {
  return Math.pow(2, zoom);
}

// Keep the viewport inside the frame: |pan| ≤ 0.5 − 1/(2·scale).
function clampPan() {
  const limit = Math.max(0, 0.5 - 1 / (2 * scale()));
  panX = Math.min(limit, Math.max(-limit, panX));
  panY = Math.min(limit, Math.max(-limit, panY));
}

function apply() {
  clampPan();
  mpv.set("video-zoom", zoom);
  mpv.set("video-pan-x", panX);
  mpv.set("video-pan-y", panY);
  pushState();
}

function pushState() {
  overlay.postMessage("state", {
    zoom,
    panX,
    panY,
    visible: minimapVisible,
    aspect,
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function zoomBy(delta) {
  zoom = Math.min(MAX_ZOOM, Math.max(0, zoom + delta));
  if (zoom > 0) minimapVisible = true;
  apply();
  core.osd(`Zoom: ${scale().toFixed(1)}×`);
}

// u/v: viewport center in normalized video coordinates [0, 1].
// Derivation: on-screen position of video point u is (u − 0.5 + panX)·s·W + W/2,
// so the point at the window center is u = 0.5 − panX.
function panTo(u, v) {
  panX = 0.5 - u;
  panY = 0.5 - v;
  apply();
}

function reset() {
  zoom = 0;
  panX = 0;
  panY = 0;
  minimapVisible = false;
  apply();
  core.osd("Zoom reset");
}

function toggleMinimap() {
  minimapVisible = !minimapVisible;
  pushState();
}

function updateAspect() {
  const w = mpv.getNumber("dwidth");
  const h = mpv.getNumber("dheight");
  if (w > 0 && h > 0) aspect = w / h;
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

input.onKeyDown("=", () => {
  zoomBy(ZOOM_STEP);
  return true;
});

input.onKeyDown("-", () => {
  zoomBy(-ZOOM_STEP);
  return true;
});

input.onKeyDown("0", () => {
  reset();
  return true;
});

input.onKeyDown("z", () => {
  toggleMinimap();
  return true;
});

menu.addItem(menu.item("Toggle Magnifier (z)", () => toggleMinimap()));
menu.addItem(menu.item("Reset Zoom (0)", () => reset()));

// ─── Overlay boot ─────────────────────────────────────────────────────────────

// loadFile throws if the window isn't loaded yet; boot on iina.window-loaded,
// with an immediate try/catch'd call to cover plugin reloads during dev
// (the window is already loaded then and the event won't fire again).
function bootViews() {
  overlay.loadFile("overlay.html");
}

event.on("iina.window-loaded", bootViews);

try {
  bootViews();
} catch (_) {}

// onMessage/setClickable are silent no-ops before the overlay view exists,
// so everything overlay-related is wired here.
event.on("iina.plugin-overlay-loaded", () => {
  overlay.setClickable(true);
  overlay.onMessage("zoom", ({ delta }) => zoomBy(delta));
  overlay.onMessage("pan", ({ u, v }) => panTo(u, v));
  overlay.onMessage("reset", () => reset());
  overlay.onMessage("close", () => {
    minimapVisible = false;
    pushState();
  });
  overlay.show();
  pushState();
});

event.on("iina.file-loaded", () => {
  updateAspect();
  // A new file has its own framing; start it unzoomed.
  zoom = 0;
  panX = 0;
  panY = 0;
  minimapVisible = false;
  apply();
});
