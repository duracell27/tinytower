export type ToolKey   = 'briks' | 'glass' | 'nails' | 'screw' | 'wood' | 'cement';
export type TokenColor = 'green' | 'blue' | 'yellow' | 'purple' | 'red';

export interface ShopRewards {
  gems?:   number;
  tools?:  Partial<Record<ToolKey, number>>;
  tokens?: Partial<Record<TokenColor, number>>;
}

export interface ShopPack {
  id:          string;
  section:     'diamonds' | 'bundles' | 'builder' | 'materials';
  name:        string;
  price:       string;
  image:       ReturnType<typeof require>;
  imageBg?:    [string, string]; // gradient behind transparent icon
  bonusLabel?: string;
  badge?:      'best' | 'popular';
  rewards:     ShopRewards;
}

const ALL_TOOLS = (n: number): Partial<Record<ToolKey, number>> =>
  ({ briks: n, glass: n, nails: n, screw: n, wood: n, cement: n });

const ALL_TOKENS = (n: number): Partial<Record<TokenColor, number>> =>
  ({ green: n, blue: n, yellow: n, purple: n, red: n });

export const DIAMOND_PACKS: ShopPack[] = [
  {
    id: 'diamonds_1', section: 'diamonds', name: 'Handful', price: '$0.99',
    image: require('../../assets/img/shop/purchase1.png'),
    rewards: { gems: 200 },
  },
  {
    id: 'diamonds_2', section: 'diamonds', name: 'Pouch', price: '$1.99',
    image: require('../../assets/img/shop/purchase2.png'),
    bonusLabel: '+5%',
    rewards: { gems: 420 },
  },
  {
    id: 'diamonds_3', section: 'diamonds', name: 'Box', price: '$4.99',
    image: require('../../assets/img/shop/purchase3.png'),
    bonusLabel: '+10%',
    rewards: { gems: 1100 },
  },
  {
    id: 'diamonds_4', section: 'diamonds', name: 'Chest', price: '$9.99',
    image: require('../../assets/img/shop/purchase4.png'),
    bonusLabel: '+15%',
    badge: 'popular',
    rewards: { gems: 2300 },
  },
  {
    id: 'diamonds_5', section: 'diamonds', name: 'Vault', price: '$19.99',
    image: require('../../assets/img/shop/purchase5.png'),
    bonusLabel: '+20%',
    badge: 'best',
    rewards: { gems: 4800 },
  },
  {
    id: 'diamonds_6', section: 'diamonds', name: 'Treasure', price: '$49.99',
    image: require('../../assets/img/shop/purchase6.png'),
    bonusLabel: '+25%',
    rewards: { gems: 12500 },
  },
];

export const BUNDLE_PACKS: ShopPack[] = [
  {
    id: 'bundle_1', section: 'bundles', name: 'Starter Pack', price: '$1.99',
    image: require('../../assets/img/shop/bundleStarter.png'),
    imageBg: ['#E2F8EC', '#B8EDD4'],
    rewards: { gems: 150, tools: ALL_TOOLS(3), tokens: ALL_TOKENS(3) },
  },
  {
    id: 'bundle_2', section: 'bundles', name: 'Resource Bundle', price: '$4.99',
    image: require('../../assets/img/shop/bundleResources.png'),
    imageBg: ['#DFF0FF', '#B8D8FF'],
    rewards: { gems: 500, tools: ALL_TOOLS(8), tokens: ALL_TOKENS(8) },
  },
  {
    id: 'bundle_3', section: 'bundles', name: 'Growth Bundle', price: '$9.99',
    image: require('../../assets/img/shop/bundleGrowth.png'),
    imageBg: ['#FFF4CC', '#FFE566'],
    badge: 'popular',
    rewards: { gems: 1100, tools: ALL_TOOLS(15), tokens: ALL_TOKENS(20) },
  },
  {
    id: 'bundle_4', section: 'bundles', name: 'VIP Bundle', price: '$24.99',
    image: require('../../assets/img/shop/bundleVip.png'),
    imageBg: ['#EDE0FF', '#C9AAFF'],
    badge: 'best',
    rewards: { gems: 3000, tools: ALL_TOOLS(30), tokens: ALL_TOKENS(50) },
  },
];

export const BUILDER_PACKS: ShopPack[] = [
  {
    id: 'builder_1', section: 'builder', name: 'Mini Kit', price: '$1.99',
    image: require('../../assets/img/shop/builderMini.png'),
    imageBg: ['#FFF0E0', '#FFD8A8'],
    rewards: { gems: 100, tools: ALL_TOOLS(5) },
  },
  {
    id: 'builder_2', section: 'builder', name: 'Starter Builder', price: '$3.99',
    image: require('../../assets/img/shop/builderStarter.png'),
    imageBg: ['#F5F0E8', '#E8DCC8'],
    rewards: { gems: 250, tools: ALL_TOOLS(12) },
  },
  {
    id: 'builder_3', section: 'builder', name: 'Pro Builder', price: '$7.99',
    image: require('../../assets/img/shop/builderPro.png'),
    imageBg: ['#E8F6F0', '#B8E8D0'],
    badge: 'popular',
    rewards: { gems: 600, tools: ALL_TOOLS(25) },
  },
  {
    id: 'builder_4', section: 'builder', name: 'Master Builder', price: '$14.99',
    image: require('../../assets/img/shop/builderMaster.png'),
    imageBg: ['#FFF8E0', '#FFE080'],
    badge: 'best',
    rewards: { gems: 1200, tools: ALL_TOOLS(50) },
  },
];

export const MATERIAL_PACKS: ShopPack[] = [
  { id: 'mat_briks',  section: 'materials', name: 'Bricks',  price: '50',
    image: require('../../assets/img/tools/briks.png'),  rewards: { tools: { briks:  5 } } },
  { id: 'mat_glass',  section: 'materials', name: 'Glass',   price: '50',
    image: require('../../assets/img/tools/glass.png'),  rewards: { tools: { glass:  5 } } },
  { id: 'mat_nails',  section: 'materials', name: 'Nails',   price: '50',
    image: require('../../assets/img/tools/nails.png'),  rewards: { tools: { nails:  5 } } },
  { id: 'mat_screw',  section: 'materials', name: 'Screws',  price: '50',
    image: require('../../assets/img/tools/screw.png'),  rewards: { tools: { screw:  5 } } },
  { id: 'mat_wood',   section: 'materials', name: 'Wood',    price: '50',
    image: require('../../assets/img/tools/wood.png'),   rewards: { tools: { wood:   5 } } },
  { id: 'mat_cement', section: 'materials', name: 'Cement',  price: '50',
    image: require('../../assets/img/tools/cement.png'), rewards: { tools: { cement: 5 } } },
];
