import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

interface HotelFloorProps {
  hotelOccupied: number;
  hotelTotal: number;
  onPress?: () => void;
}

export function HotelFloor({ hotelOccupied, hotelTotal, onPress }: HotelFloorProps) {
  const hasVacancy = hotelOccupied < hotelTotal;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient colors={['#8090A6', '#5F6E84']} style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>1</Text>
        </View>
        <Text style={styles.floorName}>ГОТЕЛЬ</Text>
        <View style={styles.techTag}>
          <Text style={styles.techTagText}>ТЕХНІЧНИЙ</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/hotel.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={[styles.statusPill, hasVacancy ? styles.statusGreen : styles.statusRed]}>
              <View style={[styles.statusDot, { backgroundColor: hasVacancy ? '#5BA63C' : '#D14343' }]} />
              <Text style={[styles.statusText, { color: hasVacancy ? '#3C7A2A' : '#A13030' }]}>
                {hasVacancy ? 'Є вільні місця' : 'Немає вільних місць'}
              </Text>
            </View>
            <Text style={styles.occupancyText}>
              {hotelOccupied} / {hotelTotal}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

interface LobbyFloorProps {
  visitorCount: number;
  nextVisitorAt: number;
  now: number;
  onPress: () => void;
}

export function LobbyFloor({ visitorCount, nextVisitorAt, now, onPress }: LobbyFloorProps) {
  const secondsLeft = Math.max(0, Math.ceil((nextVisitorAt - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient colors={['#8090A6', '#5F6E84']} style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>0</Text>
        </View>
        <Text style={styles.floorName}>ВЕСТИБЮЛЬ</Text>
        <View style={styles.techTag}>
          <Text style={styles.techTagText}>ТЕХНІЧНИЙ</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.techContent}>
          <Image
            source={require('../../assets/img/lobby.png')}
            style={styles.techImage}
            contentFit="contain"
          />
          <View style={styles.techInfo}>
            <View style={styles.visitorRow}>
              <Text style={styles.visitorLabel}>Очікують</Text>
              <View style={styles.visitorBadge}>
                <Text style={styles.visitorBadgeText}>{visitorCount}</Text>
              </View>
            </View>
            <View style={styles.visitorRow}>
              <Text style={styles.visitorLabel}>Новий гість</Text>
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
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    paddingHorizontal: 12,
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
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'capitalize',
    textShadowColor: 'rgba(40,50,60,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  techTag: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  techTagText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  body: {
    backgroundColor: '#D9DEE7',
    padding: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  techContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  techImage: {
    width: 100,
    height: 50,
    borderRadius: 10,
  },
  techInfo: {
    flex: 1,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
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
    fontSize: 12,
  },
  occupancyText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#3A4250',
  },
  visitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visitorLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#3A4250',
  },
  visitorBadge: {
    backgroundColor: '#5BA63C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    shadowColor: 'rgba(40,90,25,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  visitorBadgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  timerText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
    color: '#5A6478',
    fontVariant: ['tabular-nums'] as any,
  },
});
