import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

/**
 * Fixture for an entity with a composite primary key.
 */
@Entity({ name: 'tenants' })
export class Tenant {
    @PrimaryColumn({ type: 'varchar' })
    region: string;

    @PrimaryColumn({ type: 'varchar' })
    code: string;

    @Column({ type: 'varchar', nullable: true })
    name: string | null;
}
