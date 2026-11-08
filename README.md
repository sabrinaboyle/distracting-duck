# Distraction Duck

HACK.COMS project. Lock-in tool using reverse psychology.

## This step

During an active focus session, Malicious Mallard appears on the distracting website you chose. The panel has one prewritten message and a Dismiss button. It stays off other websites, and it goes away when the session is stopped.

Start still saves your task, that website, and the work tab (the tab that was open when you clicked the icon). Chrome asks to allow the selected website before the session starts. That grant is only for that site, and Stop removes it.

### Files

- `manifest.json` names the extension, the popup, and the background worker. `storage` and `activeTab` support the session. `scripting` lets the worker add the panel. `optional_host_permissions` lists the sites the extension is allowed to ask for later. Nothing is granted for those sites until you start a session.
- `popup.html` and `popup.css` are the toolbar popup.
- `popup.js` asks Chrome for the selected website, then saves the session.
- `site-match.js` turns a website address into the origin Chrome can grant, and checks whether a tab is that same site.
- `background.js` is the service worker. It watches for visits and tab switches, and adds the panel only on the selected site while the session is active.
- `duck-panel.js` draws the panel inside a shadow root so the website’s styles don’t change it. It refuses to add a second panel in the same page.

### Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this project folder.
4. If Distraction Duck was already loaded, click its reload icon. Accept the new permissions. Site access is still requested later, one website at a time.

### Test the panel

1. Open the tab you want as your work tab. Leave a different site, such as `https://example.org`, in that tab.
2. Open Distraction Duck. Enter a task and `https://example.com`. Choose **Start focus session**.
3. Chrome asks to allow Distraction Duck on example.com. Choose **Allow**. The popup should show the active session.
4. Open `https://example.com`. One Malicious Mallard panel appears, with the message and **Dismiss**. The work tab does not get a panel.
5. Open another site, such as `https://example.org`. No panel.
6. Switch back to the example.com tab. There is still one panel, not two.
7. Reload example.com. One panel appears again.
8. Choose **Dismiss**, switch to another tab, then switch back. The panel stays gone.
9. Reload example.com. One panel comes back, because this is a new page load during the active session.
10. Open the popup and choose **Stop focus session**. The panel disappears. Visit example.com again. The panel stays away.

Press Tab to reach **Dismiss**, then Enter. Escape also dismisses the panel while that button is focused.

After you change a file, reload Distraction Duck on `chrome://extensions`.
