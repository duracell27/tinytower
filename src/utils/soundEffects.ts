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
    listPlayer    = createAudioPlayer(require('../../assets/sounds/restock.wav'));
    buyPlayer     = createAudioPlayer(require('../../assets/sounds/purchase.wav'));
  } catch {
    // native module not available — silent fallback
  }
}

loadSounds();

const allPlayers = () => [collectPlayer, listPlayer, buyPlayer];

async function play(p: Player | null) {
  try {
    if (!p) return;
    for (const other of allPlayers()) {
      if (other && other !== p) {
        try { other.pause(); } catch { /* ignore */ }
      }
    }
    await p.seekTo(0);
    p.play();
  } catch { /* ignore */ }
}

export const playCollectSound = () => play(collectPlayer);
export const playListSound    = () => play(listPlayer);
export const playBuySound     = () => play(buyPlayer);
