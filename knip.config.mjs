/** @type {import('knip').KnipConfig} */
const config = {
	$schema: 'https://unpkg.com/knip@6/schema.json',
	project: ['src/**/*.ts'],
	// TODO: Remove these files from here once they are used.
	ignore: ['src/Logger.ts', 'src/enhancedEvents.ts'],
	ignoreDependencies: [
		// TODO: Remove once src/Logger.ts is used.
		'@types/debug',
		// TODO: Remove once src/enhancedEvents.ts is used.
		'@types/events-alias',
		// TODO: Remove once src/Logger.ts is used.
		'debug',
		// TODO: Remove once src/enhancedEvents.ts is used.
		'events-alias',
		// Used by npm-scripts.mjs as a shell command, which knip doesn't detect.
		'open-cli',
		// Optionally required by debug to enable colors.
		'supports-color',
	],
	tags: ['-knipignore'],
	typescript: {
		config: ['tsconfig.json'],
	},
	jest: {
		config: ['jest.config.mjs'],
		entry: ['src/test/**/*.ts'],
	},
};

export default config;
