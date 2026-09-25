(tune version: 1 name: "event-badge" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "card" patch: (chip-noise attack: 0.001 cutoff: 9000 decay: 0.02 hp: 3000 osc-amp: 0.5 release: 0.01 sustain: 0) volume: 36)
    (instrument id: 2 name: "chirp" patch: (fm4-bell amp-attack: 0.001 amp-decay: 0.18 amp-release: 0.1 amp-sustain: 0 index: 0.4) volume: 22))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "C-5" 1 36 "000"))
      (row 3 (2 "C-6" 2 22 "000"))
      (row 6 (2 "E-6" 2 22 "000"))
      (row 9 (2 "G-6" 2 24 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: The badge (sketchbook events)")))
