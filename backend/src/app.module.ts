import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RobotsModule } from './robots/robots.module';
import { ZonesModule } from './zones/zones.module';
import { MapsModule } from './maps/maps.module';
import { GraphsModule } from './graphs/graphs.module';
import { CommandsModule } from './commands/commands.module';
import { RobotsInfoModule } from './robots-info/robots-info.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/robot_database',
    ),
    RobotsModule,
    ZonesModule,
    MapsModule,
    GraphsModule,
    CommandsModule,
    RobotsInfoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
