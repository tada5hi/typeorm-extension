import type { Seeder, SeederConstructor } from './type';

export class SeederEntity {
    /**
     * ID of the seeder.
     *
     * Indicates order of the executed seeders.
     */
    id?: number;

    /**
     * Timestamp of the seeder.
     */
    timestamp: number;

    /**
     * Name of the seeder (class name).
     */
    name: string;

    /**
     * Instance of seeder constructor.
     */
    instance?: Seeder;

    /**
     * File name of the seeder.
     */
    fileName?: string;

    /**
     * Result of the executed seeder.
     */
    result?: unknown;

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

    isOneTime() : boolean {
        return !!this.instance &&
            typeof this.instance.oneTimeOnly === 'boolean' &&
            this.instance.oneTimeOnly;
    }
}
