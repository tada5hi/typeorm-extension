import {
    Column,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Fixture for an optional column under a unique index instead of a unique constraint.
 */
@Entity({ name: 'indexed_keyed_records' })
@Index(['externalKey'], { unique: true })
export class IndexedKeyedRecord {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', nullable: true })
    externalKey: string | null;
}
