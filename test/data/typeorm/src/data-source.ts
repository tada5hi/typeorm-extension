import { DataSource } from 'typeorm';
import { createDataSourceOptions } from '../factory';

export const dataSource = new DataSource(createDataSourceOptions());
