import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

// Make it explicit that we don't want to include external deps in bundle
// files.
const external = id => !/^[./]/.test(id);

export default [
	/**
	 * Create ES and CJS bundle files and their source map files.
	 */
	{
		input: 'src/index.ts',
		plugins: [esbuild({ include: /\.ts$/ })],
		output: [
			{
				format: 'es',
				file: 'lib/rtp.js.bundle.mjs',
				sourcemap: true,
			},
			{
				format: 'cjs',
				file: 'lib/rtp.js.bundle.cjs',
				sourcemap: true,
			},
		],
		external: external,
	},
	/**
	 * Create a .d.ts bundle file for TypeScript types.
	 */
	{
		input: 'src/index.ts',
		plugins: [dts({ include: /\.ts$/ })],
		output: {
			format: 'es',
			file: 'lib/rtp.js.bundle.d.ts',
		},
		external: external,
	},
];
