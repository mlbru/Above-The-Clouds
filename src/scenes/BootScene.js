import Phaser from 'phaser';
import { ProgressionSystem } from '../systems/ProgressionSystem.js';
import { buildAllTextures } from '../render/textures.js';
import { Audio } from '../systems/AudioSystem.js';
import { AUDIO_MANIFEST } from '../data/audioManifest.js';
import { PixelText, COLORS } from '../ui/PixelText.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // Optional real audio; missing files must never break the game.
    this.load.on('loaderror', (file) => console.warn(`[audio] could not load ${file.key}, using synth fallback`));
    for (const a of AUDIO_MANIFEST) this.load.audio(a.key, a.url);
  }

  create() {
    const prog = new ProgressionSystem();
    this.registry.set('progression', prog);
    new PixelText(this, 240, 130, 'PREPARING THE MOUNTAIN...', { color: COLORS.dim }).setOrigin(0.5, 0);
    // Let the loading text render before the (synchronous) texture generation.
    this.time.delayedCall(30, () => {
      buildAllTextures(this, prog.data.look);
      Audio.setSampleSource(this.sound, this.cache.audio);
      Audio.setVolumes(prog.settings.music, prog.settings.sfx);
      const params = new URLSearchParams(window.location.search);
      if (params.has('tutorial')) this.scene.start('Climb', { tutorial: true });
      else if (params.has('play')) this.scene.start('Climb', {});
      else this.scene.start('Menu');
    });
  }
}
