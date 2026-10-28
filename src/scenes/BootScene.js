import Phaser from 'phaser';
import { ProgressionSystem } from '../systems/ProgressionSystem.js';
import { buildAllTextures } from '../render/textures.js';
import { Audio } from '../systems/AudioSystem.js';
import { AUDIO_MANIFEST } from '../data/audioManifest.js';
import { PixelText, COLORS } from '../ui/PixelText.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const prog = new ProgressionSystem();
    this.registry.set('progression', prog);
    new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'PREPARING THE MOUNTAIN...', { color: COLORS.dim }).setOrigin(0.5, 0);
    // Let the loading text render before the (synchronous) texture generation.
    this.time.delayedCall(30, () => {
      buildAllTextures(this, prog.data.look);
      Audio.setSampleSource(this.sound, this.cache.audio);
      // Recorded sounds; missing or broken files keep the synth sound.
      Audio.loadSamples(AUDIO_MANIFEST);
      Audio.setVolumes(prog.settings.music, prog.settings.sfx);
      const params = new URLSearchParams(window.location.search);
      if (params.has('tutorial')) this.scene.start('Climb', { tutorial: true });
      else if (params.has('play')) this.scene.start('Climb', {});
      // Dev only: ?at=1450 starts a test run (nothing saved) at that height.
      else if (import.meta.env.DEV && params.has('at')) this.scene.start('Climb', { devStart: Number(params.get('at')) || 0 });
      // The very first launch skips the title: straight onto the wall, and
      // Bram explains as you go. The title screen comes after the first run.
      else if (!prog.data.runs) { this.registry.set('introShown', true); this.scene.start('Climb', { quickStart: true }); }
      else this.scene.start('Menu');
    });
  }
}
