import React, { memo } from 'react';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';
import { gameConfig } from '../../shared/config/gameConfig';
import type { Worker } from '../../shared/types';

const SKIN = '#F0C49C';

interface WorkerAvatarProps {
  worker: Worker;
  size?: number;
}

function WorkerAvatarInner({ worker, size = 60 }: WorkerAvatarProps) {
  const floorType = gameConfig.floorTypes[worker.floorType];
  const shirtColor = floorType?.shirtColor ?? '#999';
  const hair = worker.hairColor;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Side hair (female only) */}
      {worker.female && (
        <>
          <Ellipse cx={15} cy={35} rx={6} ry={14} fill={hair} />
          <Ellipse cx={49} cy={35} rx={6} ry={14} fill={hair} />
        </>
      )}
      {/* Shirt (shoulders) */}
      <Rect x={9} y={45} width={46} height={26} rx={14} fill={shirtColor} />
      {/* Name tag */}
      <Rect x={25} y={54} width={14} height={8} rx={2.5} fill="#fff" opacity={0.9} />
      {/* Neck */}
      <Rect x={27.5} y={37} width={9} height={10} rx={4} fill={SKIN} />
      {/* Hair top */}
      <Circle cx={32} cy={22} r={15} fill={hair} />
      {/* Head */}
      <Circle cx={32} cy={27} r={13.5} fill={SKIN} />
    </Svg>
  );
}

const WorkerAvatar = memo(WorkerAvatarInner);
export default WorkerAvatar;
