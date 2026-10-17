// Run inside shot-web's --eval on a same-origin host page. The observer lives
// outside the game document, so a reload cannot erase the failing assertion.
export async function seamlessBrowserProbe() {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
  const events = [];
  const lines = [];
  const documents = [];
  let app;
  let initialDocument;
  let initialURL;
  let failure;
  let titleTime = 0;
  let onTitle = false;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (value, message) => {
    if (!value) throw new Error(message);
  };
  function unchanged() {
    check(documents.length === 1, 'SEAMLESS FLOW NAVIGATION: game document loaded again');
    check(frame.contentDocument === initialDocument, 'SEAMLESS FLOW NAVIGATION: document replaced');
    check(frame.contentWindow.location.href === initialURL, 'SEAMLESS FLOW NAVIGATION: launch URL changed');
    check(frame.contentWindow.SigilWebApp === app, 'SEAMLESS FLOW RESTART: WASM app replaced');
  }
  async function waitFor(predicate, label, stable = true) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (stable) unchanged();
      if (predicate()) return;
      await sleep(25);
    }
    throw new Error('SEAMLESS FLOW TIMEOUT: ' + label);
  }
  function hasAfter(line, offset) {
    return lines.slice(offset).includes(line);
  }
  function press(key) {
    unchanged();
    events.push({type: 'press', key, titleTime, result: app.dispatch('press', key)});
  }
  frame.addEventListener('load', () => {
    const child = frame.contentWindow;
    documents.push(child.document);
    events.push({type: 'load', url: child.location.href});
    child.addEventListener('beforeunload', () => events.push({type: 'beforeunload'}));
    // Observe the pinned bridge's actual frame callback without changing its
    // timestamp or delivery. A slow software renderer clamps dt to 1/60 after
    // a gap >0.25 s, so one wall-clock second need not enable the menu yet.
    let previousFrame;
    const raf = child.requestAnimationFrame.bind(child);
    child.requestAnimationFrame = callback => raf(timestamp => {
      if (callback.name === 'tick') {
        const raw = previousFrame === undefined ? 1 / 60 : (Math.round(timestamp) - previousFrame) / 1000;
        previousFrame = Math.round(timestamp);
        if (onTitle) titleTime += raw < 0 || raw > 0.25 ? 1 / 60 : raw;
      }
      callback(timestamp);
    });
    const log = child.console.log.bind(child.console);
    child.console.log = function (...args) {
      const line = args.join(' ');
      lines.push(line);
      if (line === 'phantom-burn: mode title') { titleTime = 0; onTitle = true; }
      if (line === 'phantom-burn: mode game') onTitle = false;
      return log(...args);
    };
  });
  // Only this test's fresh browser profile is affected. A stale practiced bit
  // must not hide the old sim-to-14 navigation defect.
  localStorage.removeItem('phantomburn.practiced');
  frame.src = new URL('?mute', location.href).href;
  document.body.appendChild(frame);
  try {
    await waitFor(() => documents.length > 0 &&
      lines.includes('phantom-burn: ready title') && frame.contentWindow.SigilWebApp?.started,
    'initial title rendered', false);
    initialDocument = frame.contentDocument;
    initialURL = frame.contentWindow.location.href;
    app = frame.contentWindow.SigilWebApp;
    unchanged();
    await waitFor(() => titleTime >= 1, 'title has advanced past its input delay');
    let offset = lines.length;
    press('down'); // fresh profile starts on PRACTICE
    press('return');
    await waitFor(() => hasAfter('phantom-burn: ready 14', offset), 'INFILTRATE rendered');
    events.push({type: 'floor', floor: '14'});
    offset = lines.length;
    app.dispatch('pause', '');
    await waitFor(() => hasAfter('phantom-burn: paused', offset), 'pause panel');
    press('down');
    press('down');
    press('return'); // the real pause panel's QUIT TO TITLE row
    await waitFor(() => hasAfter('phantom-burn: mode title', offset), 'return to title');
    events.push({type: 'title'});
    await waitFor(() => titleTime >= 1, 'returned title accepts input');
    offset = lines.length;
    press('up');
    press('return');
    await waitFor(() => hasAfter('phantom-burn: ready sim', offset), 'PRACTICE rendered');
    events.push({type: 'floor', floor: 'sim'});
    unchanged();
    console.log('SEAMLESS BROWSER GREEN: title -> 14 -> title -> sim; one document, URL and WASM app');
  } catch (error) {
    failure = error;
  } finally {
    // Wait for the current generation to render before removing it. Removing
    // a booting iframe cancels its own image fetches and hides the real failure.
    if (failure) {
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline && !lines.some(line => /^phantom-burn: ready (14|sim)$/.test(line))) {
        await sleep(50);
      }
    }
    console.log('SEAMLESS BROWSER EVIDENCE ' + JSON.stringify({events, lines, loads: documents.length}));
    frame.remove();
  }
  if (failure) throw failure;
}
