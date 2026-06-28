import type { DockingArea } from '../../types';
import type { DockPoseEdit } from './types';

/** ROS yaw (rad) from SVG pixel offset (Y axis points down). */
export const yawFromPixelDelta = (dx: number, dy: number): number =>
  Math.atan2(-dy, dx);

export const yawToHandlePos = (yaw: number, distance: number) => ({
  x: distance * Math.cos(yaw),
  y: -distance * Math.sin(yaw),
});

export const radToDeg = (rad: number) => (rad * 180) / Math.PI;
export const degToRad = (deg: number) => (deg * Math.PI) / 180;

export function polygonCentroid(flat: number[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i < flat.length; i += 2) {
    sx += flat[i];
    sy += flat[i + 1];
    n += 1;
  }
  return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
}

export function deriveDockingFromPolygon(points: number[]): DockPoseEdit {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i += 2) {
    pts.push({ x: points[i], y: points[i + 1] });
  }
  if (pts.length < 4) {
    const c = polygonCentroid(points);
    return { x: c.x, y: c.y, width: 1, height: 1, yaw: 0 };
  }
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const e0x = pts[1].x - pts[0].x;
  const e0y = pts[1].y - pts[0].y;
  const e1x = pts[2].x - pts[1].x;
  const e1y = pts[2].y - pts[1].y;
  const len0 = Math.hypot(e0x, e0y);
  const len1 = Math.hypot(e1x, e1y);
  const width = Math.max(len0, len1);
  const height = Math.min(len0, len1);
  const yaw = len0 >= len1 ? Math.atan2(e0y, e0x) : Math.atan2(e1y, e1x);
  return {
    x: parseFloat(cx.toFixed(2)),
    y: parseFloat(cy.toFixed(2)),
    width: parseFloat(Math.max(width, 0.1).toFixed(2)),
    height: parseFloat(Math.max(height, 0.1).toFixed(2)),
    yaw: parseFloat(yaw.toFixed(4)),
  };
}

export function polygonFromDockingParams(
  x: number,
  y: number,
  yaw: number,
  width: number,
  height: number,
): number[] {
  const hw = width / 2;
  const hh = height / 2;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const local = [
    { lx: -hw, ly: -hh },
    { lx: hw, ly: -hh },
    { lx: hw, ly: hh },
    { lx: -hw, ly: hh },
  ];
  const flat: number[] = [];
  for (const c of local) {
    flat.push(
      parseFloat((x + c.lx * cos - c.ly * sin).toFixed(2)),
      parseFloat((y + c.lx * sin + c.ly * cos).toFixed(2)),
    );
  }
  return flat;
}

export function normalizeDockingArea(
  d: DockingArea,
): Required<Pick<DockingArea, 'x' | 'y' | 'width' | 'height'>> & DockingArea {
  if (
    d.x !== undefined &&
    d.y !== undefined &&
    d.width !== undefined &&
    d.height !== undefined
  ) {
    const yaw = d.yaw ?? 0;
    return {
      ...d,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      yaw,
      polygon_points: polygonFromDockingParams(d.x, d.y, yaw, d.width, d.height),
    };
  }
  if (d.polygon_points?.length >= 8) {
    const derived = deriveDockingFromPolygon(d.polygon_points);
    return {
      ...d,
      ...derived,
      polygon_points: polygonFromDockingParams(
        derived.x,
        derived.y,
        derived.yaw,
        derived.width,
        derived.height,
      ),
    };
  }
  return {
    ...d,
    x: d.x ?? 0,
    y: d.y ?? 0,
    width: d.width ?? 1,
    height: d.height ?? 1,
    yaw: d.yaw ?? 0,
    polygon_points: d.polygon_points ?? [],
  };
}

/** ROS yaw (degrees, CCW from +X) → SVG rotate. Map Y is flipped; marker front points +X. */
export const rosYawDegToSvgRotate = (yawDeg: number) => -yawDeg;

export function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
      return '#10b981';
    case 'idle':
      return '#f59e0b';
    case 'charging':
      return '#3b82f6';
    case 'error':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}
