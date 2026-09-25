(tune version: 1 name: "event-panel-on" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "switch" patch: (chip-noise attack: 0.001 cutoff: 7000 decay: 0.012 hp: 2000 osc-amp: 0.6 release: 0.01 sustain: 0) volume: 44)
    (instrument id: 2 name: "ballast tick" patch: (fm4-bell amp-attack: 0.001 amp-decay: 0.05 amp-release: 0.02 amp-sustain: 0 index: 1.2) volume: 22))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "C-5" 1 44 "000"))
      (row 6 (2 "C-7" 2 18 "000"))
      (row 9 (2 "C-7" 2 12 "000"))
      (row 15 (2 "G-6" 2 20 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: Lights on (sketchbook events)")))
