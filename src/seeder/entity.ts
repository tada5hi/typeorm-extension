import type { Seeder, SeederConstructor } from './type';

export class SeederEntity {
    /**
     * Seeder id.
     * Indicates order of the executed migrations.
     */
    id?: number;

    /**
     * Timestamp of the seed.
     */
    timestamp: number;

    /**
     * Name of the seed (class name).
     */
    name: string;

    /**
     * Constructor that needs to be run.
     */
    instance?: Seeder;

    /**
     * File name of the seeder.
     */
    fileName?: string;

    constructor(ctx: {
        id?: number,
        timestamp: number,
        name: string,
        constructor?: SeederConstructor,
        fileName?: string
    }) {
        this.id = ctx.id;
        this.timestamp = ctx.timestamp;
        this.name = ctx.name;

        if (ctx.constructor) {
            this.instance = new ctx.constructor();
        }

        this.fileName = ctx.fileName;
    }

    isOneTime() {
        return this.instance &&
            typeof this.instance.oneTimeOnly === 'boolean' &&
            this.instance.oneTimeOnly;
    }
}
