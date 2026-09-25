(tune version: 1 name: "event-door-close" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "thud" patch: (chip-noise attack: 0.003 cutoff: 1100 decay: 0.1 hp: 280 osc-amp: 0.8 release: 0.06 sustain: 0) volume: 48)
    (instrument id: 2 name: "latch" patch: (chip-noise attack: 0.001 cutoff: 7000 decay: 0.012 hp: 2000 osc-amp: 0.6 release: 0.01 sustain: 0) volume: 44))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "C-5" 1 48 "000"))
      (row 3 (2 "C-5" 2 44 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: A door closes (sketchbook events)")))
