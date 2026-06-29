import React from 'react';
import { Platform, View } from 'react-native';
import type { ViewProps } from 'react-native';

export interface GlassViewProps extends ViewProps {
  cornerRadius?: number;
}

function getNativeView(): React.ComponentType<GlassViewProps> {
  if (Platform.OS !== 'ios') return View;
  try {
    return require('expo').requireNativeView('GlassView');
  } catch {
    return View;
  }
}

const GlassView = getNativeView();

export default GlassView;
