import { hasOwnProperty, isTsNodeRuntimeEnvironment } from '../../utils';

type PathOptions = {
    src?: string,
    dist?: string,
};

export function changeTSToJSPath<T>(raw: T, options?: PathOptions) : T {
    const isArray : boolean = Array.isArray(raw);
    const value = Array.isArray(raw) ? raw : [raw];

    options ??= {};
    options.src = options.src || 'src';
    options.dist = options.dist || 'dist';

    for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
            if (
                value[i].indexOf(options.src) !== -1 &&
                value[i].indexOf(options.dist) === -1
            ) {
                const lastIndex = value[i].lastIndexOf(options.src);

                value[i] = value[i].substring(0, lastIndex) +
                    options.dist +
                    value[i].substring(lastIndex + options.src.length);
            }

            if (
                value[i].indexOf('.ts') !== -1 &&
                value[i].indexOf('.js') === -1
            ) {
                value[i] = value[i]
                    .replace('.ts', '.js');
            }
        }
    }

    return isArray ? value : value[0];
}

export function modifyDataSourceOptionForRuntimeEnvironment<
    T extends Record<string, any>,
    K extends keyof T,
>(
    options: T,
    key: K,
    pathOptions?: PathOptions,
): T {
    if (!hasOwnProperty(options, key) || isTsNodeRuntimeEnvironment()) {
        return options;
    }

    switch (key) {
        case 'entities':
        case 'migrations':
        case 'subscribers':
        case 'seeds':
        case 'factories': {
            options[key] = changeTSToJSPath(options[key], pathOptions);
            break;
        }
    }

    return options;
}

export function modifyDataSourceOptionsForRuntimeEnvironment<T extends Record<string, any>>(
    connectionOptions: T,
    options?: PathOptions,
) : T {
    const keys = Object.keys(connectionOptions);

    for (let i = 0; i < keys.length; i++) {
        connectionOptions = modifyDataSourceOptionForRuntimeEnvironment(
            connectionOptions,
            keys[i] as keyof T,
            options,
        );
    }

    return connectionOptions;
}
