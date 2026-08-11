import {
    Column,
    Entity,
    PrimaryColumn,
    Unique,
} from 'typeorm';

/**
 * Fixture for an entity with a composite primary key
 * and a unique constraint next to it.
 */
@Unique(['name'])
@Entity({ name: 'tenants' })
export class Tenant {
    @PrimaryColumn({ type: 'varchar' })
    region: string;

    @PrimaryColumn({ type: 'varchar' })
    code: string;

    @Column({ type: 'varchar', nullable: true })
    name: string | null;
}
