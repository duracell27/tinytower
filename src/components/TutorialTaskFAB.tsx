import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useTutorialTaskStore } from '../stores/gameStore';

interface Props {
  slot: number;        // used when aboveBar=false: bottom = 96 + slot * 62
  aboveBar: boolean;   // true = QA bar is visible; position above it
  onPress: () => void;
}

function StarIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={26} height={26} fill="#F2AC40">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

export default function TutorialTaskFAB({ slot, aboveBar, onPress }: Props) {
  const { allDone, claimedFinal, isComplete } = useTutorialTaskStore();

  if (allDone && claimedFinal) return null;

  const bottomPos = aboveBar ? 160 : 96 + slot * 62;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.fab, { bottom: bottomPos }, pressed && { opacity: 0.82 }]}
    >
      <StarIcon />
      {isComplete && !allDone && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3FA535',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
