import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant';

/**
 * Fixture for a composite foreign key.
 */
@Entity({ name: 'memberships' })
export class Membership {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', nullable: true })
    tenantRegion: string | null;

    @Column({ type: 'varchar', nullable: true })
    tenantCode: string | null;

    @ManyToOne(() => Tenant, { nullable: true })
    @JoinColumn([
        { name: 'tenantRegion', referencedColumnName: 'region' },
        { name: 'tenantCode', referencedColumnName: 'code' },
    ])
    tenant: Tenant;
}
