import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const ICON_MAP: Record<string, ReturnType<typeof require>> = {
  gem:        require('../../assets/img/diamond.png'),
  coin:       require('../../assets/img/coin.png'),
  cup_gold:   require('../../assets/img/rating/1PlaceCup.png'),
  cup_silver: require('../../assets/img/rating/2PlaceCup.png'),
  cup_bronze: require('../../assets/img/rating/3PlaceCup.png'),
  token:      require('../../assets/img/tokens/tokenGreen.png'),
};

const TAG_RE = /\[(gem|coin|cup_gold|cup_silver|cup_bronze|token)\]/g;

type Segment = { type: 'text'; value: string } | { type: 'icon'; name: string };

function parseSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: line.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'icon', name: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    segments.push({ type: 'text', value: line.slice(lastIndex) });
  }
  return segments;
}

interface Props {
  body: string;
  style?: object;
  color?: string;
}

export default function RichMailBody({ body, style, color = '#2A3344' }: Props) {
  const lines = body.split('\n');
  return (
    <View style={styles.wrap}>
      {lines.map((line, li) => {
        const segments = parseSegments(line);
        const hasIcon = segments.some((s) => s.type === 'icon');
        if (!hasIcon) {
          return (
            <Text key={li} style={[styles.text, style, { color }]}>
              {line}
            </Text>
          );
        }
        return (
          <View key={li} style={styles.inlineLine}>
            {segments.map((seg, si) =>
              seg.type === 'icon' ? (
                <Image
                  key={si}
                  source={ICON_MAP[seg.name]}
                  style={styles.icon}
                  contentFit="contain"
                />
              ) : (
                <Text key={si} style={[styles.text, style, { color }]}>
                  {seg.value}
                </Text>
              ),
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { marginBottom: 12 },
  inlineLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  text:       { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 20 },
  icon:       { width: 16, height: 16, marginHorizontal: 2 },
});
