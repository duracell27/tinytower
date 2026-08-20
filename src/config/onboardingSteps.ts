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
  /** Place hint card below the spotlight instead of above it */
  hintBelowSpotlight?: boolean;
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
    text: 'Збери виручку з виробництва',
    iconSource: require('../../assets/img/coin.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  collect_slot_2: {
    text: 'Збери виручку ще з одного поверху',
    iconSource: require('../../assets/img/coin.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_1: {
    text: 'Закупи товари щоб виробництво не зупинялось',
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_2: {
    text: 'Закупи ще одне виробництво',
    arrowDir: 'down',
    dismissable: false,
  },
  open_elevator_1: {
    text: 'Відкрий ліфт — там чекають відвідувачі',
    pointer: { x: 0.5, y: 0.78 },
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
  },
  deliver_visitor: {
    text: 'Відкрий ліфт та відвези гостя на потрібний поверх',
    pointer: { x: 0.5, y: 0.78 },
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
  },
  assign_worker: {
    text: 'Натисни на слот робітника — призначте першого працівника на поверх!',
    iconSource: require('../../assets/img/happySmile.png'),
    arrowDir: 'down',
    dismissable: false,
  },
  buy_floor: {
    text: 'Купи новий поверх щоб розширити вежу!',
    iconSource: require('../../assets/img/coin.png'),
    pointer: { x: 0.5, y: 0.15 },
    arrowDir: 'up',
    dismissable: false,
  },
  choose_floor_type: {
    text: 'Всі категорії рівні по виручці. Зелені — треба часто доглядати, червоні — рідше',
    arrowDir: 'down',
    dismissable: false,
  },
  speed_up_construction: {
    text: 'Пришвидш будівництво щоб не чекати',
    iconSource: require('../../assets/img/diamond.png'),
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    arrowAboveSpotlight: true,
    hintBelowSpotlight: true,
  },
  expand_floor_card: {
    text: 'Розкрий поверх і подивись які матеріали потрібні',
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    hintBelowSpotlight: true,
  },
  open_business: {
    text: 'Ресурси є! Тисни — відкрий бізнес',
    iconSource: require('../../assets/img/coin.png'),
    arrowDir: 'down',
    dismissable: false,
    spotlightPadTop: 8,
    hintBelowSpotlight: true,
    arrowOffsetX: 70,
  },
  final_message: {
    text: 'Вітаємо! Вежа в твоїх руках! 🎉',
    iconSource: require('../../assets/img/happySmile.png'),
    arrowDir: 'up',
    dismissable: true,
    dismissLabel: 'Погнали!',
    centered: true,
    bullets: [
      { icon: require('../../assets/img/coin.png'),      text: 'Будуй нові поверхи та збирай виручку' },
      { icon: require('../../assets/img/worker.png'),    text: 'Наймай та прокачуй робітників' },
      { icon: require('../../assets/img/hotel.png'),     text: 'Відвози гостей ліфтом — отримуй чайові' },
      { icon: require('../../assets/img/starFull.png'),  text: 'Підкоряй топ рейтингу' },
    ],
  },
};
