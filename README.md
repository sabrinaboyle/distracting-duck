# Distraction Duck

HACK.COMS project. Lock-in tool using reverse psychology.

## This step

This is a Manifest V3 Chrome extension with a popup. The popup asks for a task and one distracting website. The Start focus session button is visible and keyboard-reachable, and it has no behavior yet.

### Files

- `manifest.json` tells Chrome the extension name, version, and which page to open when the toolbar icon is clicked.
- `popup.html` is that page: the heading, both fields, and the button.
- `popup.css` sets the popup size, colors, spacing, and the outline that appears when a control is focused from the keyboard.

### Load it in Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this project folder (the folder that contains `manifest.json`).
4. Pin **Distraction Duck** from the extensions puzzle-piece menu so its icon stays on the toolbar.
5. Click the icon. The popup should show the heading, the task field, the distracting-website field, and **Start focus session**.
6. Click the popup once, then press Tab. Focus should move from the task field to the website field, then to the button. Press Shift+Tab to move backward. Clicking the button does nothing on this step.

After you change a file, go back to `chrome://extensions` and click the reload icon on the Distraction Duck card.
