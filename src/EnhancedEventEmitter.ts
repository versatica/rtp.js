import { EventEmitter } from 'events';

type Events = Record<string, any[]>;

/**
 * @hidden
 * @noInheritDoc
 *
 * TODO: Problem is that static members/methods of EventEmitter class are shown
 *   in all RTP and RTCP classes despite parent class Packet uses @noInheritDoc.
 *   Issue: https://github.com/jonchardy/typedoc-plugin-no-inherit/issues/33
 *   So we override all those members with no inline doc to make TypeDoc not
 *   show them.
 */
export class EnhancedEventEmitter<E extends Events = Events> extends EventEmitter
{
	// NOTE: See TODO above.
	static on(...args: any[])
	{
		// @ts-ignore
		return EventEmitter.on(...args);
	}

	// NOTE: See TODO above.
	static once(...args: any[])
	{
		// @ts-ignore
		return EventEmitter.once(...args);
	}

	// NOTE: See TODO above.
	static listenerCount(...args: any[])
	{
		// @ts-ignore
		return EventEmitter.listenerCount(...args);
	}

	// NOTE: See TODO above.
	static getMaxListeners(...args: any[])
	{
		// @ts-ignore
		return EventEmitter.getMaxListeners(...args);
	}

	// NOTE: See TODO above.
	static setMaxListeners(...args: any[])
	{
		// @ts-ignore
		return EventEmitter.setMaxListeners(...args);
	}

	// NOTE: See TODO above.
	static getEventListeners(...args: any[])
	{
		// @ts-ignore
		return EventEmitter.getEventListeners(...args);
	}

	// NOTE: See TODO above.
	static get captureRejectionSymbol(): typeof EventEmitter.captureRejectionSymbol
	{
		return EventEmitter.captureRejectionSymbol;
	}

	// NOTE: See TODO above.
	static get captureRejections(): typeof EventEmitter.captureRejections
	{
		return EventEmitter.captureRejections;
	}

	// NOTE: See TODO above.
	static get defaultMaxListeners(): typeof EventEmitter.defaultMaxListeners
	{
		return EventEmitter.defaultMaxListeners;
	}

	// NOTE: See TODO above.
	static get errorMonitor(): typeof EventEmitter.errorMonitor
	{
		return EventEmitter.errorMonitor;
	}

	constructor()
	{
		super();
		this.setMaxListeners(Infinity);
	}

	emit<K extends keyof E & string>(eventName: K, ...args: E[K]): boolean
	{
		return super.emit(eventName, ...args);
	}

	/**
	 * Special addition to the EventEmitter API.
	 *
	 * @hidden
	 */
	safeEmit<K extends keyof E & string>(eventName: K, ...args: E[K]): boolean
	{
		const numListeners = super.listenerCount(eventName);

		try
		{
			return super.emit(eventName, ...args);
		}
		catch (error)
		{
			return Boolean(numListeners);
		}
	}

	on<K extends keyof E & string>(
		eventName: K,
		listener: (...args: E[K]) => void
	): this
	{
		super.on(eventName, listener as (...args: any[]) => void);

		return this;
	}

	off<K extends keyof E & string>(
		eventName: K,
		listener: (...args: E[K]) => void
	): this
	{
		super.off(eventName, listener as (...args: any[]) => void);

		return this;
	}

	addListener<K extends keyof E & string>(
		eventName: K,
		listener: (...args: E[K]) => void
	): this
	{
		super.on(eventName, listener as (...args: any[]) => void);

		return this;
	}

	prependListener<K extends keyof E & string>(
		eventName: K,
		listener: (...args: E[K]) => void
	): this
	{
		super.prependListener(eventName, listener as (...args: any[]) => void);

		return this;
	}

	once<K extends keyof E & string>(
		eventName: K,
		listener: (...args: E[K]) => void
	): this
	{
		super.once(eventName, listener as (...args: any[]) => void);

		return this;
	}

	prependOnceListener<K extends keyof E & string>(
		eventName: K,
		listener: (...args: E[K]) => void
	): this
	{
		super.prependOnceListener(eventName, listener as (...args: any[]) => void);

		return this;
	}

	removeListener<K extends keyof E & string>(
		eventName: K,
		listener: (...args: E[K]) => void
	): this
	{
		super.off(eventName, listener as (...args: any[]) => void);

		return this;
	}

	removeAllListeners<K extends keyof E & string>(eventName?: K): this
	{
		super.removeAllListeners(eventName);

		return this;
	}

	listenerCount<K extends keyof E & string>(eventName: K): number
	{
		return super.listenerCount(eventName);
	}

	listeners<K extends keyof E & string>(eventName: K): Function[]
	{
		return super.listeners(eventName);
	}

	rawListeners<K extends keyof E & string>(eventName: K): Function[]
	{
		return super.rawListeners(eventName);
	}

	getMaxListeners(): number
	{
		return super.getMaxListeners();
	}

	setMaxListeners(n: number): this
	{
		super.setMaxListeners(n);

		return this;
	}

	eventNames(): (string | symbol)[]
	{
		return super.eventNames();
	}
}
