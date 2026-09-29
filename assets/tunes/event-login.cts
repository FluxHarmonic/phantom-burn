(tune version: 1 name: "event-login" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "key" patch: (chip-noise attack: 0.001 cutoff: 8000 decay: 0.012 hp: 2500 osc-amp: 0.5 release: 0.01 sustain: 0) volume: 26)
    (instrument id: 2 name: "granted" patch: (fm4-bell amp-attack: 0.005 amp-decay: 0.25 amp-release: 0.15 amp-sustain: 0 index: 0.3) volume: 22))
  (patterns
    (pattern id: 0 rows: 60
      (row 0 (1 "C-5" 1 26 "000"))
      (row 4 (1 "D-5" 1 24 "000"))
      (row 7 (1 "C-5" 1 26 "000"))
      (row 11 (1 "E-5" 1 22 "000"))
      (row 16 (2 "E-5" 2 22 "000"))
      (row 21 (2 "B-5" 2 24 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-29" "Phantom 0.1: a terminal login (the sticky note's password, or a session left open): keys, then access granted")))
