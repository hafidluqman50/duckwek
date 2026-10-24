import { Player } from './Player'
import { AuthNonce } from './AuthNonce'
import { Track } from './Track'
import { PartType } from './PartType'
import { Room } from './Room'
import { RoomPlayer } from './RoomPlayer'
import { PartLicense } from './PartLicense'
import { Payment } from './Payment'
import { Race } from './Race'
import { Duck } from './Duck'
import { Title } from './Title'
import { RaceTick } from './RaceTick'

Track.hasMany(Room, { foreignKey: 'track_id', as: 'rooms' })
Room.belongsTo(Track, { foreignKey: 'track_id', as: 'track' })
Room.hasMany(RoomPlayer, { foreignKey: 'room_id', as: 'players' })
RoomPlayer.belongsTo(Room, { foreignKey: 'room_id', as: 'room' })
Room.hasMany(Race, { foreignKey: 'room_id', as: 'races' })
Race.belongsTo(Room, { foreignKey: 'room_id', as: 'room' })
Room.hasMany(RaceTick, { foreignKey: 'room_id', as: 'ticks' })
RaceTick.belongsTo(Room, { foreignKey: 'room_id', as: 'room' })


export { Player, AuthNonce, Track, PartType, Room, RoomPlayer, PartLicense, Payment, Race, Duck, Title, RaceTick }
