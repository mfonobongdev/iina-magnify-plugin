# IINA Magnify Plugin

VLC-style interactive zoom for IINA. Magnify the video and pan around it with a corner navigator — a wireframe mini-map showing which part of the frame you're looking at.

## Features

- Press **`=`** / **`-`** to zoom in / out (up to 16×), **`0`** to reset
- Press **`z`** to toggle the navigator panel
- Drag the highlighted rectangle in the navigator (or click anywhere in it) to pan
- Arrows on the four edges of that rectangle pan by 5% of the view. Hold an arrow to keep moving
- Scroll over the navigator to zoom
- Toolbar with zoom in/out, live zoom factor, reset, and close
- Clicks outside the navigator pass through to the video as normal
- Zoom level, pan, and rotation persist per video file. Reopening a file restores exactly where you were, even after quitting IINA. Unzoomed, unrotated files start at 1× and 0°
- Rotate from −180° to 180° with the slider under the zoom controls. − and + move one degree. The first angle that is not a multiple of 90° switches this window to copy-back decoding so the turn shows up on IINA's default hardware decoder. The Hardware decoder preference is left unchanged

Zooming drives mpv's `video-zoom` / `video-pan-x` / `video-pan-y` properties, so it composes with IINA's native pinch-to-zoom.

## Installation

1. Open IINA → Preferences → Plugins
2. Click **Install from GitHub**
3. Enter `mfonobongdev/iina-magnify-plugin`

Or download `Magnify.iinaplgz` from the [latest release](https://github.com/mfonobongdev/iina-magnify-plugin/releases) and double-click it.

## Usage

| Action | How |
|---|---|
| Zoom in / out | Press `=` / `-`, click **+** / **−** in the navigator, or scroll over it |
| Pan | Drag the blue rectangle in the navigator, or click where you want to look |
| Pan precisely | Click or hold an arrow on an edge of the blue rectangle (5% of the view) |
| Reset zoom | Press `0` or click **⟲** |
| Rotate | Drag the rotation slider under the zoom controls, or click **−** / **+** beside it (1°) |
| Show/hide navigator | Press `z` or click **✕** (also in the Plugin menu) |

The navigator appears automatically as soon as you zoom in.

## Plugin Structure

```
Magnify.iinaplugin/
├── Info.json       # Metadata and permissions
├── main.js         # Entry point: zoom/pan state, shortcuts, events
└── overlay.html    # Navigator panel rendered over the video
```
