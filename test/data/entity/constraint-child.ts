import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm';
import { ConstraintParent } from './constraint-parent';

@Entity({ name: 'constraint_child' })
export class ConstraintChild {
    @PrimaryColumn({ type: 'int' })
    id: number;

    @Column({ type: 'int' })
    parentId: number;

    @ManyToOne(() => ConstraintParent, { nullable: false })
    @JoinColumn({ name: 'parentId' })
    parent: ConstraintParent;
}
