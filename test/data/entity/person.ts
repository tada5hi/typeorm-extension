import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { Profile } from './profile';

/**
 * Fixture for a unique constraint on a column of an embedded entity, whose
 * property path is nested and differs from its property name.
 */
@Unique(['profile.email'])
@Entity({ name: 'people' })
export class Person {
    @PrimaryGeneratedColumn()
    id: number;

    @Column(() => Profile)
    profile: Profile;
}
