import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const beforePath = process.argv[2] || 'build/adoption-prep/page-before.template.html';
const afterPath = process.argv[3] || 'index.template.html';
const shared = fs.readFileSync('.sigil/deps/substratic/assets/substratic/substratic.js', 'utf8');
const read = path => fs.readFileSync(path, 'utf8');

async function boot(page, query, level, stored, fullscreen = true, ready = true, responses = {}) {
  const events = [], requests = [], observers = [], nodes = [];
  let fullscreenRequests = 0, pointerRequests = 0, landscapeRequests = 0;
  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, callback, options) {
      const callbacks = this.listeners.get(type) || [];
      callbacks.push({ callback, once: !!options?.once });
      this.listeners.set(type, callbacks);
    }
    fire(type, data = {}) {
      for (const listener of [...(this.listeners.get(type) || [])]) {
        listener.callback({ target: this, preventDefault() {}, stopPropagation() {}, ...data });
        if (listener.once) this.listeners.set(type, this.listeners.get(type).filter(x => x !== listener));
      }
    }
  }
  class Element extends Target {
    constructor(tag) {
      super(); this.nodeName = tag.toUpperCase(); this.style = {}; this.children = [];
      this.attributes = {}; this.className = ''; this.textContent = ''; nodes.push(this);
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: name => { if (!this.classList.contains(name)) this.className += ' ' + name; },
        remove: name => { this.className = this.className.split(/\s+/).filter(x => x !== name).join(' '); }
      };
    }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    appendChild(child) { this.children.push(child); return child; }
    insertBefore(child) { this.children.unshift(child); }
    replaceChildren(...children) { this.children = children; }
    click() { this.fire('click'); }
    getContext(kind) {
      return (level === 'webgl2' || (level === 'webgl1' && kind === 'webgl'))
        ? { getExtension() { return { loseContext() {} }; } } : null;
    }
    requestPointerLock() { pointerRequests++; document.pointerLockElement = this; return Promise.resolve(); }
  }
  const document = new Target();
  document.head = new Element('head'); document.body = new Element('body');
  document.documentElement = new Element('html'); document.visibilityState = 'visible';
  document.createElement = tag => new Element(tag);
  document.createElementNS = (_, tag) => new Element(tag);
  document.createTextNode = text => ({ textContent: text });
  document.getElementById = id => nodes.find(node => node.id === id) || null;
  document.querySelector = selector => document.getElementById(selector.slice(1));
  document.querySelectorAll = () => nodes.filter(node => node.nodeName === 'SCRIPT' && node.getAttribute('src'));
  document.exitFullscreen = () => { fullscreenRequests++; return Promise.resolve(); };
  if (fullscreen) document.documentElement.requestFullscreen = () => { fullscreenRequests++; return Promise.resolve(); };
  for (const match of page.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = new Element(match[1]); node.id = match[2]; document.body.appendChild(node);
  }
  const window = new Target();
  const context = vm.createContext(Object.assign(window, {
    document, window, URLSearchParams, Promise, TextEncoder, location: { search: query },
    navigator: { userAgent: 'page-contract' }, screen: { orientation: { lock() { landscapeRequests++; return Promise.resolve(); } } },
    innerWidth: 480, devicePixelRatio: 1,
    localStorage: { getItem: key => stored[key] ?? null },
    console: { log() {}, warn() {}, error() {} },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {} disconnect() {}
    },
    fetch(url) {
      requests.push(String(url));
      const response = responses[String(url)];
      if (response !== undefined) {
        return Promise.resolve({ ok: response !== false, status: response === false ? 404 : 200,
          headers: new Map(), text: () => Promise.resolve(response) });
      }
      return new Promise(() => {});
    },
    setTimeout() { return 1; }, clearTimeout() {}, requestAnimationFrame() {},
    queueMicrotask, AbortController, btoa, atob
  }));
  for (const match of page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/plausible/.test(match[1] + match[2])) continue;
    if (/\bsrc=/.test(match[1])) {
      assert.match(match[1], /assets\/substratic\/substratic\.js/);
      vm.runInContext(shared, context);
    } else vm.runInContext(match[2], context);
  }
  // The build expands the app marker into this loader tag and mount.
  const loader = new Element('script');
  loader.setAttribute('src', 'sigil-web-app.js');
  loader.setAttribute('data-mount', 'status');
  document.body.appendChild(loader);
  for (const observer of observers) observer.callback([{ addedNodes: [loader] }]);
  const app = { started: true, ready: Promise.resolve(), dispatch(type, payload) { events.push([type, String(payload)]); return 0; } };
  context.SigilWebApp = app;
  if (ready && level === 'webgl2') document.fire('sigil-web-app-ready', { detail: app });
  for (let i = 0; i < 32; i++) await Promise.resolve();
  return { context, document, events, requests, observers, nodes,
    counts: () => [fullscreenRequests, pointerRequests, landscapeRequests] };
}

function productEvents(fixture) {
  const events = fixture.events.filter(([type]) => type !== 'param');
  if (fixture.context.SubstraticPage) {
    assert.equal(events[0][0], 'params');
    return events.slice(1);
  }
  return events;
}

let passed = 0, focusCases = 0, tuneCases = 0;
for (const query of ['', '?play=0', '?floor=14&play=1', '?go=14', '?touch&dev&rate=28',
                     '?title=1', '?floor=sim&best=999_7', '?mute', '?floor=%CE%B1%2Fb&rate=24']) {
  for (const practiced of ['0', '1']) {
    const stored = { 'phantomburn.practiced': practiced, 'phantomburn.best.14': '120_2', 'phantomburn.best.sim': '91_0' };
    const before = await boot(read(beforePath), query, 'webgl2', stored);
    const after = await boot(read(afterPath), query, 'webgl2', stored);
    assert.deepEqual(productEvents(after), productEvents(before), query);
    // Shared transfers queue their requests; floor loading keeps its ordering.
    const tunes = fixture => fixture.requests.filter(url => url.startsWith('assets/tunes/')).sort();
    const floors = fixture => fixture.requests.filter(url => !url.startsWith('assets/tunes/'));
    assert.deepEqual(tunes(after), tunes(before), query);
    assert.deepEqual(floors(after), floors(before), query);
    for (const fixture of [before, after]) {
      const button = fixture.document.getElementById('sub-fs');
      assert.ok(button); assert.equal(button.title, 'Fullscreen');
      button.click(); fixture.context.console.log('phantom-burn: fullscreen');
      fixture.document.fullscreenElement = fixture.document.documentElement;
      fixture.document.fire('fullscreenchange');
      assert.equal(button.title, 'Leave fullscreen');
      button.click();
      fixture.document.fullscreenElement = null;
      fixture.document.fire('fullscreenchange');
      assert.equal(button.title, 'Fullscreen');
      const canvas = fixture.document.getElementById('stage');
      canvas.fire('touchstart', { changedTouches: [{ identifier: 1, clientX: 40, clientY: 80 }] });
      canvas.fire('touchmove', { changedTouches: [{ identifier: 1, clientX: 100, clientY: 110 }] });
      canvas.fire('touchend', { changedTouches: [{ identifier: 1, clientX: 100, clientY: 110 }] });
      fixture.document.getElementById('crouch').fire('touchstart');
    }
    assert.deepEqual(after.counts(), before.counts(), query);
    assert.deepEqual(productEvents(after), productEvents(before), query);
    assert.equal(after.nodes.filter(node => node.id === 'sub-fs').length, 1);
    passed++;
  }
}
for (const level of ['none', 'webgl1']) {
  for (const path of [beforePath, afterPath]) {
    const fixture = await boot(read(path), '?mute', level, {});
    const panel = fixture.document.getElementById('sub-webgl');
    assert.equal(panel.getAttribute('data-webgl'), level);
    assert.equal(panel.getAttribute('role'), 'alert');
    const loader = fixture.document.createElement('script'); loader.setAttribute('src', 'sigil-web-app.js');
    for (const observer of fixture.observers) observer.callback([{ addedNodes: [loader] }]);
    assert.equal(loader.type, 'text/plain');
    assert.equal(loader.getAttribute('data-substratic-off'), 'no-webgl2');
  }
  passed++;
}
for (const path of [beforePath, afterPath]) {
  const fixture = await boot(read(path), '?mute', 'webgl2', {}, false);
  assert.equal(fixture.document.getElementById('sub-fs'), null);
}
passed++;
for (const path of [beforePath, afterPath]) {
  const fixture = await boot(read(path), '?mute', 'webgl2', {}, true, false);
  fixture.document.getElementById('status').textContent = 'Failed to start: sigil_wasm_start failed';
  fixture.context.console.log('no WebGL2 context');
  fixture.document.fire('sigil-web-app-error');
  for (let i = 0; i < 4; i++) await Promise.resolve();
  assert.equal(fixture.document.getElementById('sub-webgl').getAttribute('data-webgl'), 'late');
  assert.equal(fixture.document.getElementById('status').textContent, '');
}
passed++;
if (read(afterPath).includes('webglCheck: true, focus: true')) {
  for (const loss of ['blur', 'hidden']) {
    const fixture = await boot(read(afterPath), '?touch&play=1', 'webgl2', {});
    const canvas = fixture.document.getElementById('stage');
    const touches = [{ identifier: 1, clientX: 40, clientY: 80 },
                     { identifier: 2, clientX: 400, clientY: 80 }];
    canvas.fire('touchstart', { changedTouches: touches });
    canvas.fire('touchmove', { changedTouches: touches.map(t => ({ ...t, clientY: 110 })) });
    fixture.document.getElementById('crouch').fire('touchstart');
    const at = fixture.events.length;
    if (loss === 'blur') fixture.context.fire('blur');
    else {
      fixture.document.visibilityState = 'hidden';
      fixture.document.fire('visibilitychange');
    }
    const released = fixture.events.slice(at);
    assert.ok(released.some(([type, payload]) => type === 'blur' && payload === ''));
    for (const [side, type] of [['l', 'move'], ['r', 'lookstick']]) {
      assert.ok(released.some(([event, payload]) => event === type && payload === '0,0'));
      assert.equal(fixture.document.getElementById(side + 'ring').style.display, 'none');
    }
    assert.equal(fixture.document.getElementById('crouch').classList.contains('down'), false);
    const afterLoss = fixture.events.length;
    canvas.fire('touchmove', { changedTouches: touches });
    assert.equal(fixture.events.length, afterLoss, 'orphaned fingers cannot restore held sticks');
    fixture.document.visibilityState = 'visible';
    fixture.document.fire('visibilitychange');
    assert.ok(fixture.events.some(([type, payload]) => type === 'visibility' && payload === 'visible'));
    passed++;
    focusCases++;
  }
}
if (read(afterPath).includes('window.SubstraticPage.fetchTune(name)')) {
  const fixtures = [];
  for (const query of ['?play=0', '?play=0&blip=a&bed=b', '?play=0&blip=b&bed=a',
                       '?play=0&blip=invalid&bed=invalid']) {
    const blip = new URLSearchParams(query).get('blip');
    const bed = new URLSearchParams(query).get('bed');
    const blipFile = ['a', 'b', 'c'].includes(blip) ? blip : 'c';
    const bedFile = ['a', 'b'].includes(bed) ? bed : 'a';
    const text = '(tune name: "π🗝")\n'.repeat(800);
    const responses = { 'assets/tunes/music-false-identity.cts': text,
      ['assets/tunes/crash-blip-' + blipFile + '.cts']: 'α\nβ\n',
      ['assets/tunes/bed-sim-' + bedFile + '.cts']: '' };
    const before = await boot(read(beforePath), query, 'webgl2', {}, true, true, responses);
    const after = await boot(read(afterPath), query, 'webgl2', {}, true, true, responses);
    const expected = before.events.filter(([type]) => type === 'tune').map(([, payload]) => {
      const at = payload.indexOf('\n'); return [payload.slice(0, at), payload.slice(at + 1)];
    });
    assert.equal(expected.length, 3);
    for (const [name, text] of expected) {
      const begin = after.events.filter(([type, payload]) => type === 'tune-begin' && payload.startsWith(name + '\t'));
      assert.equal(begin.length, 1);
      const chunks = after.events.filter(([type, payload]) => type === 'tune-chunk' && payload.startsWith(name + '\t'));
      const [, bytes, count] = begin[0][1].split('\t');
      assert.equal(Number(bytes), Buffer.byteLength(text)); assert.equal(Number(count), chunks.length);
      const parts = chunks.map(([, payload], index) => {
        const [id, sequence, encoded] = payload.split('\t');
        assert.equal(id, name); assert.equal(Number(sequence), index);
        return Buffer.from(encoded, 'base64');
      });
      assert.equal(Buffer.concat(parts).toString('utf8'), text);
      assert.equal(after.events.filter(([type, payload]) => type === 'tune-done' && payload === name).length, 1);
    }
    assert.equal(after.events.filter(([type]) => type === 'tune').length, 0);
    assert.equal(await after.context.SubstraticPage.fetchTune('music-false-identity'), true);
    assert.equal(after.requests.filter(url => url === 'assets/tunes/music-false-identity.cts').length, 1);
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
      before.document.fire(type); after.document.fire(type);
    }
    const gestures = fixture => fixture.events.filter(([type]) => type === 'gesture');
    assert.deepEqual(gestures(after), gestures(before));
    fixtures.push({ expected, events: after.events.filter(([type]) => type.startsWith('tune-')) });
    passed++; tuneCases++;
  }
  const failed = await boot(read(afterPath), '?play=0', 'webgl2', {}, true, true,
                           { 'assets/tunes/music-false-identity.cts': false });
  assert.equal(await failed.context.SubstraticPage.fetchTune('music-false-identity'), false);
  assert.equal(failed.requests.filter(url => url === 'assets/tunes/music-false-identity.cts').length, 1);
  assert.equal(failed.events.filter(([type, payload]) => type === 'tune-failed' && payload.startsWith('music-false-identity\t')).length, 1);
  assert.equal(failed.events.filter(([type, payload]) => type === 'tune-done' && payload === 'music-false-identity').length, 0);
  passed++; tuneCases++;
  fs.mkdirSync('build/adoption-prep', { recursive: true });
  fs.writeFileSync('build/adoption-prep/tune-page-fixtures.json', JSON.stringify(fixtures) + '\n');
}
if (process.argv.includes('--require-focus')) {
  assert.equal(focusCases, 2, 'the focus gate must execute both focus-loss scenarios');
}
if (process.argv.includes('--require-tunes')) {
  assert.equal(tuneCases, 5, 'the tune gate must execute alias, UTF-8 and failure scenarios');
}
console.log(`PAGE DOM CONTRACT GREEN: ${passed} scenarios; actual complete page scripts, released shared script, params/fetch order, fullscreen, touch and loader suppression`);
