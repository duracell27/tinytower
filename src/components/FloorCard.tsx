import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import ProductionCard from './ProductionCard';
import { useFloor, useGameStore } from '../stores/gameStore';
import { useGameClock } from '../hooks/useGameClock';
import { gameConfig } from '../../shared/config/gameConfig';
import { getWorkerForSlot, getFloorDiscount, getFloorSpecialistBonus } from '../../shared/engine/workerUtils';
import { shadeColor } from '../utils/color';
import type { ImageSource } from 'expo-image';

// Floor color schemes matching the design
export interface FloorColorScheme {
  color: string;
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  stars: number;
}

// Single source of truth for all floor type color schemes
export const FLOOR_TYPE_SCHEMES: Record<string, FloorColorScheme> = {
  green: {
    color: '#5E8F42',
    headerShadowColor: 'rgba(0,83,0,0.4)',
    bodyColor: '#D0EBCB',
    cardBg: '#E8F5E5',
    nameColor: '#117200',
    stars: 0,
  },
  blue: {
    color: '#2E6EC9',
    headerShadowColor: 'rgba(0,31,142,0.4)',
    bodyColor: '#CADDFC',
    cardBg: '#E5EEFD',
    nameColor: '#003EAD',
    stars: 0,
  },
  yellow: {
    color: '#E7A52B',
    headerShadowColor: 'rgba(142,80,0,0.4)',
    bodyColor: '#FCEBC9',
    cardBg: '#FDF5E4',
    nameColor: '#AD6F00',
    stars: 0,
  },
  purple: {
    color: '#9A6FD0',
    headerShadowColor: 'rgba(85,40,170,0.4)',
    bodyColor: '#E8DEFE',
    cardBg: '#F2ECFF',
    nameColor: '#6A40A0',
    stars: 0,
  },
  red: {
    color: '#E05050',
    headerShadowColor: 'rgba(170,30,30,0.4)',
    bodyColor: '#F8DEDE',
    cardBg: '#FFF0F0',
    nameColor: '#B02020',
    stars: 0,
  },
};

// Derived automatically from gameConfig — no manual sync needed when static floors change
export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = Object.fromEntries(
  gameConfig.floors
    .map((f) => [f.id, FLOOR_TYPE_SCHEMES[f.floorType]])
    .filter((entry): entry is [number, FloorColorScheme] => entry[1] != null),
);

// Product images keyed by production typeId
const PRODUCT_IMAGES: Record<string, ImageSource> = {
  buns:             require('../../assets/products/buns.png'),
  pastries:         require('../../assets/products/pastries.png'),
  cakes:            require('../../assets/products/cakes.png'),
  burgers:          require('../../assets/products/burgers.png'),
  fries:            require('../../assets/products/fries.png'),
  drinks:           require('../../assets/products/drinks.png'),
  milk:             require('../../assets/products/milk.png'),
  cheese:           require('../../assets/products/cheese.png'),
  yogurt:           require('../../assets/products/yogurt.png'),
  cards:            require('../../assets/products/cards.png'),
  loans:            require('../../assets/products/loans.png'),
  accounts:         require('../../assets/products/accounts.png'),
  scooters:         require('../../assets/products/scooters.png'),
  consoles:         require('../../assets/products/consoles.png'),
  tools:            require('../../assets/products/tools.png'),
  fillings:         require('../../assets/products/fillings.png'),
  cleaning:         require('../../assets/products/cleaning.png'),
  braces:           require('../../assets/products/braces.png'),
  paintings:        require('../../assets/products/paintings.png'),
  sculptures:       require('../../assets/products/sculptures.png'),
  gallery:          require('../../assets/products/gallery.png'),
  karts:            require('../../assets/products/karts.png'),
  helmets:          require('../../assets/products/helmets.png'),
  track:            require('../../assets/products/track.png'),
  cocktails:        require('../../assets/products/cocktails.png'),
  hookahs:          require('../../assets/products/hookahs.png'),
  pizza:            require('../../assets/products/pizza.png'),
  canvas_shoes:     require('../../assets/products/canvasShoes.png'),
  sneakers:         require('../../assets/products/sneakers.png'),
  custom_sneakers:  require('../../assets/products/customSneakers.png'),
  tshirts:          require('../../assets/products/tshirts.png'),
  pants:            require('../../assets/products/pants.png'),
  jackets:          require('../../assets/products/jackets.png'),
  hoodies:          require('../../assets/products/hoodies.png'),
  sweatshirts:      require('../../assets/products/sweatshirts.png'),
  caps:             require('../../assets/products/caps.png'),
  phones:           require('../../assets/products/phones.png'),
  cases:            require('../../assets/products/cases.png'),
  screen_protectors:require('../../assets/products/screenProtectors.png'),
  pcs:              require('../../assets/products/pcs.png'),
  laptops:          require('../../assets/products/laptops.png'),
  monitors:         require('../../assets/products/monitors.png'),
  robots:           require('../../assets/products/robots.png'),
  drones:           require('../../assets/products/drones.png'),
  spare_parts:      require('../../assets/products/spareParts.png'),
  // Green / Products — tiers 4-12
  greens:            require('../../assets/products/greens.png'),
  tomatoes:          require('../../assets/products/tomatoes.png'),
  fruits:            require('../../assets/products/fruits.png'),
  salt:              require('../../assets/products/salt.png'),
  pepper:            require('../../assets/products/pepper.png'),
  cinnamon:          require('../../assets/products/cinnamon.png'),
  shrimp:            require('../../assets/products/shrimp.png'),
  salmon:            require('../../assets/products/salmon.png'),
  caviar:            require('../../assets/products/caviar.png'),
  honeycomb:         require('../../assets/products/honeycomb.png'),
  honey:             require('../../assets/products/honey.png'),
  royal_jelly:       require('../../assets/products/royaljelly.png'),
  cocoa:             require('../../assets/products/cocoa.png'),
  chocolate_bars:    require('../../assets/products/chocolatebars.png'),
  truffles:          require('../../assets/products/truffles.png'),
  sugar:             require('../../assets/products/sugar.png'),
  spaghetti:         require('../../assets/products/spaghetti.png'),
  cereal:            require('../../assets/products/cereal.png'),
  popsicles:         require('../../assets/products/popsicles.png'),
  sundaes:           require('../../assets/products/sundaes.png'),
  gelato:            require('../../assets/products/gelato.png'),
  lemonade:          require('../../assets/products/lemonade.png'),
  apple_juice:       require('../../assets/products/applejuice.png'),
  smoothies:         require('../../assets/products/smoothies.png'),
  grapes:            require('../../assets/products/grapes.png'),
  table_wine:        require('../../assets/products/tablewine.png'),
  vintage_wine:      require('../../assets/products/vintagewine.png'),
  // Blue / Service — tiers 4-12
  stamps:            require('../../assets/products/stamps.png'),
  parcels:           require('../../assets/products/parcels.png'),
  express_delivery:  require('../../assets/products/expressdelivery.png'),
  passport_photos:   require('../../assets/products/passportphotos.png'),
  portraits:         require('../../assets/products/portraits.png'),
  wedding_shoots:    require('../../assets/products/weddingshoots.png'),
  websites:          require('../../assets/products/websites.png'),
  apps:              require('../../assets/products/apps.png'),
  design:            require('../../assets/products/design.png'),
  exterior_wash:     require('../../assets/products/exteriorwash.png'),
  interior_cleaning: require('../../assets/products/interiorcleaning.png'),
  polishing:         require('../../assets/products/polishing.png'),
  scanning:          require('../../assets/products/scanning.png'),
  printing:          require('../../assets/products/printing.png'),
  copying:           require('../../assets/products/copying.png'),
  checkups:          require('../../assets/products/checkups.png'),
  vaccinations:      require('../../assets/products/vaccinations.png'),
  surgeries:         require('../../assets/products/surgeries.png'),
  day_passes:        require('../../assets/products/daypasses.png'),
  personal_training: require('../../assets/products/personaltraining.png'),
  memberships:       require('../../assets/products/memberships.png'),
  manicures:         require('../../assets/products/manicures.png'),
  facials:           require('../../assets/products/facials.png'),
  makeup:            require('../../assets/products/makeup.png'),
  travel_insurance:  require('../../assets/products/travelinsurance.png'),
  car_insurance:     require('../../assets/products/carinsurance.png'),
  life_insurance:    require('../../assets/products/lifeinsurance.png'),
  // Yellow / Rest — tiers 4-12
  tickets:           require('../../assets/products/tickets.png'),
  popcorn:           require('../../assets/products/popcorn.png'),
  cola:              require('../../assets/products/cola.png'),
  bowling_shoes:     require('../../assets/products/bowlingshoes.png'),
  bowling_balls:     require('../../assets/products/bowlingballs.png'),
  tournaments:       require('../../assets/products/tournaments.png'),
  inflatable_rings:  require('../../assets/products/inflatablerings.png'),
  water_slides:      require('../../assets/products/waterslides.png'),
  cabanas:           require('../../assets/products/cabanas.png'),
  pepperoni:         require('../../assets/products/pepperoni.png'),
  margherita:        require('../../assets/products/margherita.png'),
  four_cheese:       require('../../assets/products/fourcheese.png'),
  tokens:            require('../../assets/products/tokens.png'),
  air_hockey:        require('../../assets/products/airhockey.png'),
  racing_simulators: require('../../assets/products/racingsimulators.png'),
  posters:           require('../../assets/products/posters.png'),
  front_row_seats:   require('../../assets/products/frontrowseats.png'),
  backstage_passes:  require('../../assets/products/backstagepasses.png'),
  carousels:         require('../../assets/products/carousels.png'),
  ferris_wheel:      require('../../assets/products/ferriswheel.png'),
  roller_coasters:   require('../../assets/products/rollercoasters.png'),
  slot_machines:     require('../../assets/products/slotmachines.png'),
  roulette:          require('../../assets/products/roulette.png'),
  poker_tables:      require('../../assets/products/pokertables.png'),
  playbills:         require('../../assets/products/playbills.png'),
  evening_shows:     require('../../assets/products/eveningshows.png'),
  private_boxes:     require('../../assets/products/privateboxes.png'),
  // Purple / Fashion — tiers 4-12
  belts:             require('../../assets/products/belts.png'),
  scarves:           require('../../assets/products/scarves.png'),
  handbags:          require('../../assets/products/handbags.png'),
  robes:             require('../../assets/products/robes.png'),
  kigurumi:          require('../../assets/products/kigurumi.png'),
  socks:             require('../../assets/products/socks.png'),
  bow_ties:          require('../../assets/products/bowties.png'),
  suits:             require('../../assets/products/suits.png'),
  evening_gowns:     require('../../assets/products/eveninggowns.png'),
  leggings:          require('../../assets/products/leggings.png'),
  tracksuits:        require('../../assets/products/tracksuits.png'),
  running_shoes:     require('../../assets/products/runningshoes.png'),
  vests:             require('../../assets/products/vests.png'),
  raincoats:         require('../../assets/products/raincoats.png'),
  fur_coats:         require('../../assets/products/furcoats.png'),
  veils:             require('../../assets/products/veils.png'),
  tuxedos:           require('../../assets/products/tuxedos.png'),
  bridal_gowns:      require('../../assets/products/bridalgowns.png'),
  denim_shorts:      require('../../assets/products/denimshorts.png'),
  jeans:             require('../../assets/products/jeans.png'),
  denim_jackets:     require('../../assets/products/denimjackets.png'),
  rings:             require('../../assets/products/rings.png'),
  necklaces:         require('../../assets/products/necklaces.png'),
  diamonds:          require('../../assets/products/diamonds.png'),
  body_sprays:       require('../../assets/products/bodysprays.png'),
  perfumes:          require('../../assets/products/perfumes.png'),
  luxury_fragrances: require('../../assets/products/luxuryfragrances.png'),
  // Red / Electronics — tiers 4-12
  gamepads:          require('../../assets/products/gamepads.png'),
  keyboards:         require('../../assets/products/keyboards.png'),
  gaming_chairs:     require('../../assets/products/gamingchairs.png'),
  smartwatches:      require('../../assets/products/smartwatches.png'),
  fitness_bands:     require('../../assets/products/fitnessbands.png'),
  straps:            require('../../assets/products/straps.png'),
  tripods:           require('../../assets/products/tripods.png'),
  cameras:           require('../../assets/products/cameras.png'),
  lenses:            require('../../assets/products/lenses.png'),
  cable:             require('../../assets/products/cable.png'),
  twisted_pair:      require('../../assets/products/twistedpair.png'),
  optical_fiber:     require('../../assets/products/opticalfiber.png'),
  smart_bulbs:       require('../../assets/products/smartbulbs.png'),
  smart_locks:       require('../../assets/products/smartlocks.png'),
  home_assistants:   require('../../assets/products/homeassistants.png'),
  hard_drives:       require('../../assets/products/harddrives.png'),
  servers:           require('../../assets/products/servers.png'),
  supercomputers:    require('../../assets/products/supercomputers.png'),
  led_tvs:           require('../../assets/products/ledtvs.png'),
  oled_tvs:          require('../../assets/products/oledtvs.png'),
  home_theaters:     require('../../assets/products/hometheaters.png'),
  earbuds:           require('../../assets/products/earbuds.png'),
  headphones:        require('../../assets/products/headphones.png'),
  speakers:          require('../../assets/products/speakers.png'),
  telescopes:        require('../../assets/products/telescopes.png'),
  satellites:        require('../../assets/products/satellites.png'),
  rockets:           require('../../assets/products/rockets.png'),
};

function Stars({ count, color = '#FFD23E' }: { count: number; color?: string }) {
  return (
    <View style={styles.starsContainer}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Text
          key={i}
          style={[
            styles.star,
            { color: i < count ? color : 'rgba(0,0,0,0.18)' },
            i < count && {
              textShadowColor: 'rgba(120,80,0,0.4)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            },
          ]}
        >
          {'★'}
        </Text>
      ))}
    </View>
  );
}

interface FloorCardProps {
  floorId: number;
  balance: number;
  onHireSlot?: (floorId: number, slotIdx: number) => void;
}

function FloorCardInner({ floorId, balance, onHireSlot }: FloorCardProps) {
  const now = useGameClock(1000);
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');
  const floor = useFloor(floorId);
  const workers = useGameStore((s) => s.workers);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);
  const gems = useGameStore((s) => s.gems);
  const dynamicFloorType = openedFloorTypes?.[String(floorId)];
  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = floorConfig?.floorType ?? dynamicFloorType ?? null;
  const scheme = (floorType ? FLOOR_TYPE_SCHEMES[floorType] : undefined) ?? FLOOR_TYPE_SCHEMES.green;
  const availableTypes = floorConfig?.availableTypes
    ?? floor?.productions.map((p) => p.typeId).filter((id): id is string => id !== null) ?? [];
  const discount = getFloorDiscount(workers, floorId);
  const specialistBonus = getFloorSpecialistBonus(workers, floorId);
  const deliveryLockMs = floor.productions.reduce((maxRemaining, p) => {
    if (p.stage !== 'DELIVERING' || !p.typeId) return maxRemaining;
    const tc = gameConfig.productionTypes[p.typeId];
    if (!tc) return maxRemaining;
    const remaining = tc.deliveryDuration - (now - p.stageStartedAt);
    return Math.max(maxRemaining, remaining);
  }, 0);
  // Derive business name from the first production typeId — stable regardless of what
  // other floors of the same type get opened later.
  const dynamicFloorName = (() => {
    if (!dynamicFloorType || !availableTypes[0]) return null;
    const business = gameConfig.floorTypes[dynamicFloorType]?.businesses
      .find((b) => b.dreamJobs.includes(availableTypes[0]));
    return business?.name ?? null;
  })();
  const floorName = dynamicFloorName ?? tContent(`floors.${floorId}.name`, { defaultValue: `Floor ${floorId}` });

  return (
    <View style={styles.floorContainer}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: scheme.color }]}>
        <View style={[styles.headerEdge, { backgroundColor: shadeColor(scheme.color, -22) }]} />
        <View style={styles.floorNumberBadge}>
          <Text style={styles.floorNumberText}>{floorId}</Text>
        </View>
        <Text style={[styles.floorName, { textShadowColor: scheme.headerShadowColor }]}>
          {floorName}
        </Text>
        <View style={styles.headerRight}>
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>−{Math.round(discount * 100)}%</Text>
            </View>
          )}
          {specialistBonus > 0 && (
            <View style={styles.specialistBonusBadge}>
              <Text style={styles.specialistBonusBadgeText}>+{Math.round(specialistBonus * 100)}%</Text>
            </View>
          )}
          <Stars count={scheme.stars} />
        </View>
      </View>

      {/* Production cards */}
      <View style={[styles.cardsContainer, { backgroundColor: scheme.bodyColor }]}>
        {floor.productions.map((production, idx) => {
          const slotWorker = getWorkerForSlot(workers, floorId, idx);
          return (
            <ProductionCard
              key={idx}
              production={production}
              balance={balance}
              now={now}
              floorId={floorId}
              floorType={floorType}
              slotIdx={idx}
              floorAvailableTypes={availableTypes}
              cardBg={scheme.cardBg}
              nameColor={scheme.nameColor}
              productTitle={tContent(`productionTypes.${availableTypes[idx]}.displayName`, {
                defaultValue: availableTypes[idx] ?? t('floorCard.productFallback', { index: idx + 1 }),
              })}
              productImage={PRODUCT_IMAGES[availableTypes[idx]] ?? PRODUCT_IMAGES[availableTypes[0]]}
              worker={slotWorker}
              floorDiscount={discount}
              specialistBonus={specialistBonus}
              accentColor={scheme.color}
              onHire={onHireSlot}
              deliveryLockMs={deliveryLockMs}
              gems={gems}
            />
          );
        })}
      </View>

    </View>
  );
}

const FloorCard = memo(FloorCardInner);
export default FloorCard;

const styles = StyleSheet.create({
  floorContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    paddingHorizontal: 12,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  headerEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.55,
  },
  floorNumberBadge: {
    width: 21,
    height: 21,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  floorNumberText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  floorName: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'capitalize',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 1,
  },
  star: {
    fontSize: 13,
    lineHeight: 15,
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 9,
    padding: 11,
  },
  discountBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  discountBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    color: '#fff',
  },
  specialistBonusBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  specialistBonusBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    color: '#fff',
  },
});
