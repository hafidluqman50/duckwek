import { EventEmitter } from 'node:events'

/** In-process bus: services announce changes, the socket gateway broadcasts them. */
export const roomEvents = new EventEmitter()
roomEvents.setMaxListeners(50)
