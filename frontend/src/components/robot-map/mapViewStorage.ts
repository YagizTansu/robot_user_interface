import { MAP_VIEW_STORAGE_KEY } from './constants';
import type { MapViewSettings } from './types';

export function loadMapViewSettings(mapKey: string): MapViewSettings | null {
  try {
    const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, MapViewSettings>;
    const saved = all[mapKey];
    if (!saved) return null;
    return {
      rotation: saved.rotation ?? 0,
      zoom: saved.zoom ?? 1,
      pan: saved.pan ?? { x: 0, y: 0 },
    };
  } catch {
    return null;
  }
}

export function saveMapViewSettings(mapKey: string, settings: MapViewSettings) {
  try {
    const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[mapKey] = settings;
    localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / private mode */
  }
}
