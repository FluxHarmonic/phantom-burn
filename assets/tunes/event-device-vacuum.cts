(tune version: 1 name: "device-vacuum" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.3 damp: 0.6 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "motor" patch: (drone-saw attack: 0.35 breath-lo: 0.85 breath-rate: 0.4 bright: 10 cents: 0 detune: 6 level: 0.4 release: 0.4 seed: 71) volume: 40 gain: 0.8 send: 0.1)
    (instrument id: 2 name: "suction" patch: (noise-bed attack: 0.35 centre: 2200 color: pink hp: 500 level: 1 lp: 6000 rate: 0.12 release: 0.4 seed: 73 wander: 0.25 width: 1.4) volume: 44 gain: 1.0 send: 0.1))
  (patterns
    (pattern id: 0 rows: 170
      (row 0 (1 "D-3" 1 40 "000") (2 "C-4" 2 44 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-29" "Phantom 0.1: the night cleaner's vacuum, one 3 s cycle of a loop (a motor's whine and the suction's hiss)")))
