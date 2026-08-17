import type { OnboardingStep } from '../stores/onboardingStore';

export interface StepConfig {
  text: string;
  iconSource?: ReturnType<typeof require>;
  pointer: { x: number; y: number };
  arrowDir: 'up' | 'down' | 'left' | 'right';
  dismissable: boolean;
  dismissLabel?: string;
}

// Pointer positions are approximate fractions of screen dimensions.
// x: 0 = left edge, 1 = right edge
// y: 0 = top edge, 1 = bottom edge
// Tune these values after visual testing.
export const ONBOARDING_STEPS: Record<Exclude<OnboardingStep, 'done'>, StepConfig> = {
  collect_slot_1: {
    text: 'Збери виручку з виробництва',
    iconSource: require('../../assets/img/coin.png'),
    pointer: { x: 0.5, y: 0.42 },
    arrowDir: 'down',
    dismissable: false,
  },
  collect_slot_2: {
    text: 'Збери виручку ще з одного поверху',
    iconSource: require('../../assets/img/coin.png'),
    pointer: { x: 0.5, y: 0.55 },
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_1: {
    text: 'Поповни запаси — виробництво не зупиняється',
    pointer: { x: 0.5, y: 0.42 },
    arrowDir: 'down',
    dismissable: false,
  },
  buy_goods_2: {
    text: 'Закупи ще одне виробництво',
    pointer: { x: 0.5, y: 0.55 },
    arrowDir: 'down',
    dismissable: false,
  },
  open_elevator_1: {
    text: 'Відкрий ліфт — там чекають відвідувачі',
    pointer: { x: 0.5, y: 0.85 },
    arrowDir: 'down',
    dismissable: false,
  },
  deliver_visitor: {
    text: 'Відвези гостя на потрібний поверх',
    pointer: { x: 0.5, y: 0.5 },
    arrowDir: 'up',
    dismissable: false,
  },
  open_elevator_2: {
    text: 'Новий робітник чекає — забери його',
    pointer: { x: 0.5, y: 0.85 },
    arrowDir: 'down',
    dismissable: false,
  },
  deliver_worker: {
    text: 'Відвези робітника та знайди йому роботу',
    pointer: { x: 0.5, y: 0.5 },
    arrowDir: 'up',
    dismissable: false,
  },
  assign_worker: {
    text: 'Щасливий робітник дає 2х виручку — стеж за його настроєм!',
    iconSource: require('../../assets/img/happySmile.png'),
    pointer: { x: 0.5, y: 0.5 },
    arrowDir: 'down',
    dismissable: false,
  },
  choose_floor_type: {
    text: 'Всі категорії рівні по виручці. Зелені — треба часто доглядати, червоні — рідше',
    pointer: { x: 0.5, y: 0.5 },
    arrowDir: 'down',
    dismissable: false,
  },
  speed_up_construction: {
    text: 'Пришвидш будівництво щоб не чекати',
    iconSource: require('../../assets/img/diamond.png'),
    pointer: { x: 0.5, y: 0.45 },
    arrowDir: 'down',
    dismissable: false,
  },
  construction_tip: {
    text: 'Будівельники їдуть ліфтом — доправ їх. Матеріали зі складу йдуть на будівництво',
    pointer: { x: 0.5, y: 0.5 },
    arrowDir: 'up',
    dismissable: true,
    dismissLabel: 'Зрозумів',
  },
  open_business: {
    text: 'Поповни ресурси і відкрий свій перший бізнес',
    pointer: { x: 0.5, y: 0.45 },
    arrowDir: 'down',
    dismissable: false,
  },
  final_message: {
    text: 'Шукай робітників мрії, вози відвідувачів у ліфті, розвивай вежу — і доберись до топу!',
    pointer: { x: 0.5, y: 0.5 },
    arrowDir: 'up',
    dismissable: true,
    dismissLabel: 'Погнали!',
  },
};
