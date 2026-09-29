(tune version: 1 name: "event-drawer-open" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.25 damp: 0.7 mix: 0.1 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "slide" patch: (chip-noise attack: 0.02 cutoff: 1800 decay: 0.22 hp: 350 osc-amp: 0.5 release: 0.05 sustain: 0) volume: 30)
    (instrument id: 2 name: "stop" patch: (chip-noise attack: 0.001 cutoff: 4500 decay: 0.04 hp: 700 osc-amp: 0.6 release: 0.02 sustain: 0) volume: 34))
  (patterns
    (pattern id: 0 rows: 40
      (row 0 (1 "C-4" 1 30 "000"))
      (row 12 (2 "C-4" 2 34 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-29" "Phantom 0.1: the FM desk's drawer, opened (a steel runner and its stop)")))
