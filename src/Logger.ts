import debug from 'debug';

const APP_NAME = 'rtp.js';

export class Logger {
	#debug: debug.Debugger;
	#warn: debug.Debugger;
	#error: debug.Debugger;

	constructor(suffix?: string) {
		if (suffix) {
			this.#debug = debug(`${APP_NAME}:${suffix}`);
			this.#warn = debug(`${APP_NAME}:WARN:${suffix}`);
			this.#error = debug(`${APP_NAME}:ERROR:${suffix}`);
		} else {
			this.#debug = debug(APP_NAME);
			this.#warn = debug(`${APP_NAME}:WARN`);
			this.#error = debug(`${APP_NAME}:ERROR`);
		}

		/* eslint-disable no-console */
		this.#debug.log = console.info.bind(console);
		this.#warn.log = console.warn.bind(console);
		this.#error.log = console.error.bind(console);
		/* eslint-enable no-console */
	}

	get debug(): debug.Debugger {
		return this.#debug;
	}

	get warn(): debug.Debugger {
		return this.#warn;
	}

	get error(): debug.Debugger {
		return this.#error;
	}
}
