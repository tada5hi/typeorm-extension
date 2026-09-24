import {
    Column,
    Entity,
    Index,
    ObjectIdColumn,
} from 'typeorm';
import type { ObjectId } from 'mongodb';

@Entity({ name: 'constraint_document' })
export class ConstraintDocument {
    @ObjectIdColumn()
    _id: ObjectId;

    @Index({ unique: true })
    @Column()
    name: string;
}
