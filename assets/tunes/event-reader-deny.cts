(tune version: 1 name: "event-reader-deny" tempo: 125 speed: 1 channels: 1
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "buzz" patch: (chip-saw attack: 0.002 crush-bits: 8 cutoff: 2200 decay: 0.1 osc-amp: 0.4 release: 0.03 sustain: 0.6) volume: 26))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "C-5" 1 26 "000"))
      (row 6 (1 "===" 0 0 "000"))
      (row 9 (1 "C-5" 1 26 "000"))
      (row 15 (1 "===" 0 0 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: Card reader: refused (sketchbook events)")))
