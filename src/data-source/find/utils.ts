export function removeFileExtension(input: string, extensions: string[]) {
    if(input.includes('.')) {
        const position = input.lastIndexOf('.');
        const extension = input.substring(
            position,
            input.length
        );

        if(extensions.indexOf(extension) !== -1) {
            input = input.substring(0, position);
        }
    }

    return input;
}
