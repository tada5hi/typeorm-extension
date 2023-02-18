export function safeReplaceWindowsSeparator(input: string): string {
    if (input.indexOf('\\') === -1) {
        return input;
    }

    let characterIndex: number;

    const specialCharacters = ['[', '{', '(', '^', '$', '.', '|', '?', '*', '+'];
    for (let i = 0; i < specialCharacters.length; i++) {
        characterIndex = input.indexOf(specialCharacters[i]);
        if (characterIndex !== -1) {
            // special character is prefixed with \, no transformation allowed
            if (characterIndex !== 0 && input[characterIndex - 1] === '\\') {
                return input;
            }
        }
    }

    return input.replace(/\\/g, '/');
}
