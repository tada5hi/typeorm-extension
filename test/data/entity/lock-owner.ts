import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'lock_owner' })
export class LockOwner {
    @PrimaryColumn({ type: 'int' })
    id: number;
}
