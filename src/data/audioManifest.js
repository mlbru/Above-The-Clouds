// Recorded sounds. Each entry: { key, url, gain?, rate?, reverb? }; several
// entries with one key are takes of the same sound (one is picked at random).
// A key with recordings replaces the synthesized sound of the same name.
//   grab, grab-ice   hands on a hold          boot, boot-snow   a foot placed
//   pebble           small stones bouncing    rockfall          a rockfall / crumbling hold
//   rockhit          a rock hitting you       slide             sliding down the rock
//   crystal          a crystal ringing        wind              a seamless wind loop
// Import files with ?inline so the one-file builds stay one file.
// Empty: all sound effects are synthesized (see AudioSystem).
export const AUDIO_MANIFEST = [];
