import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';

/**
 * Fixture for column names which differ from their property names.
 */
@Unique(['userName', 'tenantId'])
@Entity({ name: 'accounts' })
export class Account {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_name' })
    userName: string;

    @Column({
        name: 'tenant_id',
        type: 'int',
        nullable: true,
    })
    tenantId: number | null;

    @Column({
        name: 'display_name',
        type: 'varchar',
        nullable: true,
    })
    displayName: string | null;
}
