/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
	out: 'docs',
	skipErrorChecking: false,
	excludePrivate: true,
	excludeProtected: true,
	excludeNotDocumented: true,
	excludeInternal: true,
	excludeExternals: true,
	includeVersion: true,
	gitRemote: 'origin',
	hideGenerator: false,
	treatWarningsAsErrors: true,
	cacheBust: true,
	categorizeByGroup: false,
	categoryOrder: ['RTP', 'RTCP', 'RTCP Extended Reports', 'Utils', '*'],
	searchInComments: true,
	projectDocuments: ['README.md', 'LICENSE'],
	navigationLinks: {
		GitHub: 'https://github.com/versatica/rtp.js',
		NPM: 'https://www.npmjs.com/package/rtp.js',
	},
	customCss: './docs-assets/custom-styles.css',
};

export default config;
