/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export type CHANNEL_TYPE = 'messagebus' | 'REST' | 'gRpc' | 'socket' | 'cron';
export type ACTOR_TYPE = 'user' | 'service'; // One who initializes a distributed request.
export type EVENT_TYPE = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'TRACE' | 'FATAL';

export interface PlainObject {
  [key: string]: any
}