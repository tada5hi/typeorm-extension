import { Column } from 'typeorm';

/**
 * Embeddable of the {@see Person} fixture.
 */
export class Profile {
    @Column({ type: 'varchar' })
    email: string;

    @Column({ type: 'varchar', nullable: true })
    nickname: string | null;
}
