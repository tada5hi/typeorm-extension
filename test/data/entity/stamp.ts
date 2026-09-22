import { CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A row whose only data is the time the database stamped it with.
 */
@Entity()
export class Stamp {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;
}
