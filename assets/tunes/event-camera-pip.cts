(tune version: 1 name: "camera-pip" tempo: 125 speed: 2 channels: 2
  (instruments
    (instrument id: 1 name: "relay" patch: (chip-noise attack: 0.001 cutoff: 6000 decay: 0.008 hp: 2000 osc-amp: 0.6 release: 0.006 sustain: 0) volume: 26)
    (instrument id: 2 name: "tone" patch: (fm4-bell amp-attack: 0.002 amp-decay: 0.04 amp-release: 0.02 amp-sustain: 0 index: 0.08) volume: 14))
  (patterns
    (pattern id: 0 rows: 8
      (row 0 (2 "C-5" 1 22 "000"))
      (row 1 (1 "G-6" 2 11 "000"))
      (row 2 (2 "C-5" 1 22 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-26" "P3 device sound: The camera's pip (B, for the game) (sketchbook devices)")))
