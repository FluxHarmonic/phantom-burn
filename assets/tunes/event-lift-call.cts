(tune version: 1 name: "event-lift-call" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.4 damp: 0.6 mix: 0.18 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "chime" patch: (fm4-bell amp-attack: 0.003 amp-decay: 0.7 amp-release: 0.3 amp-sustain: 0 index: 0.2) volume: 26)
    (instrument id: 2 name: "car" patch: (chip-noise attack: 0.02 cutoff: 500 decay: 0.3 hp: 40 osc-amp: 0.7 release: 0.1 sustain: 0) volume: 30))
  (patterns
    (pattern id: 0 rows: 100
      (row 0 (1 "E-6" 1 26 "000"))
      (row 18 (1 "C-6" 1 24 "000"))
      (row 40 (2 "C-3" 2 30 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-29" "Phantom 0.1: the service lift, called: its two-note chime and the car arriving")))
