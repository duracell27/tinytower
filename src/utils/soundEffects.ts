import { useSettingsStore } from '../stores/settingsStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = any;

let collectPlayer: Player | null = null;
let listPlayer: Player | null = null;
let buyPlayer: Player | null = null;
let elevatorRunPlayer: Player | null = null;
let elevatorArrivedPlayer: Player | null = null;

async function loadSounds() {
  try {
    const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');
    await setAudioModeAsync({ playsInSilentMode: true });
    collectPlayer         = createAudioPlayer(require('../../assets/sounds/collect.wav'));
    listPlayer            = createAudioPlayer(require('../../assets/sounds/restock.wav'));
    buyPlayer             = createAudioPlayer(require('../../assets/sounds/purchase.wav'));
    elevatorRunPlayer     = createAudioPlayer(require('../../assets/sounds/elevatorrun.wav'));
    elevatorArrivedPlayer = createAudioPlayer(require('../../assets/sounds/elevatorarrived.wav'));
  } catch {
    // native module not available — silent fallback
  }
}

loadSounds();

const allPlayers = () => [collectPlayer, listPlayer, buyPlayer, elevatorRunPlayer, elevatorArrivedPlayer];

async function play(p: Player | null) {
  try {
    if (!p) return;
    if (!useSettingsStore.getState().soundEffectsEnabled) return;
    for (const other of allPlayers()) {
      if (other && other !== p) {
        try { other.pause(); } catch { /* ignore */ }
      }
    }
    await p.seekTo(0);
    p.play();
  } catch { /* ignore */ }
}

export const playCollectSound         = () => play(collectPlayer);
export const playListSound            = () => play(listPlayer);
export const playBuySound             = () => play(buyPlayer);
export const playElevatorRunSound     = () => play(elevatorRunPlayer);
export const playElevatorArrivedSound = () => play(elevatorArrivedPlayer);
