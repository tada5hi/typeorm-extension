import { pascalCase } from 'pascal-case';

export function buildSeederFileTemplate(
    name: string,
    timestamp: number,
): string {
    const className = `${pascalCase(name)}${timestamp}`;

    return `import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';

export class ${className} implements Seeder {
    track = false;

    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager
    ): Promise<any> {

    }
}
`;
}
