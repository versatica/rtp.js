import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import fastGlob from 'fast-glob';

// Make it explicit that we don't want to include external deps in bundle
// files.
const external = id => !/^[./]/.test(id);

export default [
	// /**
	//  * Create ES and CJS bundle files and their source map files.
	//  */
	// {
	// 	input: 'src/index.ts',
	// 	plugins: [esbuild({ include: /\.ts$/ })],
	// 	output: [
	// 		{
	// 			format: 'es',
	// 			file: 'lib/rtp.js.bundle.mjs',
	// 			sourcemap: true,
	// 		},
	// 		{
	// 			format: 'cjs',
	// 			file: 'lib/rtp.js.bundle.cjs',
	// 			sourcemap: true,
	// 		},
	// 	],
	// 	external: external,
	// },
	// /**
	//  * Create a .d.ts bundle file for TypeScript types.
	//  */
	// {
	// 	input: 'src/index.ts',
	// 	plugins: [dts({ include: /\.ts$/ })],
	// 	output: {
	// 		format: 'es',
	// 		file: 'lib/rtp.js.bundle.d.ts',
	// 	},
	// 	external: external,
	// },

	/**
	 * Create ES and CJS bundles of packets.ts and utils.ts and also source map
	 * files.
	 *
	 * NOTE: We also need to bundle utils/helpers.ts because it's used by
	 * packets.ts and, if not specified, rollup will generate two helpers-xxx.js
	 * files, one ES and another one CJS, and will make Node believe that both
	 * are CJS due to their .js extension.
	 */
	{
		input: ['src/packets.ts', 'src/utils.ts', 'src/utils/helpers.ts'],
		plugins: [esbuild({ include: /\.ts$/ })],
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
	 * Create ES and CJS types bundles of packets.ts and utils.ts.
	 *
	 * NOTE: We also need to bundle utils/helpers.ts because it's used by
	 * packets.ts and, if not specified, rollup will generate two helpers-xxx.js
	 * files, one ES and another one CJS, and will make Node believe that both
	 * are CJS due to their .js extension.
	 */
	{
		input: Object.fromEntries(
			fastGlob
				.globSync(['src/packets.ts', 'src/utils.ts'])
				.map(file => [
					path.relative(
						'src',
						file.slice(0, file.length - path.extname(file).length)
					),

					fileURLToPath(new URL(file, import.meta.url)),
				])
		),
		output: [
			{
				format: 'es',
				dir: 'lib',
				entryFileNames: '[name].d.mts',
			},
			{
				format: 'cjs',
				dir: 'lib',
				entryFileNames: '[name].d.ts',
			},
		],
		plugins: [dts({ include: /\.ts$/ })],
	},
];
