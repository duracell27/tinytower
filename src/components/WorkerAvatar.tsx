import React, { memo } from 'react';
import { Image } from 'expo-image';
import type { Worker } from '../../shared/types';

const MAN: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/workers/man-green.png'),
  blue:   require('../../assets/img/workers/man-blue.png'),
  yellow: require('../../assets/img/workers/man-yellow.png'),
  violet: require('../../assets/img/workers/man-violet.png'),
  red:    require('../../assets/img/workers/man-red.png'),
};

const WOMAN: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/workers/woman-green.png'),
  blue:   require('../../assets/img/workers/woman-blue.png'),
  yellow: require('../../assets/img/workers/woman-yellow.png'),
  violet: require('../../assets/img/workers/woman-violet.png'),
  red:    require('../../assets/img/workers/woman-red.png'),
};

interface WorkerAvatarProps {
  worker: Worker;
  size?: number;
}

function WorkerAvatarInner({ worker, size = 60 }: WorkerAvatarProps) {
  const map = worker.female ? WOMAN : MAN;
  const source = map[worker.floorType] ?? (worker.female ? WOMAN.green : MAN.green);
  return (
    <Image
      source={source}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
    />
  );
}

const WorkerAvatar = memo(WorkerAvatarInner);
export default WorkerAvatar;
