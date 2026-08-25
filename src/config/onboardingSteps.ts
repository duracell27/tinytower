import type { OnboardingStep } from '../stores/onboardingStore';

export interface BulletItem {
  icon: ReturnType<typeof require>;
  text: string;
}

export interface StepConfig {
  text: string;
  iconSource?: ReturnType<typeof require>;
  /** Omit for steps that wait for a measured targetRect — arrow hides until measurement arrives */
  pointer?: { x: number; y: number };
  arrowDir: 'up' | 'down' | 'left' | 'right';
  dismissable: boolean;
  dismissLabel?: string;
  /** Override spotlight top padding (default 41 = slot body measurement; use 8 for full-card measurement) */
  spotlightPadTop?: number;
  /** Override arrow bottom offset inside spotlight (default 60) */
  arrowBottomOffset?: number;
  /** Shift arrow horizontally by this many pixels (positive = right) */
  arrowOffsetX?: number;
  /** Place arrow just above the spotlight instead of inside it (for full-card tap targets) */
  arrowAboveSpotlight?: boolean;
  /** Place arrow just below the spotlight, pointing upward at the highlighted element */
  arrowBelowSpotlight?: boolean;
  /** Extra px to push arrow further below the spotlight bottom (used with arrowBelowSpotlight) */
  arrowBelowOffset?: number;
  /** Place hint card below the spotlight instead of above it */
  hintBelowSpotlight?: boolean;
  /** If true, SpotlightTapTarget renders over the spotlight hole and fires the registered action on tap */
  spotlightPressEnabled?: boolean;
  /** Center the card on screen — no spotlight, no arrow */
  centered?: boolean;
  /** Bullet list with icon + text rows rendered below the main text */
  bullets?: BulletItem[];
}

// Pointer positions are approximate fractions of screen dimensions.
// x: 0 = left edge, 1 = right edge
// y: 0 = top edge, 1 = bottom edge
// Tune these values after visual testing.
export const ONBOARDING_STEPS: Record<Exclude<OnboardingStep, 'done'>, StepConfig> = {
  collect_slot_1: {
    text: 'Collect revenue from your business',
    iconSource: require('../../assets/img/coin.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  collect_slot_2: {
    text: 'Collect revenue from one more floor',
    iconSource: require('../../assets/img/coin.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_1: {
    text: 'Restock goods so production keeps running',
    iconSource: require('../../assets/img/ForkliftIcon.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_2: {
    text: 'Restock another production',
    iconSource: require('../../assets/img/ForkliftIcon.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  open_elevator_1: {
    text: 'Open the elevator — visitors are waiting',
    iconSource: require('../../assets/img/lift/visitor.png'),
    pointer: { x: 0.5, y: 0.78 },
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
  },
  deliver_visitor: {
    text: 'Open the elevator and take the guest to their floor',
    iconSource: require('../../assets/img/lift/visitor.png'),
    pointer: { x: 0.5, y: 0.78 },
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
  },
  assign_worker: {
    text: 'Tap a worker slot — assign your first employee to a floor!',
    iconSource: require('../../assets/img/workers/man-green.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_floor: {
    text: 'Buy a new floor to expand your tower!',
    iconSource: require('../../assets/img/workers/builder.png'),
    arrowDir: 'up',
    dismissable: false,
    spotlightPadTop: 8,
    hintBelowSpotlight: true,
    spotlightPressEnabled: true,
  },
  choose_floor_type: {
    text: 'All types earn equally. Green floors need frequent attention, red ones less often',
    iconSource: require('../../assets/img/menu/myBusiness.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  speed_up_construction: {
    text: 'Speed up construction so you don\'t have to wait',
    iconSource: require('../../assets/img/diamond.png'),
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
    hintBelowSpotlight: true,
  },
  expand_floor_card: {
    text: 'Expand the floor card to see which materials are needed',
    iconSource: require('../../assets/img/sandClock.png'),
    arrowDir: 'up',
    dismissable: false,
    spotlightPadTop: 8,
    hintBelowSpotlight: true,
    arrowBelowSpotlight: true,
    arrowBelowOffset: 3,
    arrowOffsetX: 162,
  },
  open_business: {
    text: 'You have the resources! Tap to open the business',
    iconSource: require('../../assets/img/tools/briks.png'),
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    hintBelowSpotlight: true,
    arrowOffsetX: 70,
  },
  final_message: {
    text: 'Welcome! The tower is yours! 🎉',
    iconSource: require('../../assets/img/managerIcon.png'),
    arrowDir: 'up',
    dismissable: true,
    dismissLabel: 'Let\'s go!',
    centered: true,
    bullets: [
      { icon: require('../../assets/img/coin.png'),      text: 'Build new floors and collect revenue' },
      { icon: require('../../assets/img/worker.png'),    text: 'Hire and upgrade workers' },
      { icon: require('../../assets/img/hotel.png'),     text: 'Take guests by elevator — earn tips' },
      { icon: require('../../assets/img/starFull.png'),  text: 'Climb to the top of the leaderboard' },
    ],
  },
};
