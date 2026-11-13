// The Fossil Reef's ghost tide and the Starfall Crater's falling stars, in
// the climb (systems/mechanics/Tide.js, Starfall.js; world/ReefStarFx.js).
// Installed onto ClimbScene.prototype, so `this` is the climb scene.
import { GhostTide, StarSky } from '../world/ReefStarFx.js';
import { starGems } from '../systems/mechanics/Starfall.js';
import { Audio } from '../systems/AudioSystem.js';

export const climbReefStar = {
  initReefStar() {
    this.ghostTide = new GhostTide(this);
    this.starSky = new StarSky(this);
    this.starStreak0 = 0;
    this.events.once('shutdown', () => { this.ghostTide.destroy(); this.starSky.destroy(); });
  },

  updateReefStar(dt, weightOf, day) {
    const tide = this.mechanics && this.mechanics.get('tide');
    const reduced = this.settings.reducedParticles;
    this.ghostTide.update(dt, tide ? tide.level : 0, weightOf('reef'), day.night, reduced);
    this.starSky.update(dt, weightOf('starfall'), day.night, reduced);
  },

  // Called for the mechanic events of the two (see onMechanicEvent).
  onReefStarEvent(id, event) {
    if (this.director) return;
    if (id === 'tide' && event === 'rising') {
      this.hud.toast('THE GHOST TIDE COMES IN', '#9afff0');
      this.tip('tide');
    } else if (id === 'tide' && event === 'falling') this.hud.toast('THE TIDE GOES OUT', '#c8e8e4');
  },

  // When routes are offered: a star that fell on one comes down now.
  reefStarRoutes() {
    const star = this.routes.find((r) => r.star);
    if (!star) { this.starSky.clearMark(); return; }
    if (star.starShown) return;
    star.starShown = true;
    this.starSky.land(star.target.x, star.target.y, () => {
      this.floatText('A STAR FELL!', '#fff0b0', 20, true);
      Audio.play('rumble');
    });
    this.tip('star');
  },

  reefStarStart() {
    this.starStreak0 = (this.run && this.run.streak) || 0;
  },

  // Each judged note: an ammonite hit perfect gives up a gem (two at high tide).
  reefStarNote(note, route) {
    if (this.director) return;
    if (note.shell && note.result === 'perfect') {
      const n = route.tide ? 2 : 1;
      this.awardGems(n);
      this.floatText(n > 1 ? 'AMMONITE! +2' : 'AMMONITE!', '#ffb89a', 16, true);
      if (!this.settings.reducedParticles) this.effects.sparkle(this.climber.x, this.climber.y - 8, 8);
      Audio.play('gem');
    }
    if (note.star && note.result === 'perfect' && !this.settings.reducedParticles) this.effects.sparkle(this.climber.x, this.climber.y - 4, 3);
  },

  // A star route climbed: its star-metal pays by the streak you brought.
  reefStarDone(route) {
    if (!route.star || this.director) return;
    const n = starGems(Math.max(this.starStreak0, (this.run && this.run.streak) || 0));
    this.awardGems(n);
    this.floatText(`STAR-METAL x${n}`, '#ffe08a', 24, true);
    this.starSky.clearMark(true);
    Audio.play('perfect', { streak: 10 + n * 4 });
  },
};
