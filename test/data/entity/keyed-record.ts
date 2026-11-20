import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Fixture for an optional unique column, which may be null on any number of rows.
 */
@Entity({ name: 'keyed_records' })
export class KeyedRecord {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: 'varchar',
        unique: true,
        nullable: true,
    })
    externalKey: string | null;
}
