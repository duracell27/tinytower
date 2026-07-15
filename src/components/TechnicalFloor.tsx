import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useGameClock } from '../hooks/useGameClock';
import { shadeColor } from '../utils/color';

const HEADER_COLORS: [string, string] = ['#C9637E', '#A8475F'];
const HEADER_EDGE_COLOR = shadeColor(HEADER_COLORS[1], -22);
const BODY_BG = '#FBEAEF';

function StarIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 15.9 6.8 18l1-5.8L3.6 8.1l5.8-.8z"
        fill="#fff"
      />
    </Svg>
  );
}

function PersonMiniIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} fill="#fff" />
      <Path d="M5 20c0-3.6 3-5.8 7-5.8s7 2.2 7 5.8z" fill="#fff" />
    </Svg>
  );
}

interface HotelFloorProps {
  hotelOccupied: number;
  hotelTotal: number;
  onPress?: () => void;
}

export function HotelFloor({ hotelOccupied, hotelTotal, onPress }: HotelFloorProps) {
  const { t } = useTranslation('hotel');
  const hasVacancy = hotelOccupied < hotelTotal;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={[styles.header, { backgroundColor: HEADER_COLORS[0] }]}>
        <View style={styles.headerEdge} />
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>1</Text>
        </View>
        <Text style={styles.floorName} numberOfLines={1}>{t('technicalFloor.hotel.name')}</Text>
        <View style={styles.techTag}>
          <StarIcon />
          <Text style={styles.techTagText}>{t('technicalFloor.hotel.tag')}</Text>
        </View>
      </View>

      <View style={[styles.body, { backgroundColor: BODY_BG }]}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/hotel.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.infoRow}>
              {/* Left: vacancy pill */}
              <View style={[styles.statusPill, hasVacancy ? styles.statusGreen : styles.statusRed]}>
                <View style={[styles.statusDot, { backgroundColor: hasVacancy ? '#5BA63C' : '#D14343' }]} />
                <Text style={[styles.statusText, { color: hasVacancy ? '#3C7A2A' : '#A13030' }]}>
                  {hasVacancy ? t('technicalFloor.hotel.hasVacancy') : t('technicalFloor.hotel.full')}
                </Text>
              </View>
              {/* Right: occupancy count */}
              <View style={styles.occupancyRight}>
                <Text style={styles.occupancyLabel}>{t('technicalFloor.hotel.occupied')}</Text>
                <Text style={styles.occupancyCount}>
                  <Text style={styles.occupancyNum}>{hotelOccupied}</Text>
                  <Text style={styles.occupancyTotal}>/{hotelTotal}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

interface LobbyFloorProps {
  visitorCount: number;
  lobbyCapacity: number;
  nextVisitorAt: number;
  onPress: () => void;
}

export function LobbyFloor({ visitorCount, lobbyCapacity, nextVisitorAt, onPress }: LobbyFloorProps) {
  const now = useGameClock(1000);
  const { t } = useTranslation('hotel');
  const isFull = visitorCount >= lobbyCapacity;
  const secondsLeft = Math.max(0, Math.ceil((nextVisitorAt - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerText = isFull ? t('technicalFloor.lobby.full') : `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={[styles.header, { backgroundColor: HEADER_COLORS[0] }]}>
        <View style={styles.headerEdge} />
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>0</Text>
        </View>
        <Text style={styles.floorName} numberOfLines={1}>{t('technicalFloor.lobby.name')}</Text>
        <View style={styles.techTag}>
          <StarIcon />
          <Text style={styles.techTagText}>{t('technicalFloor.lobby.tag')}</Text>
        </View>
      </View>

      <View style={[styles.body, { backgroundColor: BODY_BG }]}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/reception.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.visitorLabel}>{t('technicalFloor.lobby.waiting')}</Text>
              {/* Visitor count pill */}
              <View style={styles.visitorPill}>
                <View style={styles.visitorAvatarCircle}>
                  <PersonMiniIcon />
                </View>
                <Text style={styles.visitorPillText}>{visitorCount} / {lobbyCapacity}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.visitorLabel}>{t('technicalFloor.lobby.newGuest')}</Text>
              <Text style={styles.timerText}>{timerText}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: 'rgba(140,50,75,1)',
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
    backgroundColor: HEADER_EDGE_COLOR,
    opacity: 0.55,
  },
  numberBadge: {
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
  numberText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  floorName: {
    flex: 1,
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(100,30,50,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  techTag: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.26)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
  },
  techTagText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.4,
  },
  body: {
    padding: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  techContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  techImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    shadowColor: 'rgba(140,50,75,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  techInfo: {
    flex: 1,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusGreen: {
    backgroundColor: 'rgba(91,166,60,0.12)',
  },
  statusRed: {
    backgroundColor: 'rgba(209,67,67,0.12)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11.5,
  },
  occupancyRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  occupancyLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
    color: '#A65068',
  },
  occupancyCount: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 19,
    lineHeight: 22,
  },
  occupancyNum: {
    color: '#AE415C',
  },
  occupancyTotal: {
    color: '#D69FB0',
    fontSize: 16,
  },
  visitorLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#8A4D5E',
  },
  visitorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 11,
    borderRadius: 11,
    shadowColor: 'rgba(140,50,75,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(140,50,75,0.12)',
  },
  visitorAvatarCircle: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#A8475F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorPillText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#A8475F',
  },
  timerText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#8A4D5E',
    fontVariant: ['tabular-nums'] as any,
  },
});
