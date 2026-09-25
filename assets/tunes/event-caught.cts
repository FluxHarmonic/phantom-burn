(tune version: 1 name: "event-caught" tempo: 125 speed: 1 channels: 3
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "stab" patch: (fm4-stab cutoff: 1800 decay: 0.8 index: 0.9 release: 0.4) volume: 30)
    (instrument id: 2 name: "stab, the second" patch: (fm4-stab cutoff: 1800 decay: 0.8 index: 0.9 release: 0.4) volume: 28)
    (instrument id: 3 name: "burst" patch: (chip-noise attack: 0.01 cutoff: 5000 decay: 0.5 hp: 600 osc-amp: 0.5 release: 0.3 sustain: 0) volume: 26))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "F-4" 1 30 "000") (2 "F#4" 2 28 "000"))
      (row 2 (3 "C-5" 3 26 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: Caught (sketchbook events)")))
