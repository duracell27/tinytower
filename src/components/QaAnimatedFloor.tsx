import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  isLeaving: boolean;
  onAnimationDone: () => void;
  children: React.ReactNode;
}

export default function QaAnimatedFloor({ isLeaving, onAnimationDone, children }: Props) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (isLeaving) {
      translateX.value = withTiming(
        -SCREEN_WIDTH * 1.1,
        { duration: 120, easing: Easing.in(Easing.poly(2)) },
        (finished) => {
          if (finished) runOnJS(onAnimationDone)();
        },
      );
    } else {
      // FlashList recycles cells — reset position so a reused cell doesn't stay off-screen.
      cancelAnimation(translateX);
      translateX.value = 0;
    }
  // onAnimationDone is stable (useCallback([])) — omitting from deps avoids restarting
  // the animation if the parent re-renders mid-flight.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeaving]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
