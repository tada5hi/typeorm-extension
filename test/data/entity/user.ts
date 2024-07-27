import {
    Column, Entity, JoinColumn, ManyToOne,
    PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { Role } from './role';

@Unique(['firstName', 'lastName'])
@Entity()
export class User {
    @PrimaryGeneratedColumn()
        id: number;

    @Column()
        firstName: string;

    @Column()
        lastName: string;

    @Column()
        email: string;

    @Column({ nullable: true })
        roleId: number | null;

    @ManyToOne(() => Role, (role: Role) => role.id, { nullable: true })
    @JoinColumn({ name: 'roleId' })
        role: Role;
}
