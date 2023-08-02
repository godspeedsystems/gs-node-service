/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import nodeCleanup from 'node-cleanup';

import amqp, { Channel, Connection } from 'amqplib';

import { GSActor, GSCloudEvent, GSStatus } from '../../../../core/interfaces';

import { logger } from '../../../../core/logger';
import { promClient } from '../../../../telemetry/monitoring';
import { PlainObject } from '../../../../core/common';

// Create rabbitmq metrics
const labels = ['queue', 'status'];
const rabbitmqCount = new promClient.Counter({
    name: 'rabbitmq_events_total',
    help: 'Counter for total rabbitmq events consumed',
    labelNames: labels
});

const rabbitmqDuration = new promClient.Histogram({
    name: 'rabbitmq_events_duration_seconds',
    help: 'Duration of rabbitmq events in seconds',
    labelNames: ['queue', 'status']
});

interface RabbitMQConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    username: string;
    password: string;
    queue: string;
    exchange: string;
    routingKey: string;
    retryCount: number;
}

interface BufferedMessage {
    message: any;
    retryCount: number;
}

export class RabbitmqMessageBus {
    private connection: Connection | null;
    private channel: Channel | null;
    private config: RabbitMQConfig;
    private messageQueue: BufferedMessage[];
    private isPublishing: boolean;
    private isClosing: boolean

    constructor(config: RabbitMQConfig) {
        this.connection = null;
        this.channel = null;
        this.config = config;
        this.messageQueue = [];
        this.isPublishing = false;
        this.isClosing = false;

        nodeCleanup(function () {
            logger.info('calling rabbitmq disconnect...');
            //@ts-ignore
            (async () => await this.closeConnection())();

        }.bind(this));

        this.connect();
        this.handleConnectionClose = this.handleConnectionClose.bind(this);
    }

    public async connect(): Promise<void> {
        try {
            if (this.config.connectionString) {
                this.connection = await amqp.connect(this.config.connectionString);
            } else {
                this.connection = await amqp.connect({
                    hostname: this.config.host,
                    port: this.config.port,
                    username: this.config.username,
                    password: this.config.password
                });
            }
            this.connection.on('close', this.handleConnectionClose);

            this.channel = await this.connection.createChannel();
            logger.info('Connected to RabbitMQ');

            // Publish any buffered messages
            this.processMessageQueue();
        } catch (error) {
            logger.error('Error connecting to RabbitMQ:', error);
            this.scheduleReconnect();
        }
    }
    public async publish(args: { [key: string]: any; }): Promise<void> {
        if (this.channel) {
            await this.channel?.assertQueue(args.queue);
            await this.channel?.assertExchange(args.exchange, 'direct');
            await this.channel?.bindQueue(args.queue, args.exchange, args.routingKey);
            await this.produceMessage(args.data);
        } else {
            this.bufferMessage(args.data);
        }
    }

    public async subscribe(queue: string, datasourceName: string, processEvent: (event: GSCloudEvent) => Promise<any>) {

        queue = queue.split(".")[0];


        try {
            if (!this.channel) {
                await this.connect();
            }
            await this.channel?.consume(
                queue,
                async (msg) => {
                    const labels: PlainObject = { queue };
                    const timer = rabbitmqDuration.startTimer(labels);
                    if (msg !== null) {

                        try {
                            const message = JSON.parse(msg.content.toString());
                            logger.info('Received message: %o', message);
                            const event = new GSCloudEvent('id', `${queue}.${datasourceName}`, new Date(message.timestamp), 'rabbitmq',
                                '1.0', message, 'messagebus', new GSActor('user'), { messagebus: { rabbitmq: this } });

                            const res = await processEvent(event);

                            if (!res) {
                                labels.status = 500;
                                rabbitmqCount.inc(labels);
                                timer();
                                this.channel?.nack(msg);
                            } else {
                                labels.status = 200;
                                rabbitmqCount.inc(labels);
                                timer();
                                this.channel?.ack(msg);
                            }
                        }
                        catch (error) {
                            logger.info('Error parsing message as JSON: %s', error);
                        }
                    }
                }
            );
            logger.info('Consuming messages from %s', queue);
        } catch (error) {
            logger.error('Error consuming messages:', error);
        }
    }

    private async closeConnection(): Promise<void> {
        try {
            this.isClosing = true;
            await this.channel?.close();
            await this.connection?.close();
            logger.info('Connection closed');
        } catch (error) {
            logger.error('Error closing connection:', error);
        }
    }

    private handleConnectionClose(): void {

        logger.warn('Connection to RabbitMQ closed');
        this.channel = null;
        this.connection = null;
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (!this.isClosing) {
            setTimeout(() => {
                this.connect();
            }, 5000); // Reconnect after 5 seconds
        }
    }

    private async produceMessage(message: any): Promise<void> {
        if (this.channel) {
            try {
                await this.channel.publish(
                    this.config.exchange,
                    this.config.routingKey,
                    Buffer.from(JSON.stringify(message))
                );
                logger.info('Message sent:', message);
            } catch (error) {
                logger.error('Error producing message:', error);
                this.bufferMessage(message);
            }
        } else {
            this.bufferMessage(message);
        }
    }

    private bufferMessage(message: any): void {
        const bufferedMessage: BufferedMessage = {
            message,
            retryCount: 0
        };
        this.messageQueue.push(bufferedMessage);
    }

    private async processMessageQueue(): Promise<void> {
        if (!this.isPublishing && this.messageQueue.length > 0) {
            this.isPublishing = true;

            const bufferedMessage = this.messageQueue[0];
            try {
                await this.produceMessage(bufferedMessage.message);
                this.messageQueue.shift();
            } catch (error) {
                logger.error('Error processing buffered message:', error);
                this.handleBufferedMessageError(bufferedMessage);
            }

            this.isPublishing = false;
            this.processMessageQueue();
        }
    }

    private handleBufferedMessageError(bufferedMessage: BufferedMessage): void {
        if (bufferedMessage.retryCount < (this.config.retryCount || 3)) {
            bufferedMessage.retryCount++;
            this.messageQueue.push(bufferedMessage);
        } else {
            logger.error('Max retry attempts reached for buffered message:', bufferedMessage.message);
        }
    }
}
