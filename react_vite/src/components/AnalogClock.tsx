/**
 * AnalogClock.tsx
 * SVG port of flutter_app/lib/widgets/analog_clock_widget.dart.
 */
import { JSX } from 'react';

interface Props {
  time: Date;
  primaryColor: string;
  accentColor: string;
  size: number;
}

export default function AnalogClock({ time, primaryColor, accentColor, size }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = Math.min(cx, cy) * 0.95;
  const rad = (deg: number) => (deg * Math.PI) / 180;

  const markers: JSX.Element[] = [];

  // Hour markers
  for (let i = 0; i < 12; i++) {
    const angle = rad(i * 30 - 90);
    const isMain = i % 3 === 0;
    const len = isMain ? r * 0.14 : r * 0.08;
    const width = isMain ? r * 0.03 : r * 0.018;
    const outerR = r * 0.86;
    const innerR = outerR - len;
    markers.push(
      <line
        key={`h${i}`}
        x1={cx + outerR * Math.cos(angle)}
        y1={cy + outerR * Math.sin(angle)}
        x2={cx + innerR * Math.cos(angle)}
        y2={cy + innerR * Math.sin(angle)}
        stroke={primaryColor}
        strokeOpacity={isMain ? 0.9 : 0.45}
        strokeWidth={width}
        strokeLinecap="round"
      />,
    );
  }

  // Minute markers
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const angle = rad(i * 6 - 90);
    const outerR = r * 0.86;
    const innerR = outerR - r * 0.04;
    markers.push(
      <line
        key={`m${i}`}
        x1={cx + outerR * Math.cos(angle)}
        y1={cy + outerR * Math.sin(angle)}
        x2={cx + innerR * Math.cos(angle)}
        y2={cy + innerR * Math.sin(angle)}
        stroke={primaryColor}
        strokeOpacity={0.22}
        strokeWidth={r * 0.012}
        strokeLinecap="round"
      />,
    );
  }

  // Numbers 12/3/6/9
  const numPositions: Record<number, number> = { 12: -90, 3: 0, 6: 90, 9: 180 };
  const numbers = Object.entries(numPositions).map(([num, deg]) => {
    const angle = rad(deg);
    const numR = r * 0.65;
    return (
      <text
        key={`n${num}`}
        x={cx + numR * Math.cos(angle)}
        y={cy + numR * Math.sin(angle)}
        fill={primaryColor}
        fillOpacity={0.75}
        fontSize={r * 0.13}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {num}
      </text>
    );
  });

  // Hands
  const seconds = time.getSeconds() + time.getMilliseconds() / 1000;
  const minutes = time.getMinutes() + seconds / 60;
  const hours = (time.getHours() % 12) + minutes / 60;

  const hand = (
    key: string,
    angleDeg: number,
    length: number,
    width: number,
    color: string,
    tailLength = 0,
    shadow = false,
  ) => {
    const angle = rad(angleDeg);
    const tipX = cx + length * Math.cos(angle);
    const tipY = cy + length * Math.sin(angle);
    const tailX = tailLength > 0 ? cx - tailLength * Math.cos(angle) : cx;
    const tailY = tailLength > 0 ? cy - tailLength * Math.sin(angle) : cy;
    return (
      <g key={key}>
        {shadow && (
          <line
            x1={tailX}
            y1={tailY}
            x2={tipX}
            y2={tipY}
            stroke="#000000"
            strokeOpacity={0.35}
            strokeWidth={width + 2}
            strokeLinecap="round"
          />
        )}
        <line
          x1={tailX}
          y1={tailY}
          x2={tipX}
          y2={tipY}
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
        />
      </g>
    );
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="#0F172A" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={primaryColor} strokeOpacity={0.25} strokeWidth={r * 0.025} />
      <circle cx={cx} cy={cy} r={r * 0.88} fill="none" stroke={primaryColor} strokeOpacity={0.08} strokeWidth={1} />
      {markers}
      {numbers}
      {hand('hour', hours * 30 - 90, r * 0.5, r * 0.04, primaryColor, 0, true)}
      {hand('min', minutes * 6 - 90, r * 0.7, r * 0.028, primaryColor, 0, true)}
      {hand('sec', seconds * 6 - 90, r * 0.78, r * 0.016, accentColor, r * 0.18)}
      <circle cx={cx} cy={cy} r={r * 0.045} fill={accentColor} />
      <circle cx={cx} cy={cy} r={r * 0.022} fill="#0F172A" />
    </svg>
  );
}
