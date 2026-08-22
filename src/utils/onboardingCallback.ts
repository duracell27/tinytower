// Module-level singleton: a step in game.tsx can register a callback here so that
// OnboardingOverlay's dismiss button triggers game-specific logic (e.g. buyFloor)
// instead of just calling advance().  Cleared on cleanup so it never leaks.
let _fn: (() => void) | null = null;

export const setOnboardingDismissAction = (fn: () => void) => { _fn = fn; };
export const clearOnboardingDismissAction = () => { _fn = null; };
export const getOnboardingDismissAction = () => _fn;

// Spotlight-tap action: called when the user taps inside the spotlight hole.
// Used for steps (e.g. buy_floor) where touch-through is unreliable due to RNGH.
let _spotlightFn: (() => void) | null = null;

export const setOnboardingSpotlightAction = (fn: () => void) => { _spotlightFn = fn; };
export const clearOnboardingSpotlightAction = () => { _spotlightFn = null; };
export const getOnboardingSpotlightAction = () => _spotlightFn;
