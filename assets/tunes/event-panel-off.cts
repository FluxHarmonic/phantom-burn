(tune version: 1 name: "event-panel-off" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "switch" patch: (chip-noise attack: 0.001 cutoff: 7000 decay: 0.012 hp: 2000 osc-amp: 0.6 release: 0.01 sustain: 0) volume: 44)
    (instrument id: 2 name: "power down" patch: (fm4-stab cutoff: 1400 decay: 0.3 index: 0.4 release: 0.15) volume: 20))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "C-5" 1 44 "000"))
      (row 1 (2 "G-5" 2 34 "000"))
      (row 4 (2 "D-5" 2 24 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: Lights off (sketchbook events)")))
