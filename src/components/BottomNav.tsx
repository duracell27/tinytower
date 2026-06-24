import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

interface NavItemProps {
  active?: boolean;
  label: string;
  children: React.ReactNode;
  onPress?: () => void;
}

function NavItem({ active = false, label, children, onPress }: NavItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.navItemPressable}>
      {active ? (
        <LinearGradient
          colors={['#E4F4D8', '#D3EBBF']}
          style={[styles.navItem, styles.navItemActive]}
        >
          {children}
          <Text style={[styles.navLabel, styles.navLabelActive]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.navItem}>
          {children}
          <Text style={styles.navLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Tower icon: three horizontal bars of increasing width
function TowerIcon({ active }: { active: boolean }) {
  const color = active ? '#3C9A34' : '#3A4232';
  return (
    <View style={styles.towerIcon}>
      <View style={[styles.towerBar1, { backgroundColor: color }]} />
      <View style={[styles.towerBar2, { backgroundColor: color }]} />
      <View style={[styles.towerBar3, { backgroundColor: color }]} />
    </View>
  );
}

// City icon: three vertical bars of different heights
function CityIcon() {
  return (
    <View style={styles.cityIcon}>
      <View style={[styles.cityBar, { width: 6, height: 13 }]} />
      <View style={[styles.cityBar, { width: 6, height: 20 }]} />
      <View style={[styles.cityBar, { width: 6, height: 10 }]} />
    </View>
  );
}

// Shop icon: bag shape
function ShopIcon() {
  return (
    <View style={styles.shopIcon}>
      <View style={styles.shopBody} />
      <View style={styles.shopHandle} />
    </View>
  );
}

// Profile icon: head + shoulders
function ProfileIcon() {
  return (
    <View style={styles.profileIcon}>
      <View style={styles.profileHead} />
      <View style={styles.profileBody} />
    </View>
  );
}

export default function BottomNav() {
  return (
    <View style={styles.container}>
      <View style={styles.glassPanel}>
        <LinearGradient
          colors={['rgba(255,255,255,0.45)', 'transparent']}
          style={styles.sheen}
        />
        <View style={styles.content}>
          <NavItem active label="Вежа">
            <TowerIcon active />
          </NavItem>
          <NavItem label="Місто">
            <CityIcon />
          </NavItem>
          <NavItem label="Магазин">
            <ShopIcon />
          </NavItem>
          <NavItem label="Профіль" onPress={() => router.push('/profile')}>
            <ProfileIcon />
          </NavItem>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    zIndex: 40,
  },
  glassPanel: {
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.83)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    shadowColor: 'rgba(60,90,50,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    zIndex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    zIndex: 2,
  },
  navItemPressable: {
    flex: 1,
    alignItems: 'center',
  },
  navItem: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  navItemActive: {
    paddingHorizontal: 18,
    gap: 5,
    shadowColor: 'rgba(90,160,60,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  navLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11,
    color: '#3A4232',
  },
  navLabelActive: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#3C9A34',
  },
  // Tower icon
  towerIcon: {
    flexDirection: 'column',
    gap: 2,
    alignItems: 'center',
  },
  towerBar1: {
    width: 10,
    height: 4,
    borderRadius: 1.5,
  },
  towerBar2: {
    width: 15,
    height: 4,
    borderRadius: 1.5,
  },
  towerBar3: {
    width: 20,
    height: 4,
    borderRadius: 1.5,
  },
  // City icon
  cityIcon: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
    height: 20,
  },
  cityBar: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: '#3A4232',
  },
  // Shop icon
  shopIcon: {
    width: 20,
    height: 20,
  },
  shopBody: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#3A4232',
  },
  shopHandle: {
    position: 'absolute',
    top: 1,
    left: 5,
    width: 10,
    height: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#3A4232',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  // Profile icon
  profileIcon: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1.5,
    height: 20,
    justifyContent: 'center',
  },
  profileHead: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#3A4232',
  },
  profileBody: {
    width: 16,
    height: 9,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#3A4232',
  },
});
