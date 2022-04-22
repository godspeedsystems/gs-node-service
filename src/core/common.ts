export type CHANNEL_TYPE = 'messagebus' | 'REST' | 'gRpc' | 'socket';
export type ACTOR_TYPE = 'user' | 'service'; // One who initializes a distributed request.
export type EVENT_TYPE = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'TRACE' | 'FATAL';

export interface PlainObject {
  [key: string]: any
}