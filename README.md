# Distraction Duck

HACK.COMS project. Lock-in tool using reverse psychology.

## This step

The toolbar popup can start and stop a focus session.

Start saves three things on this computer: the task, the distracting website, and the browser tab that was open when you clicked Start (the work tab). Closing the popup does not end the session. Opening it again shows the same active session and a Stop button. Stop clears the saved session and returns to the form.

### Files

- `manifest.json` tells Chrome this is a Manifest V3 extension, which page to open as the popup, and that the popup may store data locally and read the tab that was active when you clicked the icon.
- `popup.html` is the popup. It has the start form and the active-session screen.
- `popup.css` sets the popup size, colors, spacing, and keyboard focus outline.
- `popup.js` saves the session, restores it when the popup opens, and clears it when you press Stop.

### Load it in Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this project folder (the folder that contains `manifest.json`).
4. Pin **Distraction Duck** from the extensions puzzle-piece menu.
5. If the extension was already loaded, click the reload icon on its card after pulling these changes. Chrome asks you to accept the new storage permission.

### Test the session

1. Open the tab you want to treat as your work tab, such as a reading or notes page.
2. Click the Distraction Duck icon.
3. Enter a task and one website, such as `https://example.com`, then choose **Start focus session**.
4. The popup should switch to “Focus session is active” and list the task, the website, and the work tab. **Stop focus session** is the next button.
5. Close the popup, then open it again. The same active session should still be there.
6. Choose **Stop focus session**. The form comes back in that same popup, with the task and website still filled in. Close the popup and open it again. The session stays stopped, and the fields are empty because Stop cleared the saved session.

Press Tab to move through the fields and buttons. Starting with an empty field, or a website without `https://`, shows an error and does not save a session.

After you change a file, reload Distraction Duck on `chrome://extensions`.
