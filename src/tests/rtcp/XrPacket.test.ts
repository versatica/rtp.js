import {
	parseChunk,
	createRunLengthChunk,
	createBitVectorChunk
} from '../../RTCP/XrPacket';

describe('chunks parsing and creation', () =>
{
	const runLengthZerosChunk = 0b0010101010101010;
	const runLengthOnesChunk = 0b0110101010101010;
	const bitVectorChunk = 0b1110101010101010;
	const terminatingNullChunk = 0;

	test('parseChunk()', () =>
	{
		expect(parseChunk(runLengthZerosChunk)).toEqual(
			{
				chunkType : 'run-length',
				runType   : 'zeros',
				runLength : 0b10101010101010
			}
		);

		expect(parseChunk(runLengthOnesChunk)).toEqual(
			{
				chunkType : 'run-length',
				runType   : 'ones',
				runLength : 0b10101010101010
			}
		);

		expect(parseChunk(bitVectorChunk)).toEqual(
			{
				chunkType : 'bit-vector',
				bitVector : 0b110101010101010
			}
		);

		expect(parseChunk(terminatingNullChunk)).toEqual(
			{ chunkType: 'terminating-null' }
		);
	});

	test('createRunLengthChunk()', () =>
	{
		expect(createRunLengthChunk('zeros', 0b10101010101010))
			.toBe(runLengthZerosChunk);

		expect(createRunLengthChunk('ones', 0b10101010101010))
			.toBe(runLengthOnesChunk);

		expect(createBitVectorChunk(0b110101010101010))
			.toBe(bitVectorChunk);
	});
});
