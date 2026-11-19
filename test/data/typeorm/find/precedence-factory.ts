import { DataSource } from 'typeorm';
import { createMarkedOptions } from './utils';

export const options = createMarkedOptions('options');

export default async function createDataSource() {
    return new DataSource(createMarkedOptions('factory'));
}
