import { readBit,	writeBit } from '../../bitOps';

/**
 * Loss RLE and Duplicate RLE Extended Report chunk info.
 */
export type ExtendedReportChunk =
{
	/**
	 * Chunk type (Run Length Chunk, Bit Vector Chunk or Terminating Null Chunk).
	 */
	chunkType: 'run-length' | 'bit-vector' | 'terminating-null';
	/**
	 * Chunk run type (only set if `chunkType` is 'run-length').
	 */
	runType?: 'zeros' | 'ones';
	/**
	 * Chunk run length (only set if `chunkType` is 'run-length').
	 */
	runLength?: number;
	/**
	 * Chunk bit vector (only set if `chunkType` is 'bit-vector').
	 */
	bitVector?: number;
};

/**
 * Parse given 2 bytes number as a Extended Report chunk.
 */
export function parseExtendedReportChunk(chunk: number): ExtendedReportChunk
{
	if (chunk < 0 || chunk > 0xFFFF)
	{
		throw new TypeError('invalid chunk value');
	}

	if (chunk === 0)
	{
		return { chunkType: 'terminating-null' };
	}

	// Bit Vector Chunk.
	if (readBit({ value: chunk, bit: 15 }))
	{
		return {
			chunkType : 'bit-vector',
			bitVector : chunk & 0b0111111111111111
		};
	}
	// Run Length Chunk.
	else
	{
		return {
			chunkType : 'run-length',
			runType   : readBit({ value: chunk, bit: 14 }) ? 'ones' : 'zeros',
			runLength : chunk & 0b0011111111111111
		};
	}
}

/**
 * Create a Run Length Chunk and return a 2 bytes number representing it.
 */
export function createExtendedReportRunLengthChunk(
	runType: 'zeros' | 'ones',
	runLength: number
): number
{
	if (runLength < 0 || runLength > 16383)
	{
		throw new TypeError('invalid run length value');
	}

	let chunk = runLength;

	chunk = writeBit({ value: chunk, bit: 15, flag: false });
	chunk = writeBit(
		{ value: chunk, bit: 14, flag: runType === 'ones' ? true : false }
	);

	return chunk;
}

/**
 * Create a Bit Vector Chunk and return a 2 bytes number representing it.
 */
export function createExtendedReportBitVectorChunk(bitVector: number): number
{
	if (bitVector < 0 || bitVector > 32767)
	{
		throw new TypeError('invalid bit vector value');
	}

	let chunk = bitVector;

	chunk = writeBit({ value: chunk, bit: 15, flag: true });

	return chunk;
}
