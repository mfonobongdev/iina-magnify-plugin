const { core, mpv, input, event, overlay, menu, preferences } = iina;

// Zoom is mpv's video-zoom: log2 of the scale factor (0 = 1x, 1 = 2x, ...).
const ZOOM_STEP = 0.25;
const MAX_ZOOM = 4; // 16x

let zoom = 0;
let panX = 0; // mpv video-pan-x/y, fraction of the scaled video size
let panY = 0;
let rotation = 0;
let minimapVisible = false;
let aspect = 16 / 9;
let switchedThisWindowToCopyBack = false;

// ─── Persistence ─────────────────────────────────────────────────────────────

function getAllStates() {
  try {
    return JSON.parse(preferences.get("zoomStates") || "{}");
  } catch {
    return {};
  }
}

let saveTimer = null;

// Debounced: apply() fires on every mousemove while dragging the navigator,
// and each sync() is a plist write to disk.
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const key = core.status.url;
    if (!key) return;
    const all = getAllStates();
    if (zoom === 0 && rotation === 0) {
      delete all[key];
    } else {
      all[key] = { zoom, panX, panY, rotation };
    }
    preferences.set("zoomStates", JSON.stringify(all));
    // set() only updates IINA's in-memory store; sync() writes it to disk.
    preferences.sync();
  }, 500);
}

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
  scheduleSave();
}

function pushState() {
  overlay.postMessage("state", {
    zoom,
    panX,
    panY,
    rotation,
    visible: minimapVisible,
    aspect,
  });
}

function clockwiseDegreesFromSignedSlider(signedDegrees) {
  return ((signedDegrees % 360) + 360) % 360;
}

function signedSliderDegreesFromClockwise(clockwiseDegrees) {
  return clockwiseDegrees > 180 ? clockwiseDegrees - 360 : clockwiseDegrees;
}

function clampRotationToSliderRange(degrees) {
  return Math.min(180, Math.max(-180, Math.round(degrees)));
}

function keepCopyBackDecodingForOffAxisAngles() {
  if (switchedThisWindowToCopyBack) return false;
  const clockwiseDegrees = clockwiseDegreesFromSignedSlider(rotation);
  const angleIsMultipleOfNinety = clockwiseDegrees % 90 === 0;
  if (angleIsMultipleOfNinety) return false;
  const hwdec = mpv.getString("hwdec") || "";
  const canRotateBySingleDegrees = hwdec === "no" || hwdec.includes("copy");
  if (canRotateBySingleDegrees) return false;
  mpv.set("hwdec", "auto-copy");
  switchedThisWindowToCopyBack = true;
  return true;
}

function addRotationOnTopOfFileMetadata() {
  mpv.set("video-rotate", clockwiseDegreesFromSignedSlider(rotation));
}

function applyRotation() {
  keepCopyBackDecodingForOffAxisAngles();
  addRotationOnTopOfFileMetadata();
  updateAspect();
  pushState();
  scheduleSave();
}

function adoptRotationWrittenOutsideTheSlider() {
  const clockwiseDegrees = mpv.getNumber("video-rotate");
  if (!Number.isFinite(clockwiseDegrees)) return;
  const signedDegrees = signedSliderDegreesFromClockwise(clockwiseDegrees);
  const sameAngleAsSlider =
    clockwiseDegreesFromSignedSlider(signedDegrees) ===
    clockwiseDegreesFromSignedSlider(rotation);
  if (sameAngleAsSlider) return;
  rotation = signedDegrees;
  const didSwitchDecoderToCopyBack = keepCopyBackDecodingForOffAxisAngles();
  if (didSwitchDecoderToCopyBack) addRotationOnTopOfFileMetadata();
  updateAspect();
  pushState();
  scheduleSave();
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function zoomTo(z) {
  zoom = Math.min(MAX_ZOOM, Math.max(0, z));
  if (zoom > 0) minimapVisible = true;
  apply();
  core.osd(`Zoom: ${scale().toFixed(1)}×`);
}

function zoomBy(delta) {
  zoomTo(zoom + delta);
}

// u/v: viewport center in normalized video coordinates [0, 1].
// Derivation: on-screen position of video point u is (u − 0.5 + panX)·s·W + W/2,
// so the point at the window center is u = 0.5 − panX.
function panTo(u, v) {
  panX = 0.5 - u;
  panY = 0.5 - v;
  apply();
}

function rotateTo(degrees) {
  if (!Number.isFinite(degrees)) return;
  rotation = clampRotationToSliderRange(degrees);
  applyRotation();
  core.osd(`Rotation: ${rotation}°`);
}

function rotateBy(delta) {
  rotateTo(rotation + delta);
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
  overlay.onMessage("zoomTo", ({ zoom: z }) => zoomTo(z));
  overlay.onMessage("pan", ({ u, v }) => panTo(u, v));
  overlay.onMessage("rotate", ({ delta }) => rotateBy(delta));
  overlay.onMessage("rotateTo", ({ rotation: degrees }) => rotateTo(degrees));
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
  const saved = getAllStates()[core.status.url];
  zoom = saved ? saved.zoom : 0;
  panX = saved ? saved.panX : 0;
  panY = saved ? saved.panY : 0;
  rotation = saved && Number.isFinite(saved.rotation) ? clampRotationToSliderRange(saved.rotation) : 0;
  minimapVisible = zoom > 0;
  apply();
  applyRotation();
});

event.on("mpv.video-rotate.changed", adoptRotationWrittenOutsideTheSlider);

event.on("mpv.video-reconfig", () => {
  updateAspect();
  pushState();
});
