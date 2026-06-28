import { apiFetch, ApiError } from '../api';
import type { MapData, MapMeta, MapThumbnail } from '../types';

/** Map image + metadata for RobotMap rendering. Falls back to legacy full-map endpoint. */
export async function fetchMapRenderData(options: {
  mapName?: string;
  robotName?: string;
}): Promise<MapData> {
  const { mapName, robotName } = options;
  if (!mapName && !robotName) {
    throw new Error('mapName or robotName is required');
  }

  try {
    const metaPath = mapName
      ? `/maps/${encodeURIComponent(mapName)}/meta`
      : `/maps/by-robot/${encodeURIComponent(robotName!)}/meta`;
    const meta = await apiFetch<MapMeta>(metaPath);
    const thumb = await apiFetch<MapThumbnail>(
      `/maps/${encodeURIComponent(meta.map_name)}/thumbnail`,
    );
    return { ...meta, image_png_base64: thumb.image_png_base64 };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const legacyPath = mapName
        ? `/maps/${encodeURIComponent(mapName)}`
        : `/maps/by-robot/${encodeURIComponent(robotName!)}`;
      return apiFetch<MapData>(legacyPath);
    }
    throw e;
  }
}

/** Map metadata + thumbnail for Maps page detail panel. Falls back to legacy full-map endpoint. */
export async function fetchMapDetail(mapName: string): Promise<{
  meta: MapMeta;
  thumbnail: string;
}> {
  try {
    const [meta, thumb] = await Promise.all([
      apiFetch<MapMeta>(`/maps/${encodeURIComponent(mapName)}/meta`),
      apiFetch<MapThumbnail>(`/maps/${encodeURIComponent(mapName)}/thumbnail`),
    ]);
    return { meta, thumbnail: thumb.image_png_base64 };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const full = await apiFetch<MapData>(`/maps/${encodeURIComponent(mapName)}`);
      const { image_png_base64, ...meta } = full;
      return { meta, thumbnail: image_png_base64 };
    }
    throw e;
  }
}
