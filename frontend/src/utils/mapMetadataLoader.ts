/**
 * ROS Map Metadata Loader
 * 
 * Bu dosya ROS map server YAML dosyasından metadata'yı okur
 * ve koordinat dönüşümü için gerekli bilgileri sağlar.
 */

export interface MapMetadata {
  resolution: number;  // meter/pixel
  origin: {
    x: number;  // meter
    y: number;  // meter
    theta: number;  // radyan
  };
  width: number;  // pixel
  height: number;  // pixel
}

/**
 * YAML dosyasından map metadata'yı parse eder
 * 
 * Örnek YAML formatı:
 * ```yaml
 * image: warehouse_map.pgm
 * resolution: 0.050000
 * origin: [-10.000000, -10.000000, 0.000000]
 * negate: 0
 * occupied_thresh: 0.65
 * free_thresh: 0.196
 * ```
 */
export async function loadMapMetadataFromYaml(yamlPath: string): Promise<MapMetadata> {
  try {
    const response = await fetch(yamlPath);
    const yamlText = await response.text();
    
    // Basit YAML parser (js-yaml kütüphanesi kullanabilirsiniz)
    const lines = yamlText.split('\n');
    const metadata: Partial<MapMetadata> = {
      origin: { x: 0, y: 0, theta: 0 }
    };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('resolution:')) {
        metadata.resolution = parseFloat(trimmed.split(':')[1].trim());
      } else if (trimmed.startsWith('origin:')) {
        // origin: [-10.000000, -10.000000, 0.000000]
        const originStr = trimmed.split(':')[1].trim();
        const matches = originStr.match(/\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/);
        if (matches) {
          metadata.origin = {
            x: parseFloat(matches[1]),
            y: parseFloat(matches[2]),
            theta: parseFloat(matches[3])
          };
        }
      }
    }
    
    // PGM dosyasından boyutları okuyalım
    const imagePath = yamlPath.replace('.yaml', '.pgm');
    const imageMetadata = await loadPgmDimensions(imagePath);
    metadata.width = imageMetadata.width;
    metadata.height = imageMetadata.height;
    
    if (!metadata.resolution || !metadata.width || !metadata.height) {
      throw new Error('Invalid map metadata');
    }
    
    return metadata as MapMetadata;
  } catch (error) {
    console.error('Error loading map metadata:', error);
    throw error;
  }
}

/**
 * PGM dosyasından resim boyutlarını okur
 */
async function loadPgmDimensions(pgmPath: string): Promise<{ width: number; height: number }> {
  try {
    const response = await fetch(pgmPath);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // PGM header'ı oku (ASCII format)
    let headerStr = '';
    let i = 0;
    
    // İlk birkaç satırı oku
    while (i < Math.min(200, uint8Array.length)) {
      headerStr += String.fromCharCode(uint8Array[i]);
      i++;
      if (headerStr.match(/P5\s+\d+\s+\d+\s+\d+/)) {
        break;
      }
    }
    
    // Format: P5\nWIDTH HEIGHT\nMAXVAL\n
    const lines = headerStr.split(/\r?\n/).filter(line => !line.startsWith('#'));
    
    if (lines[0] !== 'P5') {
      throw new Error('Not a valid PGM P5 file');
    }
    
    const dimensions = lines[1].split(/\s+/);
    const width = parseInt(dimensions[0]);
    const height = parseInt(dimensions[1]);
    
    return { width, height };
  } catch (error) {
    console.error('Error loading PGM dimensions:', error);
    // Fallback values
    return { width: 400, height: 400 };
  }
}

/**
 * Manuel olarak metadata oluştur (test için)
 */
export function createMapMetadata(
  resolution: number,
  originX: number,
  originY: number,
  width: number,
  height: number,
  theta: number = 0
): MapMetadata {
  return {
    resolution,
    origin: { x: originX, y: originY, theta },
    width,
    height
  };
}

/**
 * ROS koordinatlarını pixel koordinatlarına dönüştür
 */
export function rosToPixel(
  rosX: number,
  rosY: number,
  metadata: MapMetadata
): { x: number; y: number } {
  const pixelX = (rosX - metadata.origin.x) / metadata.resolution;
  const pixelY = (rosY - metadata.origin.y) / metadata.resolution;
  
  // ROS'ta Y ekseni yukarı, image'lerde Y ekseni aşağı
  const imageY = metadata.height - pixelY;
  
  return { x: pixelX, y: imageY };
}

/**
 * Pixel koordinatlarını ROS koordinatlarına dönüştür
 */
export function pixelToRos(
  pixelX: number,
  pixelY: number,
  metadata: MapMetadata
): { x: number; y: number } {
  // Image Y'yi ROS Y'ye çevir
  const rosPixelY = metadata.height - pixelY;
  
  const rosX = (pixelX * metadata.resolution) + metadata.origin.x;
  const rosY = (rosPixelY * metadata.resolution) + metadata.origin.y;
  
  return { x: rosX, y: rosY };
}
