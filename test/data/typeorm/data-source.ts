import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './factory';

export const options = createDataSourceOptions();

export const dataSource = new DataSource(options);
