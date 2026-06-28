import { NODE_R_DEFAULT } from './constants';
import { radToDeg } from './geometry';

/** Top-down AGV marker drawn in SVG (front = +X). */
export function renderRobotMarker(halfW: number, halfH: number, selected: boolean) {
  const strokeW = Math.max(1.5, halfW * 0.07);
  const bodyFill = selected ? '#1a1a1a' : '#2d2d2d';
  const frontFill = selected ? '#3b82f6' : '#10b981';

  return (
    <g style={{ pointerEvents: 'none' }}>
      {selected && (
        <rect
          x={-halfW - 4}
          y={-halfH - 4}
          width={halfW * 2 + 8}
          height={halfH * 2 + 8}
          rx={halfH * 0.45}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeOpacity={0.85}
        />
      )}
      <ellipse
        cx={0}
        cy={halfH * 0.15}
        rx={halfW * 0.85}
        ry={halfH * 0.35}
        fill="rgba(0,0,0,0.12)"
      />
      <rect
        x={-halfW}
        y={-halfH}
        width={halfW * 2}
        height={halfH * 2}
        rx={halfH * 0.38}
        fill={bodyFill}
        stroke="#ffffff"
        strokeWidth={strokeW}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
      />
      <path
        d={`M ${halfW * 0.15} 0 L ${halfW * 0.92} ${-halfH * 0.5} L ${halfW * 0.92} ${halfH * 0.5} Z`}
        fill={frontFill}
        stroke="#ffffff"
        strokeWidth={strokeW * 0.6}
      />
      <circle cx={-halfW * 0.25} cy={0} r={halfH * 0.14} fill="rgba(255,255,255,0.35)" />
      <circle cx={halfW * 0.1} cy={0} r={halfH * 0.14} fill="rgba(255,255,255,0.35)" />
    </g>
  );
}

/** Compact chevron arrow drawn inside the node circle. */
export function renderInnerNodeArrow(
  yaw: number,
  radius: number,
  options: { opacity?: number; arrowColor?: string } = {},
) {
  const { opacity = 1, arrowColor = '#ffffff' } = options;
  const scale = radius / NODE_R_DEFAULT;
  const svgRotate = -radToDeg(yaw);

  return (
    <g transform={`rotate(${svgRotate})`} style={{ pointerEvents: 'none' }} opacity={opacity}>
      <path
        d={`M ${-0.8 * scale},${-2.8 * scale} L ${3.8 * scale},0 L ${-0.8 * scale},${2.8 * scale} Z`}
        fill={arrowColor}
        fillOpacity={0.95}
      />
      <circle cx={-1.2 * scale} cy={0} r={1.1 * scale} fill={arrowColor} fillOpacity={0.45} />
    </g>
  );
}
