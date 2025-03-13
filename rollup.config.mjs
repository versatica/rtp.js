import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

// Make it explicit that we don't want to include external deps in bundle
// files.
const external = ['debug'];

export default [
	/**
	 * Create ES and CJS bundles of packets and utils and also source map
	 * files.
	 *
	 * NOTE: We also need to bundle utils/helpers.ts because it's used by
	 * packets and, if not specified, rollup will generate two helpers-xxx.js
	 * files, ES and CJS, both with .js extension, and will make Node believe
	 * that both are CJS due to their .js extension.
	 */
	{
		input: {
			packets: 'src/packets/public.ts',
			utils: 'src/utils/public.ts',
			'utils/helpers': 'src/utils/helpers.ts',
		},
		plugins: [esbuild()],
		output: [
			{
				format: 'es',
				dir: 'lib',
				entryFileNames: '[name].mjs',
				sourcemap: true,
			},
			{
				format: 'cjs',
				dir: 'lib',
				entryFileNames: '[name].cjs',
				sourcemap: true,
			},
		],
		external: external,
	},
	/**
	 * Create ES and CJS types bundles of packets and utils.
	 */
	{
		input: {
			packets: 'src/packets/public.ts',
			utils: 'src/utils/public.ts',
		},
		plugins: [dts()],
		output: [
			{
				format: 'es',
				dir: 'lib',
				entryFileNames: '[name].d.ts',
			},
		],
		external: external,
	},
];
