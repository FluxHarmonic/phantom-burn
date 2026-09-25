(tune version: 1 name: "event-note" tempo: 125 speed: 1 channels: 1
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "chime" patch: (fm4-bell amp-attack: 0.002 amp-decay: 0.6 amp-release: 0.3 amp-sustain: 0 index: 0.5) volume: 22 send: 0.2))
  (patterns
    (pattern id: 0 rows: 125
      (row 0 (1 "G-5" 1 22 "000"))
      (row 10 (1 "D-6" 1 20 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-25" "S1 event: Patch note (sketchbook events)")))
