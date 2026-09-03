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
    id: 'diamonds_1', section: 'diamonds', name: 'Handful', price: '$0.99',
    image: require('../../assets/img/shop/purchase1.png'),
    btnColor: '#C9637E',
    rewards: { gems: 200 },
  },
  {
    id: 'diamonds_2', section: 'diamonds', name: 'Pouch', price: '$1.99',
    image: require('../../assets/img/shop/purchase2.png'),
    bonusGems: 20,
    btnColor: '#5E8F42',
    rewards: { gems: 420 },
  },
  {
    id: 'diamonds_3', section: 'diamonds', name: 'Box', price: '$4.99',
    image: require('../../assets/img/shop/purchase3.png'),
    bonusGems: 100,
    btnColor: '#2E6EC9',
    rewards: { gems: 1100 },
  },
  {
    id: 'diamonds_4', section: 'diamonds', name: 'Chest', price: '$9.99',
    image: require('../../assets/img/shop/purchase4.png'),
    bonusGems: 300,
    badge: 'popular',
    btnColor: '#E7A52B', btnTextColor: '#FFF',
    rewards: { gems: 2300 },
  },
  {
    id: 'diamonds_5', section: 'diamonds', name: 'Vault', price: '$19.99',
    image: require('../../assets/img/shop/purchase5.png'),
    bonusGems: 800,
    badge: 'best',
    btnColor: '#9A6FD0',
    rewards: { gems: 4800 },
  },
  {
    id: 'diamonds_6', section: 'diamonds', name: 'Treasure', price: '$49.99',
    image: require('../../assets/img/shop/purchase6.png'),
    bonusGems: 2500,
    btnColor: '#E05050',
    rewards: { gems: 12500 },
  },
];

export const BUNDLE_PACKS: ShopPack[] = [
  {
    id: 'bundle_1', section: 'bundles', name: 'Starter Pack', price: '$1.99',
    image: require('../../assets/img/shop/bundleStarter.png'),
    imageBg:     ['#28D88A', '#12B06A'],
    imageBgDark: ['#0C4A2C', '#063018'],
    btnColor: '#0C8050',
    description: 'Perfect for new players — gems, tools & tokens to get you started',
    rewards: { gems: 150, tools: ALL_TOOLS(3), tokens: ALL_TOKENS(3) },
  },
  {
    id: 'bundle_2', section: 'bundles', name: 'Resource Bundle', price: '$4.99',
    image: require('../../assets/img/shop/bundleResources.png'),
    imageBg:     ['#38A8FF', '#1480E0'],
    imageBgDark: ['#0A2E60', '#061840'],
    btnColor: '#0A60B0',
    description: 'Stock up on everything you need to keep building fast',
    rewards: { gems: 500, tools: ALL_TOOLS(8), tokens: ALL_TOKENS(8) },
  },
  {
    id: 'bundle_3', section: 'bundles', name: 'Growth Bundle', price: '$9.99',
    image: require('../../assets/img/shop/bundleGrowth.png'),
    imageBg:     ['#FFD020', '#ECA000'],
    imageBgDark: ['#5C3400', '#3A1E00'],
    badge: 'popular',
    btnColor: '#A06000',
    description: 'Supercharge your tower with premium resources and extra gems',
    rewards: { gems: 1100, tools: ALL_TOOLS(15), tokens: ALL_TOKENS(20) },
  },
  {
    id: 'bundle_4', section: 'bundles', name: 'VIP Bundle', price: '$24.99',
    image: require('../../assets/img/shop/bundleVip.png'),
    imageBg:     ['#9B50F0', '#7028D0'],
    imageBgDark: ['#2E0E68', '#1A0840'],
    badge: 'best',
    btnColor: '#5018A0',
    description: 'The ultimate value pack — massive gems, full tool & token supply',
    rewards: { gems: 3000, tools: ALL_TOOLS(30), tokens: ALL_TOKENS(50) },
  },
];

export const BUILDER_PACKS: ShopPack[] = [
  {
    id: 'builder_1', section: 'builder', name: 'Mini Kit', price: '$1.99',
    image: require('../../assets/img/shop/builderMini.png'),
    imageBg:     ['#30C870', '#18A050'],
    imageBgDark: ['#0A3C20', '#052412'],
    btnColor: '#107838',
    description: 'A small starter kit with gems and all 6 materials to kick things off',
    rewards: { gems: 100, tools: ALL_TOOLS(5) },
  },
  {
    id: 'builder_2', section: 'builder', name: 'Starter Builder', price: '$3.99',
    image: require('../../assets/img/shop/builderStarter.png'),
    imageBg:     ['#3890E0', '#1060C0'],
    imageBgDark: ['#0A2848', '#06182C'],
    btnColor: '#0848A0',
    description: 'Enough supplies to push through the next few floors without stopping',
    rewards: { gems: 250, tools: ALL_TOOLS(12) },
  },
  {
    id: 'builder_3', section: 'builder', name: 'Pro Builder', price: '$7.99',
    image: require('../../assets/img/shop/builderPro.png'),
    imageBg:     ['#CC5090', '#AA2870'],
    imageBgDark: ['#4A0E2E', '#2C081A'],
    badge: 'popular',
    btnColor: '#881858',
    description: 'A serious supply drop — gems and materials to keep your tower rising fast',
    rewards: { gems: 600, tools: ALL_TOOLS(25) },
  },
  {
    id: 'builder_4', section: 'builder', name: 'Master Builder', price: '$14.99',
    image: require('../../assets/img/shop/builderMaster.png'),
    imageBg:     ['#7840C8', '#5018A8'],
    imageBgDark: ['#220850', '#120430'],
    badge: 'best',
    btnColor: '#380888',
    description: 'Maximum value — massive gem and material haul for elite builders',
    rewards: { gems: 1200, tools: ALL_TOOLS(50) },
  },
];

export const MATERIAL_PACKS: ShopPack[] = [
  { id: 'mat_briks',  section: 'materials', name: 'Bricks',  price: '$0.99',
    imageBg:     ['#FF5838', '#E03018'],
    imageBgDark: ['#580C06', '#380806'],
    btnColor: '#B01800',
    description: 'Solid red bricks for walls and foundations',
    image: require('../../assets/img/tools/briks.png'),  rewards: { tools: { briks:  5 } } },
  { id: 'mat_glass',  section: 'materials', name: 'Glass',   price: '$0.99',
    imageBg:     ['#18C8F0', '#00A0D0'],
    imageBgDark: ['#083C58', '#042438'],
    btnColor: '#007898',
    description: 'Crystal-clear glass panels for windows and facades',
    image: require('../../assets/img/tools/glass.png'),  rewards: { tools: { glass:  5 } } },
  { id: 'mat_nails',  section: 'materials', name: 'Nails',   price: '$0.99',
    imageBg:     ['#5878C8', '#3050A8'],
    imageBgDark: ['#142040', '#0C1428'],
    btnColor: '#1E3888',
    description: 'Heavy-duty nails to keep every joint tight',
    image: require('../../assets/img/tools/nails.png'),  rewards: { tools: { nails:  5 } } },
  { id: 'mat_screw',  section: 'materials', name: 'Screws',  price: '$0.99',
    imageBg:     ['#6878A8', '#485888'],
    imageBgDark: ['#182030', '#0E1420'],
    btnColor: '#2E3858',
    description: 'Precision screws for secure fixtures and fittings',
    image: require('../../assets/img/tools/screw.png'),  rewards: { tools: { screw:  5 } } },
  { id: 'mat_wood',   section: 'materials', name: 'Wood',    price: '$0.99',
    imageBg:     ['#F0A010', '#D07800'],
    imageBgDark: ['#4C2C00', '#301C00'],
    btnColor: '#A05800',
    description: 'Premium timber planks for floors and frames',
    image: require('../../assets/img/tools/wood.png'),   rewards: { tools: { wood:   5 } } },
  { id: 'mat_cement', section: 'materials', name: 'Cement',  price: '$0.99',
    imageBg:     ['#788870', '#586858'],
    imageBgDark: ['#182018', '#0E1410'],
    btnColor: '#384838',
    description: 'Fast-setting cement mix for slabs and structure',
    image: require('../../assets/img/tools/cement.png'), rewards: { tools: { cement: 5 } } },
];
