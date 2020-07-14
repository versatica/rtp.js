import { EventEmitter } from 'events';
import { Logger } from './Logger';

const logger = new Logger('EnhancedEventEmitter');

/**
 * @internal
 */
export class EnhancedEventEmitter extends EventEmitter
{
	constructor()
	{
		super();
		this.setMaxListeners(Infinity);
	}

	safeEmit(event: string, ...args: any[]): boolean
	{
		const numListeners = this.listenerCount(event);

		try
		{
			return this.emit(event, ...args);
		}
		catch (error)
		{
			logger.error(
				'safeEmit() | event listener threw an error [event:%s]:%o',
				event, error);

			return Boolean(numListeners);
		}
	}

	async safeEmitAsPromise(event: string, ...args: any[]): Promise<any>
	{
		return new Promise((resolve, reject) =>
		{
			try
			{
				this.emit(event, ...args, (data?: any | Error): void =>
				{
					if (data instanceof Error)
						reject(data);
					else
						resolve(data);
				});
			}
			catch (error)
			{
				logger.error(
					`safeEmitAsPromise() | event listener threw an error [event:${event}]:`,
					error
				);

				reject(error);
			}
		});
	}
}
