import { DataSource } from 'typeorm';
import { createMarkedOptions } from './utils';

export default function createDataSource() {
    return new DataSource(createMarkedOptions('factory-sync'));
}
