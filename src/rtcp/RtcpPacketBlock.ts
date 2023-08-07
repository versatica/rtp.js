export abstract class RtcpPacketBlock
{
	// Buffer view holding the entire block.
	// @ts-ignore ('blockView' has not initializer and is not assigned in constructor).
	protected blockView: DataView;
	// Whether the block has been modified.
	#modified: boolean = false;

	protected constructor(view?: DataView)
	{
		if (view)
		{
			this.blockView = view;
		}
	}

	getView(): DataView
	{
		return this.blockView;
	}

	getByteLength(): number
	{
		return this.blockView.byteLength;
	}

	isModified(): boolean
	{
		return this.#modified;
	}

	setModified(flag: boolean): void
	{
		this.#modified = flag;
	}
}
