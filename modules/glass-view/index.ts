import React from 'react';
import { Platform, View } from 'react-native';
import type { ViewProps } from 'react-native';

export interface GlassViewProps extends ViewProps {
  cornerRadius?: number;
}

const GlassView: React.ComponentType<GlassViewProps> =
  Platform.OS === 'ios'
    ? require('expo').requireNativeView('GlassView')
    : View;

export default GlassView;
