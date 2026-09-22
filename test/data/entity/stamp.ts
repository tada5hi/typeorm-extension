import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One value the database stamps (`createdAt`) and one the application
 * writes (`writtenAt`), both in the driver's zone-less date type.
 */
@Entity()
export class Stamp {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ nullable: true })
    writtenAt: Date;
}
