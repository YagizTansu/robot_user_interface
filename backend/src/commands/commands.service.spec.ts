import { ConflictException } from '@nestjs/common';
import { CommandsService } from './commands.service';

describe('CommandsService', () => {
  const commandModel = {
    findOne: jest.fn(),
    prototype: { save: jest.fn() },
  };

  const service = new CommandsService(commandModel as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createNavigate throws ConflictException when robot has active command', async () => {
    commandModel.findOne.mockReturnValue({
      exec: () =>
        Promise.resolve({
          robot_name: 'robot_a',
          status: 'in_progress',
        }),
    });

    await expect(
      service.createNavigate({
        robot_name: 'robot_a',
        node_id: 'n1',
        goal: { x: 1, y: 2, z: 0, yaw: 0 },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('getActive returns null when no active command', async () => {
    commandModel.findOne.mockReturnValue({
      sort: () => ({
        exec: () => Promise.resolve(null),
      }),
    });

    await expect(service.getActive('robot_a')).resolves.toBeNull();
  });
});
