import { GameConfigSchema } from '../schemas/gameConfig';
import type { GameConfig, GameState, Floor, Worker } from '../types';
import { generateRandomWorkers, HAIR_COLORS, WORKER_NAME_POOLS } from './workerNames';
import { generateVisitorAppearance } from '../engine/lobbyUtils';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function makeStartingWorker(
  floorType: string,
  dreamJob: string,
  assignedFloorId: number,
  assignedSlotIdx: number,
): Worker {
  const female = Math.random() < 0.5;
  const pool = female ? WORKER_NAME_POOLS.en.female : WORKER_NAME_POOLS.en.male;
  return {
    id: uuidv4(),
    name: pool[Math.floor(Math.random() * pool.length)],
    female,
    floorType,
    dreamJob,
    level: 1 + Math.floor(Math.random() * 9),
    hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
    assignedFloorId,
    assignedSlotIdx,
    isSpecialist: false,
  };
}

const rawConfig = {
  floorTypes: {
    green: {
      shirtColor: '#49AA38', accent: '#20810F',
      businesses: [
        { name: 'Confectionery',    dreamJobs: ['buns', 'pastries', 'cakes'] },
        { name: 'Burger Joint',     dreamJobs: ['burgers', 'fries', 'drinks'] },
        { name: 'Cheese Dairy',     dreamJobs: ['milk', 'cheese', 'yogurt'] },
        { name: 'Farm Market',      dreamJobs: ['greens', 'tomatoes', 'fruits'] },
        { name: 'Spice Shop',       dreamJobs: ['salt', 'pepper', 'cinnamon'] },
        { name: 'Seafood Market',   dreamJobs: ['shrimp', 'salmon', 'caviar'] },
        { name: 'Honey Farm',       dreamJobs: ['honeycomb', 'honey', 'royal_jelly'] },
        { name: 'Chocolate Factory',dreamJobs: ['cocoa', 'chocolate_bars', 'truffles'] },
        { name: 'Grocery',          dreamJobs: ['sugar', 'spaghetti', 'cereal'] },
        { name: 'Ice Cream Parlor', dreamJobs: ['popsicles', 'sundaes', 'gelato'] },
        { name: 'Juice Factory',    dreamJobs: ['lemonade', 'apple_juice', 'smoothies'] },
        { name: 'Winery',           dreamJobs: ['grapes', 'table_wine', 'vintage_wine'] },
      ],
    },
    blue: {
      shirtColor: '#3376E5', accent: '#0A4DBC',
      businesses: [
        { name: 'Banking',           dreamJobs: ['cards', 'loans', 'accounts'] },
        { name: 'Rental',            dreamJobs: ['scooters', 'consoles', 'tools'] },
        { name: 'Dental Clinic',     dreamJobs: ['fillings', 'cleaning', 'braces'] },
        { name: 'Post Office',       dreamJobs: ['stamps', 'parcels', 'express_delivery'] },
        { name: 'Photo Studio',      dreamJobs: ['passport_photos', 'portraits', 'wedding_shoots'] },
        { name: 'IT Studio',         dreamJobs: ['websites', 'apps', 'design'] },
        { name: 'Car Wash',          dreamJobs: ['exterior_wash', 'interior_cleaning', 'polishing'] },
        { name: 'Copy Center',       dreamJobs: ['scanning', 'printing', 'copying'] },
        { name: 'Veterinary Clinic', dreamJobs: ['checkups', 'vaccinations', 'surgeries'] },
        { name: 'Gym',               dreamJobs: ['day_passes', 'personal_training', 'memberships'] },
        { name: 'Beauty Salon',      dreamJobs: ['manicures', 'facials', 'makeup'] },
        { name: 'Insurance Agency',  dreamJobs: ['travel_insurance', 'car_insurance', 'life_insurance'] },
      ],
    },
    yellow: {
      shirtColor: '#E5A72E', accent: '#BC7E05',
      businesses: [
        { name: 'Exhibition',    dreamJobs: ['paintings', 'sculptures', 'gallery'] },
        { name: 'Karting',       dreamJobs: ['karts', 'helmets', 'track'] },
        { name: 'Lounge',        dreamJobs: ['cocktails', 'hookahs', 'pizza'] },
        { name: 'Cinema',        dreamJobs: ['tickets', 'popcorn', 'cola'] },
        { name: 'Bowling Club',  dreamJobs: ['bowling_shoes', 'bowling_balls', 'tournaments'] },
        { name: 'Water Park',    dreamJobs: ['inflatable_rings', 'water_slides', 'cabanas'] },
        { name: 'Pizzeria',      dreamJobs: ['pepperoni', 'margherita', 'four_cheese'] },
        { name: 'Arcade',        dreamJobs: ['tokens', 'air_hockey', 'racing_simulators'] },
        { name: 'Concert Hall',  dreamJobs: ['posters', 'front_row_seats', 'backstage_passes'] },
        { name: 'Amusement Park',dreamJobs: ['carousels', 'ferris_wheel', 'roller_coasters'] },
        { name: 'Casino',        dreamJobs: ['slot_machines', 'roulette', 'poker_tables'] },
        { name: 'Theater',       dreamJobs: ['playbills', 'evening_shows', 'private_boxes'] },
      ],
    },
    purple: {
      shirtColor: '#9A6FD0', accent: '#7B52BC',
      businesses: [
        { name: 'Sneaker Store',  dreamJobs: ['canvas_shoes', 'sneakers', 'custom_sneakers'] },
        { name: 'Clothing Store', dreamJobs: ['tshirts', 'pants', 'jackets'] },
        { name: 'Merch Shop',     dreamJobs: ['hoodies', 'sweatshirts', 'caps'] },
        { name: 'Accessories',    dreamJobs: ['belts', 'scarves', 'handbags'] },
        { name: 'Pajamas',        dreamJobs: ['robes', 'kigurumi', 'socks'] },
        { name: 'Formal Wear',    dreamJobs: ['bow_ties', 'suits', 'evening_gowns'] },
        { name: 'Sportswear',     dreamJobs: ['leggings', 'tracksuits', 'running_shoes'] },
        { name: 'Outerwear',      dreamJobs: ['vests', 'raincoats', 'fur_coats'] },
        { name: 'Bridal Salon',   dreamJobs: ['veils', 'tuxedos', 'bridal_gowns'] },
        { name: 'Jeans Shop',     dreamJobs: ['denim_shorts', 'jeans', 'denim_jackets'] },
        { name: 'Jewelry',        dreamJobs: ['rings', 'necklaces', 'diamonds'] },
        { name: 'Perfumery',      dreamJobs: ['body_sprays', 'perfumes', 'luxury_fragrances'] },
      ],
    },
    red: {
      shirtColor: '#E05A4A', accent: '#C0372A',
      businesses: [
        { name: 'Smartphones',  dreamJobs: ['phones', 'cases', 'screen_protectors'] },
        { name: 'Computers',    dreamJobs: ['pcs', 'laptops', 'monitors'] },
        { name: 'Robotics',     dreamJobs: ['robots', 'drones', 'spare_parts'] },
        { name: 'Gaming Gear',  dreamJobs: ['gamepads', 'keyboards', 'gaming_chairs'] },
        { name: 'Watches',      dreamJobs: ['smartwatches', 'fitness_bands', 'straps'] },
        { name: 'Camera Store', dreamJobs: ['tripods', 'cameras', 'lenses'] },
        { name: 'Network Store',dreamJobs: ['cable', 'twisted_pair', 'optical_fiber'] },
        { name: 'Smart Home',   dreamJobs: ['smart_bulbs', 'smart_locks', 'home_assistants'] },
        { name: 'Data Center',  dreamJobs: ['hard_drives', 'servers', 'supercomputers'] },
        { name: 'TV Store',     dreamJobs: ['led_tvs', 'oled_tvs', 'home_theaters'] },
        { name: 'Audio Store',  dreamJobs: ['earbuds', 'headphones', 'speakers'] },
        { name: 'Space Tech',   dreamJobs: ['telescopes', 'satellites', 'rockets'] },
      ],
    },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['buns', 'pastries', 'cakes'] },
    { id: 3, slots: 3, floorType: 'blue',  availableTypes: ['cards', 'loans', 'accounts'] },
  ],
  productionTypes: {
    // Green / Products — Confectionery (tier 1)
    buns:     { buyCost: 10,   deliveryDuration:   105_000, sellDuration:   300_000, batchValue: 16 },
    pastries: { buyCost: 15,   deliveryDuration:   180_000, sellDuration:   720_000, batchValue: 63 },
    cakes:    { buyCost: 20,   deliveryDuration:   600_000, sellDuration: 1_440_000, batchValue: 318 },
    // Green / Products — Burger Joint (tier 2)
    burgers:  { buyCost: 30,   deliveryDuration:   180_000, sellDuration:   360_000, batchValue: 48 },
    fries:    { buyCost: 100,  deliveryDuration:   600_000, sellDuration: 1_200_000, batchValue: 211 },
    drinks:   { buyCost: 400,  deliveryDuration: 1_800_000, sellDuration: 3_600_000, batchValue: 957 },
    // Green / Products — Cheese Dairy (tier 3)
    milk:     { buyCost: 50,   deliveryDuration:   300_000, sellDuration:   600_000, batchValue: 80 },
    cheese:   { buyCost: 255,  deliveryDuration:   960_000, sellDuration: 1_920_000, batchValue: 338 },
    yogurt:   { buyCost: 1450, deliveryDuration: 3_000_000, sellDuration: 6_000_000, batchValue: 1595 },
    // Blue / Service — Banking (tier 1)
    cards:    { buyCost: 20,   deliveryDuration:   120_000, sellDuration:   480_000, batchValue: 32 },
    loans:    { buyCost: 25,   deliveryDuration:   300_000, sellDuration: 1_200_000, batchValue: 106 },
    accounts: { buyCost: 30,   deliveryDuration:   900_000, sellDuration: 1_800_000, batchValue: 479 },
    // Blue / Service — Rental (tier 2)
    scooters: { buyCost: 40,   deliveryDuration:   300_000, sellDuration: 1_200_000, batchValue: 80 },
    consoles: { buyCost: 150,  deliveryDuration:   900_000, sellDuration: 3_600_000, batchValue: 317 },
    tools:    { buyCost: 800,  deliveryDuration: 3_000_000, sellDuration: 6_000_000, batchValue: 1595 },
    // Blue / Service — Dental Clinic (tier 3)
    fillings: { buyCost: 80,   deliveryDuration:   480_000, sellDuration: 1_920_000, batchValue: 128 },
    cleaning: { buyCost: 400,  deliveryDuration: 1_500_000, sellDuration: 3_600_000, batchValue: 527 },
    braces:   { buyCost: 1740, deliveryDuration: 3_600_000, sellDuration: 7_200_000, batchValue: 1914 },
    // Yellow / Rest — Exhibition (tier 1)
    paintings:   { buyCost: 30,   deliveryDuration:   180_000, sellDuration:   720_000, batchValue: 48 },
    sculptures:  { buyCost: 40,   deliveryDuration:   420_000, sellDuration:   840_000, batchValue: 148 },
    gallery:     { buyCost: 50,   deliveryDuration: 1_200_000, sellDuration: 2_400_000, batchValue: 638 },
    // Yellow / Rest — Karting (tier 2)
    karts:    { buyCost: 60,   deliveryDuration:   360_000, sellDuration:   864_000, batchValue: 95 },
    helmets:  { buyCost: 120,  deliveryDuration: 1_080_000, sellDuration: 2_160_000, batchValue: 380 },
    track:    { buyCost: 900,  deliveryDuration: 3_000_000, sellDuration: 6_000_000, batchValue: 1595 },
    // Yellow / Rest — Lounge (tier 3)
    cocktails: { buyCost: 100,  deliveryDuration:   600_000, sellDuration: 2_400_000, batchValue: 160 },
    hookahs:   { buyCost: 480,  deliveryDuration: 1_800_000, sellDuration: 3_600_000, batchValue: 634 },
    pizza:     { buyCost: 2320, deliveryDuration: 4_800_000, sellDuration: 9_600_000, batchValue: 2552 },
    // Purple / Fashion — Sneaker Store (tier 1)
    canvas_shoes:    { buyCost: 40,   deliveryDuration:   300_000, sellDuration:  1_200_000, batchValue: 80 },
    sneakers:        { buyCost: 50,   deliveryDuration:   600_000, sellDuration:  1_200_000, batchValue: 211 },
    custom_sneakers: { buyCost: 60,   deliveryDuration: 1_800_000, sellDuration:  3_600_000, batchValue: 957 },
    // Purple / Fashion — Clothing Store (tier 2)
    tshirts:  { buyCost: 70,   deliveryDuration:   420_000, sellDuration:  1_008_000, batchValue: 111 },
    pants:    { buyCost: 300,  deliveryDuration: 1_200_000, sellDuration:  2_400_000, batchValue: 422 },
    jackets:  { buyCost: 1000, deliveryDuration: 3_600_000, sellDuration:  7_200_000, batchValue: 1914 },
    // Purple / Fashion — Merch Shop (tier 3)
    hoodies:     { buyCost: 120,  deliveryDuration:   720_000, sellDuration:  2_880_000, batchValue: 192 },
    sweatshirts: { buyCost: 640,  deliveryDuration: 2_400_000, sellDuration:  5_760_000, batchValue: 845 },
    caps:        { buyCost: 3190, deliveryDuration: 6_600_000, sellDuration: 13_200_000, batchValue: 3509 },
    // Red / Electronics — Smartphones (tier 1)
    phones:           { buyCost: 60,   deliveryDuration:   420_000, sellDuration:  1_680_000, batchValue: 112 },
    cases:            { buyCost: 70,   deliveryDuration: 1_200_000, sellDuration:  2_400_000, batchValue: 422 },
    screen_protectors:{ buyCost: 80,   deliveryDuration: 3_600_000, sellDuration:  7_200_000, batchValue: 1914 },
    // Red / Electronics — Computers (tier 2)
    pcs:      { buyCost: 100,  deliveryDuration:   900_000, sellDuration:  2_160_000, batchValue: 240 },
    laptops:  { buyCost: 400,  deliveryDuration: 2_700_000, sellDuration:  6_480_000, batchValue: 950 },
    monitors: { buyCost: 1500, deliveryDuration: 7_200_000, sellDuration: 17_280_000, batchValue: 3827 },
    // Red / Electronics — Robotics (tier 3)
    robots:      { buyCost: 200,  deliveryDuration:  1_200_000, sellDuration:  4_800_000, batchValue: 320 },
    drones:      { buyCost: 960,  deliveryDuration:  3_600_000, sellDuration:  8_640_000, batchValue: 1266 },
    spare_parts: { buyCost: 5220, deliveryDuration: 10_800_000, sellDuration: 25_920_000, batchValue: 5741 },

    // Green / Products — Farm Market (tier 4)
    greens:   { buyCost: 70,   deliveryDuration:   420_000, sellDuration: 1_008_000, batchValue: 111 },
    tomatoes: { buyCost: 352,  deliveryDuration: 1_320_000, sellDuration: 2_640_000, batchValue: 465 },
    fruits:   { buyCost: 1740, deliveryDuration: 3_600_000, sellDuration: 7_200_000, batchValue: 1914 },
    // Green / Products — Spice Shop (tier 5)
    salt:     { buyCost: 90,   deliveryDuration:   540_000, sellDuration: 1_296_000, batchValue: 143 },
    pepper:   { buyCost: 432,  deliveryDuration: 1_620_000, sellDuration: 3_240_000, batchValue: 570 },
    cinnamon: { buyCost: 2320, deliveryDuration: 4_800_000, sellDuration: 9_600_000, batchValue: 2552 },
    // Green / Products — Seafood Market (tier 6)
    shrimp: { buyCost: 100,  deliveryDuration:   600_000, sellDuration:  1_440_000, batchValue: 160 },
    salmon: { buyCost: 480,  deliveryDuration: 1_800_000, sellDuration:  3_600_000, batchValue: 634 },
    caviar: { buyCost: 2610, deliveryDuration: 5_400_000, sellDuration: 10_800_000, batchValue: 2871 },
    // Green / Products — Honey Farm (tier 7)
    honeycomb:  { buyCost: 110,  deliveryDuration:   660_000, sellDuration:  1_584_000, batchValue: 176 },
    honey:      { buyCost: 544,  deliveryDuration: 2_040_000, sellDuration:  4_080_000, batchValue: 718 },
    royal_jelly:{ buyCost: 2900, deliveryDuration: 6_000_000, sellDuration: 12_000_000, batchValue: 3190 },
    // Green / Products — Chocolate Factory (tier 8)
    cocoa:          { buyCost: 120,  deliveryDuration:   720_000, sellDuration:  1_728_000, batchValue: 192 },
    chocolate_bars: { buyCost: 608,  deliveryDuration: 2_280_000, sellDuration:  4_560_000, batchValue: 803 },
    truffles:       { buyCost: 3190, deliveryDuration: 6_600_000, sellDuration: 13_200_000, batchValue: 3509 },
    // Green / Products — Grocery (tier 9)
    sugar:     { buyCost: 140,  deliveryDuration:   840_000, sellDuration:  2_016_000, batchValue: 223 },
    spaghetti: { buyCost: 672,  deliveryDuration: 2_520_000, sellDuration:  6_000_000, batchValue: 886 },
    cereal:    { buyCost: 3480, deliveryDuration: 7_200_000, sellDuration: 14_400_000, batchValue: 3828 },
    // Green / Products — Ice Cream Parlor (tier 10)
    popsicles: { buyCost: 150,  deliveryDuration:   900_000, sellDuration:  2_160_000, batchValue: 240 },
    sundaes:   { buyCost: 736,  deliveryDuration: 2_760_000, sellDuration:  5_520_000, batchValue: 972 },
    gelato:    { buyCost: 3770, deliveryDuration: 7_800_000, sellDuration: 15_600_000, batchValue: 4147 },
    // Green / Products — Juice Factory (tier 11)
    lemonade:   { buyCost: 160,  deliveryDuration:   960_000, sellDuration:  2_304_000, batchValue: 256 },
    apple_juice:{ buyCost: 800,  deliveryDuration: 3_000_000, sellDuration:  6_000_000, batchValue: 1056 },
    smoothies:  { buyCost: 4060, deliveryDuration: 8_400_000, sellDuration: 16_800_000, batchValue: 4466 },
    // Green / Products — Winery (tier 12)
    grapes:       { buyCost: 170,  deliveryDuration: 1_020_000, sellDuration:  2_448_000, batchValue: 272 },
    table_wine:   { buyCost: 864,  deliveryDuration: 3_240_000, sellDuration:  6_480_000, batchValue: 1140 },
    vintage_wine: { buyCost: 4350, deliveryDuration: 9_000_000, sellDuration: 18_000_000, batchValue: 4785 },

    // Blue / Service — Post Office (tier 4)
    stamps:          { buyCost: 100,  deliveryDuration:   600_000, sellDuration:  2_400_000, batchValue: 160 },
    parcels:         { buyCost: 480,  deliveryDuration: 1_800_000, sellDuration:  4_320_000, batchValue: 634 },
    express_delivery:{ buyCost: 2320, deliveryDuration: 4_800_000, sellDuration:  9_600_000, batchValue: 2552 },
    // Blue / Service — Photo Studio (tier 5)
    passport_photos:{ buyCost: 120,  deliveryDuration:   720_000, sellDuration:  2_880_000, batchValue: 192 },
    portraits:      { buyCost: 560,  deliveryDuration: 2_100_000, sellDuration:  5_040_000, batchValue: 739 },
    wedding_shoots: { buyCost: 2900, deliveryDuration: 6_000_000, sellDuration: 12_000_000, batchValue: 3190 },
    // Blue / Service — IT Studio (tier 6)
    websites: { buyCost: 150,  deliveryDuration:   900_000, sellDuration:  3_600_000, batchValue: 240 },
    apps:     { buyCost: 640,  deliveryDuration: 2_400_000, sellDuration:  5_760_000, batchValue: 845 },
    design:   { buyCost: 3480, deliveryDuration: 7_200_000, sellDuration: 14_400_000, batchValue: 3828 },
    // Blue / Service — Car Wash (tier 7)
    exterior_wash:    { buyCost: 160,  deliveryDuration:   960_000, sellDuration:  2_304_000, batchValue: 256 },
    interior_cleaning:{ buyCost: 720,  deliveryDuration: 2_700_000, sellDuration:  6_480_000, batchValue: 950 },
    polishing:        { buyCost: 4060, deliveryDuration: 8_400_000, sellDuration: 16_800_000, batchValue: 4466 },
    // Blue / Service — Copy Center (tier 8)
    scanning: { buyCost: 170,  deliveryDuration: 1_020_000, sellDuration:  2_448_000, batchValue: 271 },
    printing: { buyCost: 800,  deliveryDuration: 3_000_000, sellDuration:  6_000_000, batchValue: 1056 },
    copying:  { buyCost: 4350, deliveryDuration: 9_000_000, sellDuration: 18_000_000, batchValue: 4785 },
    // Blue / Service — Veterinary Clinic (tier 9)
    checkups:     { buyCost: 180,  deliveryDuration: 1_080_000, sellDuration:  2_592_000, batchValue: 288 },
    vaccinations: { buyCost: 880,  deliveryDuration: 3_300_000, sellDuration:  6_600_000, batchValue: 1162 },
    surgeries:    { buyCost: 4640, deliveryDuration: 9_600_000, sellDuration: 19_200_000, batchValue: 5104 },
    // Blue / Service — Gym (tier 10)
    day_passes:       { buyCost: 190,  deliveryDuration:  1_140_000, sellDuration:  2_736_000, batchValue: 304 },
    personal_training:{ buyCost: 960,  deliveryDuration:  3_600_000, sellDuration:  7_200_000, batchValue: 1267 },
    memberships:      { buyCost: 4930, deliveryDuration: 10_200_000, sellDuration: 20_400_000, batchValue: 5423 },
    // Blue / Service — Beauty Salon (tier 11)
    manicures: { buyCost: 200,  deliveryDuration:  1_200_000, sellDuration:  2_880_000, batchValue: 320 },
    facials:   { buyCost: 1040, deliveryDuration:  3_900_000, sellDuration:  7_800_000, batchValue: 1373 },
    makeup:    { buyCost: 5220, deliveryDuration: 10_800_000, sellDuration: 21_600_000, batchValue: 5742 },
    // Blue / Service — Insurance Agency (tier 12)
    travel_insurance:{ buyCost: 210,  deliveryDuration:  1_260_000, sellDuration:  3_024_000, batchValue: 336 },
    car_insurance:   { buyCost: 1120, deliveryDuration:  4_200_000, sellDuration:  8_400_000, batchValue: 1478 },
    life_insurance:  { buyCost: 5510, deliveryDuration: 11_400_000, sellDuration: 22_800_000, batchValue: 6061 },

    // Yellow / Rest — Cinema (tier 4)
    tickets: { buyCost: 120,  deliveryDuration:   720_000, sellDuration:  1_728_000, batchValue: 191 },
    popcorn: { buyCost: 576,  deliveryDuration: 2_160_000, sellDuration:  5_160_000, batchValue: 760 },
    cola:    { buyCost: 3190, deliveryDuration: 6_600_000, sellDuration: 13_200_000, batchValue: 3509 },
    // Yellow / Rest — Bowling Club (tier 5)
    bowling_shoes: { buyCost: 150,  deliveryDuration:   900_000, sellDuration:  2_160_000, batchValue: 240 },
    bowling_balls: { buyCost: 704,  deliveryDuration: 2_640_000, sellDuration:  5_280_000, batchValue: 929 },
    tournaments:   { buyCost: 3770, deliveryDuration: 7_800_000, sellDuration: 15_600_000, batchValue: 4147 },
    // Yellow / Rest — Water Park (tier 6)
    inflatable_rings:{ buyCost: 170,  deliveryDuration: 1_020_000, sellDuration:  2_448_000, batchValue: 272 },
    water_slides:    { buyCost: 832,  deliveryDuration: 3_120_000, sellDuration:  6_240_000, batchValue: 1098 },
    cabanas:         { buyCost: 4350, deliveryDuration: 9_000_000, sellDuration: 18_000_000, batchValue: 4785 },
    // Yellow / Rest — Pizzeria (tier 7)
    pepperoni:  { buyCost: 200,  deliveryDuration:  1_200_000, sellDuration:  2_880_000, batchValue: 320 },
    margherita: { buyCost: 960,  deliveryDuration:  3_600_000, sellDuration:  7_200_000, batchValue: 1267 },
    four_cheese:{ buyCost: 4930, deliveryDuration: 10_200_000, sellDuration: 20_400_000, batchValue: 5423 },
    // Yellow / Rest — Arcade (tier 8)
    tokens:           { buyCost: 220,  deliveryDuration:  1_320_000, sellDuration:  3_168_000, batchValue: 352 },
    air_hockey:       { buyCost: 1088, deliveryDuration:  4_080_000, sellDuration:  8_160_000, batchValue: 1436 },
    racing_simulators:{ buyCost: 5510, deliveryDuration: 11_400_000, sellDuration: 22_800_000, batchValue: 6061 },
    // Yellow / Rest — Concert Hall (tier 9)
    posters:         { buyCost: 240,  deliveryDuration:  1_440_000, sellDuration:  3_456_000, batchValue: 384 },
    front_row_seats: { buyCost: 1216, deliveryDuration:  4_560_000, sellDuration:  9_120_000, batchValue: 1605 },
    backstage_passes:{ buyCost: 6090, deliveryDuration: 12_600_000, sellDuration: 25_200_000, batchValue: 6699 },
    // Yellow / Rest — Amusement Park (tier 10)
    carousels:      { buyCost: 260,  deliveryDuration:  1_560_000, sellDuration:  3_744_000, batchValue: 416 },
    ferris_wheel:   { buyCost: 1344, deliveryDuration:  5_040_000, sellDuration: 10_080_000, batchValue: 1774 },
    roller_coasters:{ buyCost: 6670, deliveryDuration: 13_800_000, sellDuration: 27_600_000, batchValue: 7337 },
    // Yellow / Rest — Casino (tier 11)
    slot_machines:{ buyCost: 280,  deliveryDuration:  1_680_000, sellDuration:  4_032_000, batchValue: 448 },
    roulette:     { buyCost: 1472, deliveryDuration:  5_520_000, sellDuration: 11_040_000, batchValue: 1943 },
    poker_tables: { buyCost: 7250, deliveryDuration: 15_000_000, sellDuration: 30_000_000, batchValue: 7975 },
    // Yellow / Rest — Theater (tier 12)
    playbills:    { buyCost: 300,  deliveryDuration:  1_800_000, sellDuration:  4_320_000, batchValue: 480 },
    evening_shows:{ buyCost: 1600, deliveryDuration:  6_000_000, sellDuration: 12_000_000, batchValue: 2112 },
    private_boxes:{ buyCost: 7830, deliveryDuration: 16_200_000, sellDuration: 32_400_000, batchValue: 8613 },

    // Purple / Fashion — Accessories (tier 4)
    belts:   { buyCost: 160,  deliveryDuration:   960_000, sellDuration:  2_304_000, batchValue: 256 },
    scarves: { buyCost: 800,  deliveryDuration: 3_000_000, sellDuration:  6_000_000, batchValue: 1056 },
    handbags:{ buyCost: 4350, deliveryDuration: 9_000_000, sellDuration: 18_000_000, batchValue: 4785 },
    // Purple / Fashion — Pajamas (tier 5)
    robes:   { buyCost: 200,  deliveryDuration:  1_200_000, sellDuration:  2_880_000, batchValue: 320 },
    kigurumi:{ buyCost: 960,  deliveryDuration:  3_600_000, sellDuration:  7_200_000, batchValue: 1267 },
    socks:   { buyCost: 5220, deliveryDuration: 10_800_000, sellDuration: 21_600_000, batchValue: 5742 },
    // Purple / Fashion — Formal Wear (tier 6)
    bow_ties:    { buyCost: 240,  deliveryDuration:  1_440_000, sellDuration:  3_456_000, batchValue: 384 },
    suits:       { buyCost: 1120, deliveryDuration:  4_200_000, sellDuration:  8_400_000, batchValue: 1478 },
    evening_gowns:{ buyCost: 6090, deliveryDuration: 12_600_000, sellDuration: 25_200_000, batchValue: 6699 },
    // Purple / Fashion — Sportswear (tier 7)
    leggings:    { buyCost: 280,  deliveryDuration:  1_680_000, sellDuration:  4_032_000, batchValue: 448 },
    tracksuits:  { buyCost: 1280, deliveryDuration:  4_800_000, sellDuration:  9_600_000, batchValue: 1690 },
    running_shoes:{ buyCost: 6960, deliveryDuration: 14_400_000, sellDuration: 28_800_000, batchValue: 7656 },
    // Purple / Fashion — Outerwear (tier 8)
    vests:    { buyCost: 320,  deliveryDuration:  1_920_000, sellDuration:  4_608_000, batchValue: 512 },
    raincoats:{ buyCost: 1440, deliveryDuration:  5_400_000, sellDuration: 10_800_000, batchValue: 1901 },
    fur_coats:{ buyCost: 7830, deliveryDuration: 16_200_000, sellDuration: 32_400_000, batchValue: 8613 },
    // Purple / Fashion — Bridal Salon (tier 9)
    veils:       { buyCost: 360,  deliveryDuration:  2_160_000, sellDuration:  5_184_000, batchValue: 576 },
    tuxedos:     { buyCost: 1600, deliveryDuration:  6_000_000, sellDuration: 12_000_000, batchValue: 2112 },
    bridal_gowns:{ buyCost: 8700, deliveryDuration: 18_000_000, sellDuration: 36_000_000, batchValue: 9570 },
    // Purple / Fashion — Jeans Shop (tier 10)
    denim_shorts: { buyCost: 400,  deliveryDuration:  2_400_000, sellDuration:  5_760_000, batchValue: 640 },
    jeans:        { buyCost: 1760, deliveryDuration:  6_600_000, sellDuration: 13_200_000, batchValue: 2323 },
    denim_jackets:{ buyCost: 9570, deliveryDuration: 19_800_000, sellDuration: 39_600_000, batchValue: 10527 },
    // Purple / Fashion — Jewelry (tier 11)
    rings:    { buyCost: 440,   deliveryDuration:  2_640_000, sellDuration: 6_336_000,  batchValue: 704 },
    necklaces:{ buyCost: 1920,  deliveryDuration:  7_200_000, sellDuration: 14_400_000, batchValue: 2534 },
    diamonds: { buyCost: 10440, deliveryDuration: 21_600_000, sellDuration: 43_200_000, batchValue: 11484 },
    // Purple / Fashion — Perfumery (tier 12)
    body_sprays:       { buyCost: 480,   deliveryDuration:  2_880_000, sellDuration:  6_912_000, batchValue: 768 },
    perfumes:          { buyCost: 2080,  deliveryDuration:  7_800_000, sellDuration: 15_600_000, batchValue: 2746 },
    luxury_fragrances: { buyCost: 11310, deliveryDuration: 23_400_000, sellDuration: 46_800_000, batchValue: 12441 },

    // Red / Electronics — Gaming Gear (tier 4)
    gamepads:     { buyCost: 250,  deliveryDuration:  1_500_000, sellDuration:  3_600_000, batchValue: 400 },
    keyboards:    { buyCost: 1200, deliveryDuration:  4_500_000, sellDuration: 10_800_000, batchValue: 1584 },
    gaming_chairs:{ buyCost: 6960, deliveryDuration: 14_400_000, sellDuration: 28_800_000, batchValue: 7656 },
    // Red / Electronics — Watches (tier 5)
    smartwatches: { buyCost: 300,  deliveryDuration:  1_800_000, sellDuration:  4_320_000, batchValue: 480 },
    fitness_bands:{ buyCost: 1440, deliveryDuration:  5_400_000, sellDuration: 12_960_000, batchValue: 1900 },
    straps:       { buyCost: 8410, deliveryDuration: 17_400_000, sellDuration: 34_800_000, batchValue: 9251 },
    // Red / Electronics — Camera Store (tier 6)
    tripods: { buyCost: 350,  deliveryDuration:  2_100_000, sellDuration:  5_040_000, batchValue: 560 },
    cameras: { buyCost: 1680, deliveryDuration:  6_300_000, sellDuration: 15_120_000, batchValue: 2218 },
    lenses:  { buyCost: 9570, deliveryDuration: 19_800_000, sellDuration: 39_600_000, batchValue: 10527 },
    // Red / Electronics — Network Store (tier 7)
    cable:       { buyCost: 400,   deliveryDuration:  2_400_000, sellDuration:  5_760_000, batchValue: 640 },
    twisted_pair:{ buyCost: 1920,  deliveryDuration:  7_200_000, sellDuration: 17_280_000, batchValue: 2533 },
    optical_fiber:{ buyCost: 10440, deliveryDuration: 21_600_000, sellDuration: 43_200_000, batchValue: 11484 },
    // Red / Electronics — Smart Home (tier 8)
    smart_bulbs:    { buyCost: 450,   deliveryDuration:  2_700_000, sellDuration:  6_480_000, batchValue: 720 },
    smart_locks:    { buyCost: 2160,  deliveryDuration:  8_100_000, sellDuration: 19_440_000, batchValue: 2851 },
    home_assistants:{ buyCost: 11310, deliveryDuration: 23_400_000, sellDuration: 46_800_000, batchValue: 12441 },
    // Red / Electronics — Data Center (tier 9)
    hard_drives:   { buyCost: 500,   deliveryDuration:  3_000_000, sellDuration:  7_200_000, batchValue: 800 },
    servers:       { buyCost: 2400,  deliveryDuration:  9_000_000, sellDuration: 21_600_000, batchValue: 3168 },
    supercomputers:{ buyCost: 12180, deliveryDuration: 25_200_000, sellDuration: 50_400_000, batchValue: 13398 },
    // Red / Electronics — TV Store (tier 10)
    led_tvs:     { buyCost: 550,   deliveryDuration:  3_300_000, sellDuration:  7_920_000, batchValue: 880 },
    oled_tvs:    { buyCost: 2640,  deliveryDuration:  9_900_000, sellDuration: 23_760_000, batchValue: 3485 },
    home_theaters:{ buyCost: 13050, deliveryDuration: 27_000_000, sellDuration: 54_000_000, batchValue: 14355 },
    // Red / Electronics — Audio Store (tier 11)
    earbuds:    { buyCost: 600,   deliveryDuration:  3_600_000, sellDuration:  8_640_000, batchValue: 960 },
    headphones: { buyCost: 2880,  deliveryDuration: 10_800_000, sellDuration: 25_920_000, batchValue: 3802 },
    speakers:   { buyCost: 13920, deliveryDuration: 28_800_000, sellDuration: 57_600_000, batchValue: 15312 },
    // Red / Electronics — Space Tech (tier 12)
    telescopes:{ buyCost: 650,   deliveryDuration:  3_900_000, sellDuration:  9_360_000, batchValue: 1040 },
    satellites:{ buyCost: 3120,  deliveryDuration: 11_700_000, sellDuration: 28_080_000, batchValue: 4118 },
    rockets:   { buyCost: 14790, deliveryDuration: 30_600_000, sellDuration: 61_200_000, batchValue: 16269 },
  },
  startingBalance: 500,
  hotelCapacity: 10,
  lobbyConfig: {
    visitorSpawnInterval: 120_000,
    dailyTipsBaseTarget: 5_000,
    dailyTipsStage1Reward: 2,
    dailyTipsStage2Reward: 3,
    dailyGemLimitBase: 10,
    guestTipBase: 3,
    businessmanFallbackBase: 100,
    deliverySpeedBonus: 0.05,
    sellSpeedBonus: 0.05,
    elevatorUpgradeBaseCost: 3,
    lobbyUpgradeBaseCost: 5,
    lobbyUpgradeSeats: 3,
    defaultLobbyCapacity: 10,
  },
  floorUnlocks: [
    { floorId: 4,  price: 300,   currency: 'coins' as const, constructionDurationMs: 15  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 1 },
    { floorId: 5,  price: 3,     currency: 'gems'  as const, constructionDurationMs: 20  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 1 },
    { floorId: 6,  price: 500,   currency: 'coins' as const, constructionDurationMs: 30  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 7,  price: 750,   currency: 'coins' as const, constructionDurationMs: 45  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 8,  price: 1200,  currency: 'coins' as const, constructionDurationMs: 60  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 9,  price: 1700,  currency: 'coins' as const, constructionDurationMs: 90  * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    { floorId: 10, price: 15,    currency: 'gems'  as const, constructionDurationMs: 120 * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 2 },
    // Era 2: floors 11-20 (gem milestone at 20) — slots: 2, count: 2
    { floorId: 11, price: 4000,  currency: 'coins' as const, constructionDurationMs: 240 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 12, price: 7000,  currency: 'coins' as const, constructionDurationMs: 360 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 13, price: 11500, currency: 'coins' as const, constructionDurationMs: 480 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 14, price: 18000, currency: 'coins' as const, constructionDurationMs: 600 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 15, price: 50,    currency: 'gems'  as const, constructionDurationMs:  720 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 16, price:    50_000, currency: 'coins' as const, constructionDurationMs:  840 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 17, price:    80_000, currency: 'coins' as const, constructionDurationMs:  960 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 18, price:   130_000, currency: 'coins' as const, constructionDurationMs: 1080 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 19, price:   210_000, currency: 'coins' as const, constructionDurationMs: 1200 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    { floorId: 20, price:       100, currency: 'gems'  as const, constructionDurationMs: 1440 * 60 * 1000, requiredToolSlots: 2, requiredToolCount: 2 },
    // Era 3: floors 21-30 (gem milestone at 30) — slots: 3, count: 3
    { floorId: 21, price:   275_000, currency: 'coins' as const, constructionDurationMs: 1560 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 22, price:   475_000, currency: 'coins' as const, constructionDurationMs: 1680 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 23, price:   775_000, currency: 'coins' as const, constructionDurationMs: 1800 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 24, price: 1_000_000, currency: 'coins' as const, constructionDurationMs: 1920 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 25, price:       150, currency: 'gems'  as const, constructionDurationMs: 2160 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 26, price: 1_300_000, currency: 'coins' as const, constructionDurationMs: 2280 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 27, price: 2_100_000, currency: 'coins' as const, constructionDurationMs: 2400 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 28, price: 3_380_000, currency: 'coins' as const, constructionDurationMs: 2520 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 29, price: 5_460_000, currency: 'coins' as const, constructionDurationMs: 2640 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    { floorId: 30, price:       250, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 3, requiredToolCount: 3 },
    // Era 4: floors 31-40 (gem milestone at 40) — slots: 4, count: 4
    { floorId: 31, price:  6_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 32, price: 10_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 33, price: 16_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 34, price: 26_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 35, price:       500, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 36, price:  40_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 37, price:  52_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 38, price:  68_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 39, price:  88_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    { floorId: 40, price:     1_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 4 },
    // Era 5: floors 41-50 (gem milestone at 50) — slots: 4, count: 5
    { floorId: 41, price:  100_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 42, price:  140_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 43, price:  196_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 44, price:  275_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 45, price:     2_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 46, price:  300_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 47, price:  450_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 48, price:  675_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 49, price:  900_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    { floorId: 50, price:     3_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 4, requiredToolCount: 5 },
    // Era 6: floors 51-60 (gem milestone at 60) — slots: 5, count: 6
    { floorId: 51, price: 1_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 52, price: 1_100_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 53, price: 1_200_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 54, price: 1_300_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 55, price:     4_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 56, price: 1_400_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 57, price: 1_500_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 58, price: 1_600_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 59, price: 1_700_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    { floorId: 60, price:     5_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 6 },
    // Era 7: floors 61-70 (gem milestone at 70) — slots: 5, count: 7
    { floorId: 61, price: 1_800_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 62, price: 1_900_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 63, price: 2_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 64, price: 2_100_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 65, price:     6_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 66, price: 2_200_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 67, price: 2_300_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 68, price: 2_400_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 69, price: 2_500_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    { floorId: 70, price:     7_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 5, requiredToolCount: 7 },
    // Era 8: floors 71-80 (gem milestone at 80) — slots: 6, count: 8
    { floorId: 71, price: 2_600_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 72, price: 2_700_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 73, price: 2_800_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 74, price: 2_900_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 75, price:     8_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 76, price: 3_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 77, price: 3_100_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 78, price: 3_200_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 79, price: 3_300_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    { floorId: 80, price:     9_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 8 },
    // Era 9: floors 81-90 (gem milestone at 90) — slots: 6, count: 9
    { floorId: 81, price: 3_500_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 82, price: 4_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 83, price: 4_500_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 84, price: 5_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 85, price:    10_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 86, price:  6_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 87, price:  7_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 88, price:  8_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 89, price:  9_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    { floorId: 90, price:    15_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 9 },
    // Era 10: floors 91-100 (gem milestone at 100) — slots: 6, count: 10
    { floorId: 91, price: 10_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 92, price: 12_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 93, price: 14_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 94, price: 16_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 95, price:    20_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 96,  price: 18_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 97,  price: 20_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 98,  price: 22_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 99,  price: 24_000_000_000, currency: 'coins' as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
    { floorId: 100, price:    25_000, currency: 'gems'  as const, constructionDurationMs: 2880 * 60 * 1000, requiredToolSlots: 6, requiredToolCount: 10 },
  ],
} satisfies GameConfig;

export const gameConfig: GameConfig = GameConfigSchema.parse(rawConfig);

export function createInitialState(config: GameConfig): GameState {
  return {
    balance: config.startingBalance,
    gems: 10,
    floors: config.floors.map((floorConfig): Floor => ({
      id: floorConfig.id,
      productions: floorConfig.availableTypes.map((typeId) => ({
        typeId,
        stage: 'IDLE' as const,
        stageStartedAt: 0,
      })),
    })),
    commandQueue: [],
    workers: [
      makeStartingWorker('green', 'pastries', 2, 1),
      makeStartingWorker('green', 'cakes',    2, 2),
      makeStartingWorker('blue',  'accounts', 3, 2),
      ...generateRandomWorkers(5, config),
    ],
    hotelCapacity: config.hotelCapacity,
    lobbyVisitors: Array.from({ length: config.lobbyConfig.defaultLobbyCapacity }, () => generateVisitorAppearance()),
    lobbyCapacity: config.lobbyConfig.defaultLobbyCapacity,
    elevatorLevel: 1,
    elevatorFloor: 0,
    dailyTips: 0,
    dailyGemsCollected: 0,
    dailyTipsStage1Claimed: false,
    dailyTipsStage2Claimed: false,
    lastDailyReset: 0,
    dailyFillLobbyUses: 0,
    nextVisitorAt: 0,
    tools: { briks: 1, glass: 1, nails: 1, screw: 1, wood: 1, cement: 1 },
    underConstruction: [],
    openedFloorTypes: {},
    stats: {
      totalBought: 0,
      totalListed: 0,
      totalCollected: 0,
      totalPassengersLifted: 0,
    },
    coinBonusPercent: 0,
    xpBonusPercent: 0,
    tokens: { green: 3, blue: 3, yellow: 3, purple: 3, red: 3 },
    businessUpgrades: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
    floorStars: {},
    warehouseLevel: 0,
    dailyTasks: {
      progress: {
        visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
        gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
      },
      claimed: [],
      doubleRewardActive: false,
    },
    tutorialProgress: {
      coinsCollected: 0,
      visitorsLifted: 0,
      workersHired: 0,
      floorsBuilt: 0,
      dailyTasksClaimed: 0,
      elevatorUpgraded: 0,
      lobbyUpgraded: 0,
      floorUpgraded: 0,
      inviteSent: 0,
      businessUpgraded: 0,
    },
    tutorialTasks: {
      currentIndex: 0,
      snapshot: {},
      claimedFinal: false,
    },
  };
}
