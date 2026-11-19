import { DataSource } from 'typeorm';
import { createMarkedOptions } from './utils';

// Function.length does not count a parameter with a default value.
export default function createDataSource(marker = 'default-optional') {
    return new DataSource(createMarkedOptions(marker));
}
