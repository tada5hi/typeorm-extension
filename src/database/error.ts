export class NotSupportedDriver extends Error {
    constructor(driverName: string) {
        super(`The driver ${driverName} is not supported yet.`);
    }
}
