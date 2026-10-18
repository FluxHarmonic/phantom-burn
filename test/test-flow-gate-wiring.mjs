// Verify failure propagation through the real public dev command without
// running a second unit suite. These stand-ins test routing, not game flow.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const dev = path.resolve(process.argv[2] || 'scripts/dev');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-flow-gates-'));
const log = path.join(scratch, 'commands');
function executable(name, text) {
  fs.writeFileSync(path.join(scratch, name), '#!/bin/sh\n' + text, {mode: 0o700});
}
executable('guix', 'while [ "$1" != -- ]; do shift; done\nshift\nexec "$@"\n');
executable('sigil', 'printf "sigil %s\\n" "$*" >> "$FLOW_GATE_LOG"\nexit "${FLOW_GATE_SIGIL_STATUS:-0}"\n');
executable('node', 'printf "node %s\\n" "$*" >> "$FLOW_GATE_LOG"\nexit 17\n');
function run(args, unitStatus = '0') {
  fs.writeFileSync(log, '');
  const result = spawnSync('sh', [dev, ...args], {encoding: 'utf8', env: {
    ...process.env, PATH: scratch + path.delimiter + process.env.PATH,
    FLOW_GATE_LOG: log, FLOW_GATE_SIGIL_STATUS: unitStatus,
  }});
  assert.equal(result.signal, null);
  return {status: result.status, commands: fs.readFileSync(log, 'utf8').trim().split('\n')};
}
try {
  assert.deepEqual(run(['sigil', 'test']), {status: 17,
    commands: ['sigil test', 'node test/test-native-flow.mjs']},
  'full dev tests must invoke the tracked native probe and propagate its failure');
  assert.deepEqual(run(['sigil', 'test'], '23'), {status: 23, commands: ['sigil test']},
    'a failed unit suite must fail before native integration');
  assert.deepEqual(run(['sigil', 'test', '--sgl', 'test/test-app-flow.sgl']), {status: 0,
    commands: ['sigil test --sgl test/test-app-flow.sgl']},
  'a focused unit run stays focused');
  console.log('FLOW GATE WIRING GREEN: native failure propagates; unit failures and focused runs preserved');
} finally {
  fs.rmSync(scratch, {recursive: true});
}
