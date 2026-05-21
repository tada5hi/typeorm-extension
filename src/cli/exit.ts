import process from 'node:process';
import type { Logger } from './logger';
import { CLIUserError } from './logger';

export const ExitCode = {
    Success: 0,
    UserError: 1,
    InternalError: 2,
} as const;
export type ExitCode = typeof ExitCode[keyof typeof ExitCode];

export async function runWithExitCode(
    logger: Logger,
    fn: () => Promise<void>,
): Promise<void> {
    try {
        await fn();
        process.exit(ExitCode.Success);
    } catch (err) {
        if (err instanceof CLIUserError) {
            logger.error(err.message);
            process.exit(ExitCode.UserError);
        }
        if (err instanceof Error) {
            logger.error(err.stack ?? err.message);
        } else {
            logger.error(String(err));
        }
        process.exit(ExitCode.InternalError);
    }
}
