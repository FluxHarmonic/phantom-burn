(tune version: 1 name: "event-door-open" tempo: 125 speed: 1 channels: 3
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "push bar" patch: (chip-noise attack: 0.002 cutoff: 1300 decay: 0.06 hp: 300 osc-amp: 0.7 release: 0.04 sustain: 0) volume: 44)
    (instrument id: 2 name: "latch" patch: (chip-noise attack: 0.001 cutoff: 7000 decay: 0.012 hp: 2000 osc-amp: 0.6 release: 0.01 sustain: 0) volume: 40)
    (instrument id: 3 name: "stairwell air" patch: (noise-bed attack: 0.08 centre: 900 color: pink hp: 300 level: 1 lp: 4000 release: 0.5 seed: 5 wander: 0 width: 1.5) volume: 22 gain: 2))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "C-5" 1 44 "000"))
      (row 2 (2 "C-5" 2 40 "000"))
      (row 4 (3 "C-4" 3 22 "000"))
      (row 40 (3 "===" 0 0 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: A door opens (sketchbook events)")))
