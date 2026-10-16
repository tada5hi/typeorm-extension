import {
    Column,
    Entity,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm';
import { LockOwner } from './lock-owner';

@Entity({ name: 'lock_item' })
export class LockItem {
    @PrimaryColumn({ type: 'int' })
    id: number;

    @Column({ type: 'varchar', length: 32 })
    status: string;

    // eager and nullable: a joined locked read would be refused by postgres
    @ManyToOne(() => LockOwner, { eager: true, nullable: true })
    owner: LockOwner | null;
}
