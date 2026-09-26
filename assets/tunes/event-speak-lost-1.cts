(tune version: 1 name: "speak-lost-1" tempo: 125 speed: 3 channels: 2
  (instruments
    (instrument id: 1 name: "voice" patch: (chip-pulse attack: 0.002 crush-bits: 4 crush-rate: 4 decay: 0.07 drive: 0.7 osc-amp: 0.55 release: 0.012 spread: 18 sustain: 0.35 unison: 3 width: 0.3) volume: 64 gain: 0.8 layers: ((fm4-stab cutoff: 3500 decay: 0.06 index: 3.5 ratio: 1.41 release: 0.02 octave: 0 volume: 0.55)))
    (instrument id: 2 name: "grit" patch: (chip-noise attack: 0.001 cutoff: 6000 decay: 0.03 hp: 1500 osc-amp: 0.55 release: 0.008 sustain: 0) volume: 64))
  (patterns
    (pattern id: 0 rows: 12
      (row 0 (1 "D-4" 1 42 "000") (2 "C-5" 2 34 "000"))
      (row 1 (1 "===" 0 0 "000"))
      (row 2 (1 "A-3" 1 38 "206"))
      (row 3 (1 "..." 0 0 "206"))
      (row 4 (1 "..." 0 0 "206"))
      (row 5 (1 "===" 0 0 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-26" "robot speak: Lost you (giving up) (sketchbook robotspeak)")))
