// The real same-document regression used by check-site, over its served game.
// Browser lifetime and deadlines belong to the existing shot-web harness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {seamlessBrowserProbe} from '../test/test-seamless-browser.mjs';

export async function checkSeamlessFlow({url, directory, repo}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-seamless-'));
  const consoleFile = path.join(scratch, 'console.log');
  const expression = `(async () => {
    try { await (${seamlessBrowserProbe.toString()})(); return 'seamless flow checked'; }
    catch (error) { console.error('SEAMLESS REGRESSION ERROR: ' + error.message); }
  })()`;
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(repo, 'scripts/shot-web.mjs'),
      directory, path.join(scratch, 'frame.png'), '--url', url,
      '--query', 'floor=14&play=0&mute', '--wait', '100',
      '--console', consoleFile, '--requests', path.join(scratch, 'requests.log'),
      '--eval', expression], {cwd: repo, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    child.stdout.on('data', bytes => { output += bytes; });
    child.stderr.on('data', bytes => { output += bytes; });
    child.once('error', error => resolve({status: 2, output: String(error)}));
    child.once('close', (status, signal) => resolve({status, signal, output}));
  });
  fs.writeFileSync(path.join(scratch, 'driver.log'), result.output);
  const consoleText = fs.existsSync(consoleFile) ? fs.readFileSync(consoleFile, 'utf8') : '';
  const line = consoleText.split('\n').find(line => line.startsWith('SEAMLESS BROWSER EVIDENCE '));
  let evidence;
  try { if (line) evidence = JSON.parse(line.slice('SEAMLESS BROWSER EVIDENCE '.length)); }
  catch { /* a missing/malformed observation fails the gate below */ }
  try {
    assert.equal(result.status, 0, `browser exited ${result.status}/${result.signal}`);
    assert(consoleText.includes('SEAMLESS BROWSER GREEN:'), 'missing real flow success');
    assert(evidence, 'missing outer-document observations');
    assert.equal(evidence.loads, 1);
    assert(!evidence.events.some(event => event.type === 'beforeunload'));
    assert.deepEqual(evidence.events.filter(event => event.type === 'floor').map(event => event.floor), ['14', 'sim']);
    const presses = evidence.events.filter(event => event.type === 'press');
    assert.equal(presses.length, 7);
    assert(presses.every(event => event.result === 0 && event.titleTime >= 1));
    fs.rmSync(scratch, {recursive: true});
    return {ok: true, detail: 'title -> 14 -> title -> sim in one document, URL and WASM app', evidence};
  } catch (error) {
    const failure = consoleText.split('\n').find(line => line.includes('SEAMLESS REGRESSION ERROR:'));
    return {ok: false, detail: `${failure || error.message}; evidence: ${scratch}`, evidence, scratch};
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [url, directory] = process.argv.slice(2);
  assert(url && directory, 'usage: node scripts/check-seamless-flow.mjs GAME-URL DIRECTORY');
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = await checkSeamlessFlow({url, directory: path.resolve(directory), repo});
  console.log(`${result.ok ? 'PASS' : 'FAIL'} seamless-flow: ${result.detail}`);
  process.exitCode = result.ok ? 0 : 1;
}
