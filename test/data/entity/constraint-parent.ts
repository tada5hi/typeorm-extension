import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'constraint_parent' })
export class ConstraintParent {
    @PrimaryColumn({ type: 'int' })
    id: number;

    @Column({
        type: 'varchar', 
        length: 64, 
        unique: true, 
    })
    name: string;
}
