// Recorded sounds. Each entry: { key, url, gain?, rate?, reverb? }; several
// entries with one key are takes of the same sound (one is picked at random).
// A key with recordings replaces the synthesized sound of the same name.
//   grab, grab-ice   hands on a hold          boot, boot-snow   a foot placed
//   pebble           small stones bouncing    rockfall          a rockfall / crumbling hold
//   rockhit          a rock hitting you       slide             sliding down the rock
//   crystal          a crystal ringing        wind              a seamless wind loop
// Files are imported with ?inline so the one-file builds stay one file. Short
// hits are WAV (no codec delay on the beat); longer sounds are AAC.
// Sources (all CC0), trimmed and normalised in src/assets/audio/:
//   grab, grab-ice, boot, boot-snow  Kenney, Impact Sounds (kenney.nl)
//   pebble, rockfall, rockhit, slide rubberduck, 75 breaking/falling/hit sfx (opengameart.org)
//   crystal                          legoluft, Atmospheric Interaction Sound Pack (opengameart.org)
//   wind                             SketchMan3, wind whoosh loop (opengameart.org)
import boot_1_wav from '../assets/audio/boot-1.wav?inline';
import boot_2_wav from '../assets/audio/boot-2.wav?inline';
import boot_3_wav from '../assets/audio/boot-3.wav?inline';
import boot_snow_1_wav from '../assets/audio/boot-snow-1.wav?inline';
import boot_snow_2_wav from '../assets/audio/boot-snow-2.wav?inline';
import boot_snow_3_wav from '../assets/audio/boot-snow-3.wav?inline';
import boot_snow_4_wav from '../assets/audio/boot-snow-4.wav?inline';
import crystal_1_m4a from '../assets/audio/crystal-1.m4a?inline';
import crystal_2_m4a from '../assets/audio/crystal-2.m4a?inline';
import crystal_3_m4a from '../assets/audio/crystal-3.m4a?inline';
import crystal_4_m4a from '../assets/audio/crystal-4.m4a?inline';
import grab_1_wav from '../assets/audio/grab-1.wav?inline';
import grab_2_wav from '../assets/audio/grab-2.wav?inline';
import grab_3_wav from '../assets/audio/grab-3.wav?inline';
import grab_ice_1_wav from '../assets/audio/grab-ice-1.wav?inline';
import grab_ice_2_wav from '../assets/audio/grab-ice-2.wav?inline';
import pebble_1_wav from '../assets/audio/pebble-1.wav?inline';
import pebble_2_wav from '../assets/audio/pebble-2.wav?inline';
import pebble_3_wav from '../assets/audio/pebble-3.wav?inline';
import pebble_4_wav from '../assets/audio/pebble-4.wav?inline';
import rockfall_1_m4a from '../assets/audio/rockfall-1.m4a?inline';
import rockfall_2_m4a from '../assets/audio/rockfall-2.m4a?inline';
import rockfall_3_m4a from '../assets/audio/rockfall-3.m4a?inline';
import rockhit_1_wav from '../assets/audio/rockhit-1.wav?inline';
import rockhit_2_wav from '../assets/audio/rockhit-2.wav?inline';
import slide_1_m4a from '../assets/audio/slide-1.m4a?inline';
import slide_2_m4a from '../assets/audio/slide-2.m4a?inline';
import wind_m4a from '../assets/audio/wind.m4a?inline';

export const AUDIO_MANIFEST = [
  { key: 'boot', url: boot_1_wav, gain: 0.3 },
  { key: 'boot', url: boot_2_wav, gain: 0.3 },
  { key: 'boot', url: boot_3_wav, gain: 0.3 },
  { key: 'boot-snow', url: boot_snow_1_wav, gain: 0.22 },
  { key: 'boot-snow', url: boot_snow_2_wav, gain: 0.22 },
  { key: 'boot-snow', url: boot_snow_3_wav, gain: 0.22 },
  { key: 'boot-snow', url: boot_snow_4_wav, gain: 0.22 },
  { key: 'crystal', url: crystal_1_m4a, gain: 0.28, rate: 2, reverb: 0.7 },
  { key: 'crystal', url: crystal_2_m4a, gain: 0.28, rate: 2, reverb: 0.7 },
  { key: 'crystal', url: crystal_3_m4a, gain: 0.28, rate: 2, reverb: 0.7 },
  { key: 'crystal', url: crystal_4_m4a, gain: 0.28, rate: 2, reverb: 0.7 },
  { key: 'grab', url: grab_1_wav, gain: 0.35 },
  { key: 'grab', url: grab_2_wav, gain: 0.35 },
  { key: 'grab', url: grab_3_wav, gain: 0.35 },
  { key: 'grab-ice', url: grab_ice_1_wav, gain: 0.22, reverb: 0.3 },
  { key: 'grab-ice', url: grab_ice_2_wav, gain: 0.22, reverb: 0.3 },
  { key: 'pebble', url: pebble_1_wav, gain: 0.16, reverb: 0.3 },
  { key: 'pebble', url: pebble_2_wav, gain: 0.16, reverb: 0.3 },
  { key: 'pebble', url: pebble_3_wav, gain: 0.16, reverb: 0.3 },
  { key: 'pebble', url: pebble_4_wav, gain: 0.16, reverb: 0.3 },
  { key: 'rockfall', url: rockfall_1_m4a, gain: 0.42, reverb: 0.2 },
  { key: 'rockfall', url: rockfall_2_m4a, gain: 0.42, reverb: 0.2 },
  { key: 'rockfall', url: rockfall_3_m4a, gain: 0.42, reverb: 0.2 },
  { key: 'rockhit', url: rockhit_1_wav, gain: 0.5 },
  { key: 'rockhit', url: rockhit_2_wav, gain: 0.5 },
  { key: 'slide', url: slide_1_m4a, gain: 0.32 },
  { key: 'slide', url: slide_2_m4a, gain: 0.32 },
  { key: 'wind', url: wind_m4a, gain: 0.4 },
];
