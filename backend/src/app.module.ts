import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { RobotsModule } from './robots/robots.module';
import { ZonesModule } from './zones/zones.module';
import { MapsModule } from './maps/maps.module';
import { GraphsModule } from './graphs/graphs.module';
import { CommandsModule } from './commands/commands.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/robot_database'),
    UsersModule, 
    RobotsModule,
    ZonesModule,
    MapsModule,
    GraphsModule,
    CommandsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
