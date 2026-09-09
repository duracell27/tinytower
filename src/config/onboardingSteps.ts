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
    text: 'onboarding.collect_slot_1',
    iconSource: require('../../assets/img/coin.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  collect_slot_2: {
    text: 'onboarding.collect_slot_2',
    iconSource: require('../../assets/img/coin.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_1: {
    text: 'onboarding.buy_goods_1',
    iconSource: require('../../assets/img/ForkliftIcon.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_2: {
    text: 'onboarding.buy_goods_2',
    iconSource: require('../../assets/img/ForkliftIcon.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  open_elevator_1: {
    text: 'onboarding.open_elevator_1',
    iconSource: require('../../assets/img/lift/visitor.png'),
    pointer: { x: 0.5, y: 0.78 },
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
  },
  deliver_visitor: {
    text: 'onboarding.deliver_visitor',
    iconSource: require('../../assets/img/lift/visitor.png'),
    pointer: { x: 0.5, y: 0.78 },
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
  },
  assign_worker: {
    text: 'onboarding.assign_worker',
    iconSource: require('../../assets/img/workers/man-green.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_floor: {
    text: 'onboarding.buy_floor',
    iconSource: require('../../assets/img/workers/builder.png'),
    arrowDir: 'up',
    dismissable: false,
    spotlightPadTop: 8,
    hintBelowSpotlight: true,
    spotlightPressEnabled: true,
  },
  choose_floor_type: {
    text: 'onboarding.choose_floor_type',
    iconSource: require('../../assets/img/menu/myBusiness.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  speed_up_construction: {
    text: 'onboarding.speed_up_construction',
    iconSource: require('../../assets/img/diamond.png'),
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
    hintBelowSpotlight: true,
  },
  expand_floor_card: {
    text: 'onboarding.expand_floor_card',
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
    text: 'onboarding.open_business',
    iconSource: require('../../assets/img/tools/briks.png'),
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    hintBelowSpotlight: true,
    arrowOffsetX: 70,
  },
  final_message: {
    text: 'onboarding.final_message',
    iconSource: require('../../assets/img/managerIcon.png'),
    arrowDir: 'up',
    dismissable: true,
    dismissLabel: 'onboarding.final_message_dismiss',
    centered: true,
    bullets: [
      { icon: require('../../assets/img/coin.png'),      text: 'onboarding.final_message_bullet_1' },
      { icon: require('../../assets/img/worker.png'),    text: 'onboarding.final_message_bullet_2' },
      { icon: require('../../assets/img/hotel.png'),     text: 'onboarding.final_message_bullet_3' },
      { icon: require('../../assets/img/starFull.png'),  text: 'onboarding.final_message_bullet_4' },
    ],
  },
};
