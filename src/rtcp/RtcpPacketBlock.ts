export abstract class RtcpPacketBlock
{
	// Buffer view holding the entire block.
	// @ts-ignore ('blockView' has not initializer and is not assigned in constructor).
	protected blockView: DataView;
	// Whether serialization is needed due to recent modifications.
	#serializationNeeded: boolean = false;

	protected constructor(view?: DataView)
	{
		if (view)
		{
			this.blockView = view;
		}
	}

	getView(): DataView
	{
		if (this.needsSerialization())
		{
			this.serialize();
		}

		return this.blockView;
	}

	abstract getByteLength(): number;

	needsSerialization(): boolean
	{
		return this.#serializationNeeded;
	}

	abstract serialize(): void;

	setSerializationNeeded(flag: boolean): void
	{
		this.#serializationNeeded = flag;
	}
}
