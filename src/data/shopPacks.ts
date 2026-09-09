export type ToolKey   = 'briks' | 'glass' | 'nails' | 'screw' | 'wood' | 'cement';
export type TokenColor = 'green' | 'blue' | 'yellow' | 'purple' | 'red';

export interface ShopRewards {
  gems?:   number;
  tools?:  Partial<Record<ToolKey, number>>;
  tokens?: Partial<Record<TokenColor, number>>;
}

export interface ShopPack {
  id:           string;
  section:      'diamonds' | 'bundles' | 'builder' | 'materials';
  name:         string;
  price:        string;
  image:        ReturnType<typeof require>;
  imageBg?:     [string, string];
  imageBgDark?: [string, string];
  btnColor?:    string;
  btnColorDark?: string;
  btnTextColor?: string;
  bonusGems?:   number;       // extra gems on top of base in diamond packs
  description?: string;       // tagline for bundle cards
  badge?:       'best' | 'popular';
  rewards:      ShopRewards;
}

const ALL_TOOLS = (n: number): Partial<Record<ToolKey, number>> =>
  ({ briks: n, glass: n, nails: n, screw: n, wood: n, cement: n });

const ALL_TOKENS = (n: number): Partial<Record<TokenColor, number>> =>
  ({ green: n, blue: n, yellow: n, purple: n, red: n });

export const DIAMOND_PACKS: ShopPack[] = [
  {
    id: 'diamonds_1', section: 'diamonds', name: 'shop.packs.diamonds_1.name', price: '$0.99',
    image: require('../../assets/img/shop/purchase1.png'),
    btnColor: '#C9637E',
    rewards: { gems: 200 },
  },
  {
    id: 'diamonds_2', section: 'diamonds', name: 'shop.packs.diamonds_2.name', price: '$1.99',
    image: require('../../assets/img/shop/purchase2.png'),
    bonusGems: 20,
    btnColor: '#5E8F42',
    rewards: { gems: 420 },
  },
  {
    id: 'diamonds_3', section: 'diamonds', name: 'shop.packs.diamonds_3.name', price: '$4.99',
    image: require('../../assets/img/shop/purchase3.png'),
    bonusGems: 100,
    btnColor: '#2E6EC9',
    rewards: { gems: 1100 },
  },
  {
    id: 'diamonds_4', section: 'diamonds', name: 'shop.packs.diamonds_4.name', price: '$9.99',
    image: require('../../assets/img/shop/purchase4.png'),
    bonusGems: 300,
    badge: 'popular',
    btnColor: '#E7A52B', btnTextColor: '#FFF',
    rewards: { gems: 2300 },
  },
  {
    id: 'diamonds_5', section: 'diamonds', name: 'shop.packs.diamonds_5.name', price: '$19.99',
    image: require('../../assets/img/shop/purchase5.png'),
    bonusGems: 800,
    badge: 'best',
    btnColor: '#9A6FD0',
    rewards: { gems: 4800 },
  },
  {
    id: 'diamonds_6', section: 'diamonds', name: 'shop.packs.diamonds_6.name', price: '$49.99',
    image: require('../../assets/img/shop/purchase6.png'),
    bonusGems: 2500,
    btnColor: '#E05050',
    rewards: { gems: 12500 },
  },
];

export const BUNDLE_PACKS: ShopPack[] = [
  {
    id: 'bundle_1', section: 'bundles', name: 'shop.packs.bundle_1.name', price: '$1.99',
    image: require('../../assets/img/shop/bundleStarter.png'),
    imageBg:     ['#28D88A', '#12B06A'],
    imageBgDark: ['#0C4A2C', '#063018'],
    btnColor: '#0C8050',
    description: 'shop.packs.bundle_1.description',
    rewards: { gems: 150, tools: ALL_TOOLS(3), tokens: ALL_TOKENS(3) },
  },
  {
    id: 'bundle_2', section: 'bundles', name: 'shop.packs.bundle_2.name', price: '$4.99',
    image: require('../../assets/img/shop/bundleResources.png'),
    imageBg:     ['#38A8FF', '#1480E0'],
    imageBgDark: ['#0A2E60', '#061840'],
    btnColor: '#0A60B0',
    description: 'shop.packs.bundle_2.description',
    rewards: { gems: 500, tools: ALL_TOOLS(8), tokens: ALL_TOKENS(8) },
  },
  {
    id: 'bundle_3', section: 'bundles', name: 'shop.packs.bundle_3.name', price: '$9.99',
    image: require('../../assets/img/shop/bundleGrowth.png'),
    imageBg:     ['#FFD020', '#ECA000'],
    imageBgDark: ['#5C3400', '#3A1E00'],
    badge: 'popular',
    btnColor: '#A06000',
    description: 'shop.packs.bundle_3.description',
    rewards: { gems: 1100, tools: ALL_TOOLS(15), tokens: ALL_TOKENS(20) },
  },
  {
    id: 'bundle_4', section: 'bundles', name: 'shop.packs.bundle_4.name', price: '$24.99',
    image: require('../../assets/img/shop/bundleVip.png'),
    imageBg:     ['#9B50F0', '#7028D0'],
    imageBgDark: ['#2E0E68', '#1A0840'],
    badge: 'best',
    btnColor: '#5018A0',
    description: 'shop.packs.bundle_4.description',
    rewards: { gems: 3000, tools: ALL_TOOLS(30), tokens: ALL_TOKENS(50) },
  },
];

export const BUILDER_PACKS: ShopPack[] = [
  {
    id: 'builder_1', section: 'builder', name: 'shop.packs.builder_1.name', price: '$1.99',
    image: require('../../assets/img/shop/builderMini.png'),
    imageBg:     ['#30C870', '#18A050'],
    imageBgDark: ['#0A3C20', '#052412'],
    btnColor: '#107838',
    description: 'shop.packs.builder_1.description',
    rewards: { gems: 100, tools: ALL_TOOLS(5) },
  },
  {
    id: 'builder_2', section: 'builder', name: 'shop.packs.builder_2.name', price: '$3.99',
    image: require('../../assets/img/shop/builderStarter.png'),
    imageBg:     ['#3890E0', '#1060C0'],
    imageBgDark: ['#0A2848', '#06182C'],
    btnColor: '#0848A0',
    description: 'shop.packs.builder_2.description',
    rewards: { gems: 250, tools: ALL_TOOLS(12) },
  },
  {
    id: 'builder_3', section: 'builder', name: 'shop.packs.builder_3.name', price: '$7.99',
    image: require('../../assets/img/shop/builderPro.png'),
    imageBg:     ['#CC5090', '#AA2870'],
    imageBgDark: ['#4A0E2E', '#2C081A'],
    badge: 'popular',
    btnColor: '#881858',
    description: 'shop.packs.builder_3.description',
    rewards: { gems: 600, tools: ALL_TOOLS(25) },
  },
  {
    id: 'builder_4', section: 'builder', name: 'shop.packs.builder_4.name', price: '$14.99',
    image: require('../../assets/img/shop/builderMaster.png'),
    imageBg:     ['#7840C8', '#5018A8'],
    imageBgDark: ['#220850', '#120430'],
    badge: 'best',
    btnColor: '#380888',
    description: 'shop.packs.builder_4.description',
    rewards: { gems: 1200, tools: ALL_TOOLS(50) },
  },
];

export const MATERIAL_PACKS: ShopPack[] = [
  { id: 'mat_briks',  section: 'materials', name: 'shop.packs.mat_briks.name',  price: '$0.99',
    imageBg:     ['#FF5838', '#E03018'],
    imageBgDark: ['#580C06', '#380806'],
    btnColor: '#B01800',
    description: 'shop.packs.mat_briks.description',
    image: require('../../assets/img/tools/briks.png'),  rewards: { tools: { briks:  5 } } },
  { id: 'mat_glass',  section: 'materials', name: 'shop.packs.mat_glass.name',  price: '$0.99',
    imageBg:     ['#18C8F0', '#00A0D0'],
    imageBgDark: ['#083C58', '#042438'],
    btnColor: '#007898',
    description: 'shop.packs.mat_glass.description',
    image: require('../../assets/img/tools/glass.png'),  rewards: { tools: { glass:  5 } } },
  { id: 'mat_nails',  section: 'materials', name: 'shop.packs.mat_nails.name',  price: '$0.99',
    imageBg:     ['#5878C8', '#3050A8'],
    imageBgDark: ['#142040', '#0C1428'],
    btnColor: '#1E3888',
    description: 'shop.packs.mat_nails.description',
    image: require('../../assets/img/tools/nails.png'),  rewards: { tools: { nails:  5 } } },
  { id: 'mat_screw',  section: 'materials', name: 'shop.packs.mat_screw.name',  price: '$0.99',
    imageBg:     ['#6878A8', '#485888'],
    imageBgDark: ['#182030', '#0E1420'],
    btnColor: '#2E3858',
    description: 'shop.packs.mat_screw.description',
    image: require('../../assets/img/tools/screw.png'),  rewards: { tools: { screw:  5 } } },
  { id: 'mat_wood',   section: 'materials', name: 'shop.packs.mat_wood.name',   price: '$0.99',
    imageBg:     ['#F0A010', '#D07800'],
    imageBgDark: ['#4C2C00', '#301C00'],
    btnColor: '#A05800',
    description: 'shop.packs.mat_wood.description',
    image: require('../../assets/img/tools/wood.png'),   rewards: { tools: { wood:   5 } } },
  { id: 'mat_cement', section: 'materials', name: 'shop.packs.mat_cement.name', price: '$0.99',
    imageBg:     ['#788870', '#586858'],
    imageBgDark: ['#182018', '#0E1410'],
    btnColor: '#384838',
    description: 'shop.packs.mat_cement.description',
    image: require('../../assets/img/tools/cement.png'), rewards: { tools: { cement: 5 } } },
];
