import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One value the database stamps (`createdAt`), one the application writes
 * (`writtenAt`, indexed, so a comparison against it can use the index) and a
 * calendar date (`day`), which has no instant at all.
 */
@Entity()
export class Stamp {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;

    @Index()
    @Column({ nullable: true })
    writtenAt: Date;

    @Column({ type: 'date', nullable: true })
    day: string;
}
