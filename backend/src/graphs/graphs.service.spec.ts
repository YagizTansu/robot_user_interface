import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GraphsService } from './graphs.service';

describe('GraphsService', () => {
  const graphModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };
  const robotInfoModel = {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const service = new GraphsService(graphModel as any, robotInfoModel as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('activate throws NotFoundException when robot is missing', async () => {
    graphModel.findById.mockReturnValue({
      exec: () =>
        Promise.resolve({
          graph_name: 'main',
          map_name: 'lab_new',
        }),
    });
    robotInfoModel.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });

    await expect(service.activate('graph-id', 'robot_a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('activate throws BadRequestException on map mismatch', async () => {
    graphModel.findById.mockReturnValue({
      exec: () =>
        Promise.resolve({
          graph_name: 'main',
          map_name: 'lab_new',
        }),
    });
    robotInfoModel.findOne.mockReturnValue({
      exec: () =>
        Promise.resolve({
          robot_name: 'robot_a',
          map_name: 'warehouse',
        }),
    });

    await expect(service.activate('graph-id', 'robot_a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('activate updates active_graph_name on success', async () => {
    graphModel.findById.mockReturnValue({
      exec: () =>
        Promise.resolve({
          graph_name: 'main',
          map_name: 'lab_new',
        }),
    });
    robotInfoModel.findOne.mockReturnValue({
      exec: () =>
        Promise.resolve({
          robot_name: 'robot_a',
          map_name: 'lab_new',
        }),
    });
    robotInfoModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await expect(service.activate('graph-id', 'robot_a')).resolves.toEqual({
      active_graph_name: 'main',
    });
    expect(robotInfoModel.updateOne).toHaveBeenCalledWith(
      { robot_name: 'robot_a' },
      { $set: { active_graph_name: 'main' } },
    );
  });
});
