(tune version: 1 name: "bed-sim-b" tempo: 150 speed: 3 channels: 2
  (instruments
    (instrument id: 1 name: "glass" patch: (drone-fm attack: 3 breath-lo: 0.5 breath-rate: 0.05 index: 1 index-rate: 0.05 index-wander: 0.3 level: 0.2 mod: 2 release: 4 seed: 73) volume: 21 gain: 0.3)
    (instrument id: 2 name: "fan" patch: (noise-bed attack: 3 centre: 4000 color: pink hp: 2500 level: 1 lp: 7000 rate: 0.02 release: 4 seed: 74 wander: 0.1 width: 1.7) volume: 6 gain: 0.2))
  (patterns
    (pattern id: 0 rows: 16
      (row 0 (1 "B-4" 1 21 "000") (2 "C-5" 2 6 "000")))
    (pattern id: 1 rows: 256
      (row 255 (2 "..." 0 0 "B01"))))
  (order 0 1)
  (history
    ("claude" "2026-09-26" "PRACTICE: the sim's bed, a glassy digital air (sketchbook practice)")))
