"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const Logger_1 = require("./Logger");
const logger = new Logger_1.Logger('EnhancedEventEmitter');
/**
 * @internal
 */
class EnhancedEventEmitter extends events_1.EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(Infinity);
    }
    safeEmit(event, ...args) {
        const numListeners = this.listenerCount(event);
        try {
            return this.emit(event, ...args);
        }
        catch (error) {
            logger.error('safeEmit() | event listener threw an error [event:%s]:%o', event, error);
            return Boolean(numListeners);
        }
    }
    async safeEmitAsPromise(event, ...args) {
        return new Promise((resolve, reject) => {
            try {
                this.emit(event, ...args, (data) => {
                    if (data instanceof Error)
                        reject(data);
                    else
                        resolve(data);
                });
            }
            catch (error) {
                logger.error(`safeEmitAsPromise() | event listener threw an error [event:${event}]:`, error);
                reject(error);
            }
        });
    }
}
exports.EnhancedEventEmitter = EnhancedEventEmitter;
