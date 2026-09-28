(tune version: 1 name: "device-vent" tempo: 125 speed: 1 channels: 2
  (bus reverb: zitarev size: 0.3 damp: 0.6 mix: 0.12 comp: on threshold: -12 ratio: 4 attack: 5 release: 80 makeup: 2)
  (instruments
    (instrument id: 1 name: "roar" patch: (noise-bed attack: 0.3 centre: 1500 color: pink hp: 250 level: 1 lp: 7000 rate: 0.05 release: 0.6 seed: 7 wander: 0.15 width: 1.9) volume: 64 gain: 1.6 send: 0.2)
    (instrument id: 2 name: "rumble" patch: (noise-bed attack: 0.3 centre: 500 color: brown hp: 250 level: 1 lp: 1400 rate: 0.03 release: 0.6 seed: 9 wander: 0.2 width: 1.2) volume: 48 gain: 1.6 send: 0.2))
  (patterns
    (pattern id: 0 rows: 150
      (row 0 (1 "C-4" 1 64 "000") (2 "C-3" 2 48 "000"))))
  (order 0)
  (history
    ("claude" "2026-09-26" "P3 device sound: The HVAC vent, on (sketchbook devices)")))
