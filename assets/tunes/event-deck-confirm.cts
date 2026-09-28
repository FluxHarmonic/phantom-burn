(tune version: 1 name: "deck-confirm" tempo: 125 speed: 1 channels: 2
  (instruments
    (instrument id: 1 name: "chirp" patch: (fm4-bell amp-attack: 0.001 amp-decay: 0.08 amp-release: 0.04 amp-sustain: 0 index: 0.4) volume: 30)
    (instrument id: 2 name: "tick" patch: (chip-noise attack: 0.001 cutoff: 8000 decay: 0.012 hp: 2500 osc-amp: 0.5 release: 0.01 sustain: 0) volume: 30))
  (patterns
    (pattern id: 0 rows: 30
      (row 0 (1 "E-6" 1 30 "000") (2 "C-5" 2 30 "000"))
      (row 3 (1 "B-6" 1 30 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-26" "P3 device sound: The deck: done (sketchbook devices)")))
