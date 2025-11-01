import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ZonesService } from './zones.service';
import { ProhibitedZone } from './schemas/prohibited-zone.schema';

@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  async create(@Body() createZoneDto: Partial<ProhibitedZone>) {
    try {
      return await this.zonesService.create(createZoneDto);
    } catch (error) {
      throw new HttpException(
        'Failed to create prohibited zone',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll() {
    try {
      return await this.zonesService.findAll();
    } catch (error) {
      throw new HttpException(
        'Failed to fetch prohibited zones',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const zone = await this.zonesService.findById(id);
      if (!zone) {
        throw new HttpException('Zone not found', HttpStatus.NOT_FOUND);
      }
      return zone;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch zone',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('robot/:robotName')
  async findByRobotName(@Param('robotName') robotName: string) {
    try {
      return await this.zonesService.findByRobotName(robotName);
    } catch (error) {
      throw new HttpException(
        'Failed to fetch zones for robot',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateZoneDto: Partial<ProhibitedZone>,
  ) {
    try {
      const updatedZone = await this.zonesService.update(id, updateZoneDto);
      if (!updatedZone) {
        throw new HttpException('Zone not found', HttpStatus.NOT_FOUND);
      }
      return updatedZone;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update zone',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      const deletedZone = await this.zonesService.delete(id);
      if (!deletedZone) {
        throw new HttpException('Zone not found', HttpStatus.NOT_FOUND);
      }
      return {
        message: 'Zone deleted successfully',
        zone: deletedZone,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete zone',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('robot/:robotName')
  async deleteByRobotName(@Param('robotName') robotName: string) {
    try {
      const result = await this.zonesService.deleteByRobotName(robotName);
      return {
        message: `Deleted ${result.deletedCount} zones for robot ${robotName}`,
        deletedCount: result.deletedCount,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to delete zones',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
