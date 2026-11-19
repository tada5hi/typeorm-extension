import { DataSource } from 'typeorm';
import { createMarkedOptions } from './utils';

export const dataSource = new DataSource(createMarkedOptions('fallback'));
