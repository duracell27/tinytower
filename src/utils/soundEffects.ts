// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = any;

let collectPlayer: Player | null = null;
let listPlayer: Player | null = null;
let buyPlayer: Player | null = null;

async function loadSounds() {
  try {
    const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');
    await setAudioModeAsync({ playsInSilentMode: true });
    collectPlayer = createAudioPlayer(require('../../assets/sounds/collect.wav'));
    listPlayer    = createAudioPlayer(require('../../assets/sounds/list.wav'));
    buyPlayer     = createAudioPlayer(require('../../assets/sounds/buy.wav'));
  } catch {
    // native module not available — silent fallback
  }
}

loadSounds();

function play(p: Player | null) {
  try {
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch { /* ignore */ }
}

export const playCollectSound = () => play(collectPlayer);
export const playListSound    = () => play(listPlayer);
export const playBuySound     = () => play(buyPlayer);
