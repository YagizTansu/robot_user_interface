import { NotFoundException } from '@nestjs/common';
import { MapsService } from './maps.service';

describe('MapsService', () => {
  const mapModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const robotInfoModel = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const service = new MapsService(mapModel as any, robotInfoModel as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findMetaByMapName excludes image field', async () => {
    const meta = {
      map_name: 'lab_new',
      width_px: 100,
      height_px: 200,
      resolution: 0.05,
      origin: [0, 0, 0],
    };
    mapModel.findOne.mockReturnValue({ exec: () => Promise.resolve(meta) });

    await expect(service.findMetaByMapName('lab_new')).resolves.toEqual(meta);
    expect(mapModel.findOne).toHaveBeenCalledWith(
      { map_name: 'lab_new' },
      { image_png_base64: 0 },
    );
  });

  it('findThumbnailByMapName returns only image fields', async () => {
    const thumb = { map_name: 'lab_new', image_png_base64: 'abc' };
    mapModel.findOne.mockReturnValue({ exec: () => Promise.resolve(thumb) });

    await expect(service.findThumbnailByMapName('lab_new')).resolves.toEqual(thumb);
    expect(mapModel.findOne).toHaveBeenCalledWith(
      { map_name: 'lab_new' },
      { map_name: 1, image_png_base64: 1 },
    );
  });

  it('findMetaByMapName throws NotFoundException when missing', async () => {
    mapModel.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });

    await expect(service.findMetaByMapName('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
