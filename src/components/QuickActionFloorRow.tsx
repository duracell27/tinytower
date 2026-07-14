import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatNum } from '../utils/format';
import type { QuickActionMode, FloorActionInfo } from '../utils/quickAction';

interface Props {
  floorId: number;
  floorName: string;
  mode: QuickActionMode;
  info: FloorActionInfo | null;
}

function summaryText(mode: QuickActionMode, info: FloorActionInfo | null): string {
  if (!info) return '';
  switch (info.mode) {
    case 'collect': return `$${formatNum(info.totalCoins)}`;
    case 'list':    return info.count === 1 ? 'до викладки' : `${info.count} шт`;
    case 'buy':     return `$${formatNum(info.buyCost)}`;
    case 'hire':    return 'потрібен робітник';
  }
}

const MODE_CHIP_COLOR: Record<QuickActionMode, string> = {
  collect: '#72C24F',
  list:    '#F2AC40',
  buy:     '#4A90D9',
  hire:    '#C9637E',
};

export default function QuickActionFloorRow({ floorId, floorName, mode, info }: Props) {
  const chipColor = MODE_CHIP_COLOR[mode];
  const summary = summaryText(mode, info);

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { borderColor: chipColor }]}>
        <Text style={[styles.badgeText, { color: chipColor }]}>{floorId}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>{floorName}</Text>
      {summary !== '' && (
        <View style={[styles.chip, { backgroundColor: chipColor }]}>
          <Text style={styles.chipText}>{summary}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
  },
  name: {
    flex: 1,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2A3040',
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
});
