# Distraction Duck

HACK.COMS project. Lock-in tool using reverse psychology.

## This version

You can add several focus websites and several distracting websites, choose a bird, and run a local focus session. Chrome asks to allow only the sites on those lists. A playful meter moves with time on those sites. It is not a measure of attention or productivity.

### Preserve from earlier steps

The popup still saves a session on this computer, remembers the work tab, and restores it when you reopen the popup. Stop still ends the session. The bird still uses a shadow-root panel, stays off sites you did not select, and Dismiss still hides it until the next page load.

### Files

- `manifest.json` — Manifest V3, popup, worker, `storage`, `activeTab`, `scripting`, `idle`, and optional host access.
- `settings.js` — Simple rates and list limits you can change later.
- `site-match.js` — Origins, same-site checks, and list overlap.
- `session.js` — Session shape, including older single-site sessions.
- `meter.js` — Time-based meter math.
- `suggestions.js` — Prewritten lines, tagged so a later Gemini source could replace them.
- `popup.html`, `popup.css`, `popup.js` — Lists, conflict choice, bird mode, meter, pause, stop.
- `background.js` — Site permission cleanup, panel inject, meter phase from the active tab.
- `duck-panel.js` — Bird panel, another suggestion, optional open, pause, dismiss.
- `test/logic.test.js` — Origin, conflict, meter, and suggestion checks without Chrome.

### Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Load unpacked (this folder), or reload if it is already loaded.
4. Accept the new `idle` permission if Chrome asks. Site access is still requested later, one start at a time, only for the websites on your lists.

### Test

1. Add `https://example.org` as a focus site and `https://example.com` as a distracting site. Try adding `https://example.com` to focus: choose which list it belongs on.
2. Start a session, Allow the sites, and confirm the work tab is listed.
3. Open example.com: the bird appears, Dismiss is focused, the meter is visible. Open example.org in Distracted Duck: no panel. Switch to Locked-in Loon: a panel appears on the focus site.
4. Stay on a listed site and watch the meter in the popup. Switch to a site on neither list: the meter holds. Pause: the bird hides and the meter holds. Resume, then Stop: the bird stays gone.

Keyboard: Tab through Add, Remove, mode radios, Pause, Stop, Dismiss, Another suggestion. Escape dismisses the panel. Reduced-motion turns off the meter’s width animation. There is no sound.
