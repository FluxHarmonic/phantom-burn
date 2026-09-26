(tune version: 1 name: "camera-alert" tempo: 125 speed: 3 channels: 2
  (bus reverb: zitarev size: 0.3 damp: 0.6 mix: 0.12 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "servo" patch: (chip-saw attack: 0.015 crush-bits: 9 cutoff: 2400 decay: 0.25 osc-amp: 0.35 release: 0.05 sustain: 0.5) volume: 18 send: 0.2)
    (instrument id: 2 name: "alarm" patch: (fm4-stab cutoff: 5000 decay: 0.06 index: 1.1 release: 0.03) volume: 30 send: 0.2))
  (patterns
    (pattern id: 0 rows: 25
      (row 0 (1 "E-5" 1 18 "000"))
      (row 1 (1 "..." 0 0 "10C"))
      (row 2 (1 "===" 0 0 "000"))
      (row 3 (2 "B-6" 2 30 "000"))
      (row 4 (2 "F#6" 2 28 "000"))
      (row 5 (2 "B-6" 2 30 "000"))
      (row 6 (2 "F#6" 2 28 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-26" "P3 device sound: A camera sees you (sketchbook devices)")))
