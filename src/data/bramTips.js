// Bram's one-liners: the first time a mechanic shows up in a real run, the
// base camp trader explains it in a single sentence. Each tip is shown once
// per save (progression.data.tipsSeen). At most two lines that fit the bubble.
export const BRAM_TIPS = {
  routes: 'PICK A ROUTE: THE RISKIER ONE CLIMBS HIGHER\nBUT COSTS MORE GRIP.',
  beat: 'PRESS EACH ARROW JUST AS IT HITS THE LINE!',
  jug: 'A BIG JUG! HANG HERE A MOMENT AND YOUR\nGRIP COMES BACK.',
  rest: 'A LEDGE! YOUR GRIP IS FULL AGAIN AND THIS IS\nYOUR NEW CHECKPOINT.',
  slip: "YOU'RE SLIPPING! HIT THE ARROW TO GRAB ON!",
  fall: 'ONE FALL PER AREA IS FREE. THE NEXT ONE\nHERE SENDS YOU BACK TO 0 M!',
  streak: 'PERFECTS IN A ROW! 10 IN A ROW GIVES\nYOU GRIP BACK.',
  gems: 'SEE THAT GEM? TAKE ITS ROUTE TO GRAB IT.',
  offbeat: 'OFF-BEAT! THIS RHYTHM SKIPS. WATCH THE\nGAPS, NOT THE CLOCK.',
  hold: 'LONG NOTE! KEEP THE ARROW HELD UNTIL\nTHE TAIL ENDS.',
  gust: 'WIND GUST! THE TIMING GETS TIGHTER WHILE\nIT BLOWS.',
  blind: 'BLIND NOTES FADE OUT. KEEP THE BEAT\nIN YOUR HEAD!',
  loose: 'LOOSE ROCK! A MISS HERE COSTS EXTRA GRIP.',
  icy: 'ICE! SMALLER TIMING WINDOW, AND IT DRAINS\nGRIP WHILE YOU HANG.',
  crumbling: 'THIS HOLD IS CRUMBLING! PICK A ROUTE\nBEFORE IT BREAKS!',
  rockfall: 'DUCK THE ROCK! PRESS THE ARROW ON THE BEAT!',
  whiteout: 'A WHITEOUT IS COMING: NOTES SHOW LATE,\nBUT GEMS TURN UP TWICE AS OFTEN.',
  thermals: 'A THERMAL! HIT THE ORANGE UP-NOTE PERFECTLY\nAND THE WIND LIFTS YOU 3 M.',
  darkness: 'TOO DARK TO SEE! THE NOTES FLASH ON\nEVERY BEAT. FOLLOW THE PULSE.',
  crystal: 'SEE THE LIGHT SWEEP? CLIMB THE LIT ROUTE\nAND IT COSTS YOU NO GRIP AT ALL!',
};

// Route tags (from the segment generator) that have their own tip.
export const TAG_TIPS = { OFFBEAT: 'offbeat', HOLD: 'hold', GUST: 'gust', BLIND: 'blind' };
