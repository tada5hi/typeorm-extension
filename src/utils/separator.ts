export function canReplaceWindowsSeparator(input: string) : boolean {
    // https://superuser.com/questions/176388/why-does-windows-use-backslashes-for-paths-and-unix-forward-slashes/176395#176395
    if (input.startsWith('\\\\?\\')) {
        return false;
    }

    let characterIndex: number;

    const specialCharacters = ['[', '{', '(', '^', '$', '.', '|', '?', '*', '+'];
    for (let i = 0; i < specialCharacters.length; i++) {
        characterIndex = input.indexOf(specialCharacters[i]);
        if (characterIndex !== -1) {
            // special character is prefixed with \, no transformation allowed
            if (characterIndex !== 0 && input[characterIndex - 1] === '\\') {
                return false;
            }
        }
    }

    return true;
}

export function replaceWindowSeparator(input: string) {
    return input.replace(/\\/g, '/');
}

export function safeReplaceWindowsSeparator(input: string): string {
    if (input.indexOf('\\') === -1 || !canReplaceWindowsSeparator(input)) {
        return input;
    }

    return replaceWindowSeparator(input);
}
