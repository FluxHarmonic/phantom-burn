(tune version: 1 name: "event-reader-ok" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "tone" patch: (fm4-stab cutoff: 3000 decay: 0.09 index: 0.3 release: 0.03) volume: 30)
    (instrument id: 2 name: "relay" patch: (chip-noise attack: 0.002 cutoff: 1300 decay: 0.06 hp: 300 osc-amp: 0.7 release: 0.04 sustain: 0) volume: 34))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "E-6" 1 44 "000"))
      (row 5 (1 "B-6" 1 44 "000"))
      (row 10 (2 "C-5" 2 34 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: Card reader: accepted (sketchbook events)")))
