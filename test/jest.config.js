module.exports = {
    testEnvironment: 'node',
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    moduleFileExtensions: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node",
    ],
    testRegex: '(/unit/.*|(\\.|/)(test|spec))\\.(ts|js)x?$',
    testPathIgnorePatterns: [
        "dist",
        "unit/mock-util.ts"
    ],
    coverageDirectory: 'reports/coverage',
    collectCoverageFrom: [
        'src/**/*.{ts,tsx,js,jsx}',
        '!src/**/*.d.ts',
        '!src/api/utils/**/*.{ts,js}',
        '!src/cli/**/*.{ts,js}',
        '!src/database/**/*.{ts,js}',
        '!src/utils/**/*.{ts,js}',
        '!src/seeder/**/*.{ts,js}',
    ],
    coverageThreshold: {
        global: {
            branches: 59,
            functions: 77,
            lines: 73,
            statements: 74
        }
    },
    rootDir: '../'
};
