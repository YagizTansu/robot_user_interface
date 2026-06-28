export interface MapSummary {
  map_name: string;
  width_px: number;
  height_px: number;
  resolution: number;
}

export interface MapDetail extends MapSummary {
  image_png_base64: string;
  origin: number[];
  negate?: number;
  occupied_thresh?: number;
  free_thresh?: number;
  mode?: string;
  timestamp?: number;
}

export interface MapData {
  map_name: string;
  image_png_base64: string;
  width_px: number;
  height_px: number;
  resolution: number;
  origin: number[];
}

export interface MapRobotInfo {
  robot_name: string;
  active_graph_name?: string;
}
