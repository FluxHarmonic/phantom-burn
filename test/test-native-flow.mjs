// Invoke inside scripts/dev's Guix environment with DISPLAY supplied by the
// remote gate. Spawn the executable directly: one PID for the entire flow.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const binary = path.resolve(process.argv[2] || 'build/dev/bin/phantom-burn');
assert(process.env.DISPLAY, 'native flow gate requires its remote virtual display');
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-flow-save-'));
const args = ['--size', '480x270', '--seconds', '12', '--mute',
  '--press', 'down@1.5,return@1.8,p@4,down@4.2,down@4.4,return@4.6,up@6.5,return@6.8'];
const child = spawn(binary, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {...process.env, XDG_DATA_HOME: isolated, XDG_CONFIG_HOME: isolated},
});
let stdout = '';
let stderr = '';
let start;
function identity() {
  const stat = fs.readFileSync(`/proc/${child.pid}/stat`, 'utf8');
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  return {parent: Number(fields[1]), start: fields[19]};
}
const sequence = ['phantom-burn: mode title', 'phantom-burn: ready 14',
  'phantom-burn: mode title', 'phantom-burn: ready sim'];
let next = 0;
let identityFailure;
let buffered = '';
child.stdout.on('data', bytes => {
  const text = bytes.toString();
  stdout += text;
  process.stdout.write(text);
  buffered += text;
  const lines = buffered.split('\n');
  buffered = lines.pop();
  for (const line of lines) {
    if (line.trim() !== sequence[next]) continue;
    try {
      assert.deepEqual(identity(), start, 'native app identity changed during flow');
      next++;
    } catch (error) { identityFailure = error; }
  }
});
child.stderr.on('data', bytes => { stderr += bytes; process.stderr.write(bytes); });
const result = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('spawn', () => {
    try {
      start = identity();
      assert.equal(start.parent, process.pid, 'app is not this gate\'s direct child');
    } catch (error) { identityFailure = error; }
  });
  child.once('close', (code, signal) => resolve({code, signal}));
});
console.log('NATIVE FLOW EVIDENCE ' + JSON.stringify({pid: child.pid, start, result,
  sequence, matched: next, stdout, stderr, identityError: identityFailure?.message}));
assert.deepEqual(result, {code: 0, signal: null}, 'native app must finish its own bounded run');
if (identityFailure) throw identityFailure;
assert.equal(next, sequence.length,
  'NATIVE FLOW MISSING: expected title -> 14 -> title -> sim inside one process');
fs.rmSync(isolated, {recursive: true});
console.log('SEAMLESS NATIVE GREEN: title -> 14 -> title -> sim; one executable PID/start time');
