export const LogLevel = {
    Silent: 'silent',
    Info: 'info',
    Debug: 'debug',
} as const;

export const ExitCode = {
    Success: 0,
    UserError: 1,
    InternalError: 2,
} as const;




export type ExitCode = typeof ExitCode[keyof typeof ExitCode];



export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

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
