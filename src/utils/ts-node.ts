let isTsNode: boolean | undefined;

/* istanbul ignore next */
export function isTsNodeRuntimeEnvironment() {
    if (typeof isTsNode !== 'undefined') {
        return isTsNode;
    }

    isTsNode = false;

    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (process[Symbol.for('ts-node.register.instance')]) {
            isTsNode = true;
        }
    } finally {
        // ...
    }

    return isTsNode;
}
