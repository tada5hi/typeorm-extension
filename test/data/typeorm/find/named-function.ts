import { createMarkedOptions } from './utils';

export function createDataSource() {
    throw new Error('A named export must not be called.');
}

export const options = createMarkedOptions('options');
