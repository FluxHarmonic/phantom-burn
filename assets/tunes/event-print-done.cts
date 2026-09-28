(tune version: 1 name: "print-done" tempo: 125 speed: 1 channels: 2
  (instruments
    (instrument id: 1 name: "clack" patch: (chip-noise attack: 0.001 cutoff: 5000 decay: 0.03 hp: 900 osc-amp: 0.7 release: 0.02 sustain: 0) volume: 40)
    (instrument id: 2 name: "feed" patch: (chip-noise attack: 0.004 cutoff: 3500 decay: 0.07 hp: 600 osc-amp: 0.6 release: 0.04 sustain: 0) volume: 28))
  (patterns
    (pattern id: 0 rows: 50
      (row 0 (1 "C-5" 1 40 "000"))
      (row 3 (2 "C-5" 2 28 "000"))
      (row 9 (2 "D-5" 2 20 "000"))
      (row 16 (2 "C-5" 2 12 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-26" "P3 device sound: The printer: done (sketchbook devices)")))
