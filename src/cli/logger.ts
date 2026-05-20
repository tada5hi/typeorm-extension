import process from 'node:process';

export const LogLevel = {
    Silent: 'silent',
    Info: 'info',
    Debug: 'debug',
} as const;
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

export const LOG_LEVEL_VALUES: LogLevel[] = Object.values(LogLevel);

const RANK: Record<LogLevel, number> = {
    [LogLevel.Silent]: 0,
    [LogLevel.Info]: 1,
    [LogLevel.Debug]: 2,
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

const ICON_INFO = 'ℹ';
const ICON_SUCCESS = '✔';
const ICON_WARN = '⚠';
const ICON_ERROR = '✖';
const ICON_DEBUG = '›';

export type Logger = {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    success: (msg: string) => void;
    section: (title: string) => void;
    kv: (key: string, value: string, padTo?: number) => void;
    blank: () => void;
};

export function createLogger(level: LogLevel = LogLevel.Info): Logger {
    const enabled = (target: LogLevel): boolean => RANK[level] >= RANK[target];
    const tty = process.stderr.isTTY;
    const tint = (code: string, text: string) => (tty ? `${code}${text}${RESET}` : text);
    const write = (line: string) => process.stderr.write(`${line}\n`);

    return {
        info: (msg) => {
            if (enabled(LogLevel.Info)) {
                write(`${tint(CYAN, ICON_INFO)} ${msg}`);
            }
        },
        success: (msg) => {
            if (enabled(LogLevel.Info)) {
                write(`${tint(GREEN, ICON_SUCCESS)} ${msg}`);
            }
        },
        warn: (msg) => {
            if (enabled(LogLevel.Info)) {
                write(`${tint(YELLOW, ICON_WARN)} ${msg}`);
            }
        },
        error: (msg) => {
            write(`${tint(RED, ICON_ERROR)} ${msg}`);
        },
        debug: (msg) => {
            if (enabled(LogLevel.Debug)) {
                write(`${tint(DIM, `${ICON_DEBUG} ${msg}`)}`);
            }
        },
        section: (title) => {
            if (enabled(LogLevel.Info)) {
                write('');
                write(tint(`${BOLD}${BLUE}`, title));
            }
        },
        kv: (key, value, padTo = 0) => {
            if (enabled(LogLevel.Info)) {
                const pad = ' '.repeat(Math.max(0, padTo - key.length));
                write(`  ${tint(DIM, key)}${pad}  ${value}`);
            }
        },
        blank: () => {
            if (enabled(LogLevel.Info)) {
                write('');
            }
        },
    };
}

export function normalizeLogLevel(input: string | undefined): LogLevel {
    if (!input) {
        return LogLevel.Info;
    }
    if ((LOG_LEVEL_VALUES as string[]).includes(input)) {
        return input as LogLevel;
    }
    throw new CLIUserError(
        `Unknown log level "${input}". Supported: ${LOG_LEVEL_VALUES.join(', ')}.`,
    );
}

export class CLIUserError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CLIUserError';
    }
}
