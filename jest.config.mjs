const config = {
	verbose: true,
	testEnvironment: 'node',
	testRegex: 'src/test/.*.test.mts',
	extensionsToTreatAsEsm: ['.mts'],
	moduleFileExtensions: ['mts', 'mjs', 'js', 'ts'],
	transform: {
		'^.+\\.mts?$': [
			'babel-jest',
			{
				configFile: './babel.config-jest.mjs',
			},
		],
	},
	coveragePathIgnorePatterns: ['src/Logger.mts', 'src/test'],
	cacheDirectory: '.cache/jest',
};

export default config;
