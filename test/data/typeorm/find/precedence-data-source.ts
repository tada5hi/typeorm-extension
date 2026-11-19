import { DataSource } from 'typeorm';
import { createMarkedOptions } from './utils';

export const options = createMarkedOptions('options');

export default function createDataSource() {
    return new DataSource(createMarkedOptions('factory'));
}

export const dataSource = new DataSource(createMarkedOptions('data-source'));
