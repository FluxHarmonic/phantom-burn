(tune version: 1 name: "terminal-close" tempo: 125 speed: 3 channels: 2
  (instruments
    (instrument id: 1 name: "tick" patch: (chip-noise attack: 0.001 cutoff: 8000 decay: 0.012 hp: 2500 osc-amp: 0.5 release: 0.01 sustain: 0) volume: 26)
    (instrument id: 2 name: "wake" patch: (fm4-bell amp-attack: 0.01 amp-decay: 0.3 amp-release: 0.1 amp-sustain: 0.3 index: 0.25) volume: 18))
  (patterns
    (pattern id: 0 rows: 12
      (row 0 (2 "G-6" 2 18 "000"))
      (row 1 (2 "..." 0 0 "210"))
      (row 2 (2 "..." 0 0 "210"))
      (row 3 (2 "===" 0 0 "000"))
      (row 4 (1 "C-5" 1 26 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-26" "P3 device sound: The terminal: closed (sketchbook devices)")))
