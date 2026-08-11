import {
    Column,
    Entity,
    OneToMany,
    PrimaryColumn,
    Unique,
} from 'typeorm';
import { Membership } from './membership';

/**
 * Fixture for an entity with a composite primary key, a unique constraint next
 * to it, and an inverse relation which owns no join columns.
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

    @OneToMany(() => Membership, (membership: Membership) => membership.tenant)
    memberships?: Membership[];
}
