import * as process from 'node:process';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

const PKG = JSON.parse(fs.readFileSync('./package.json').toString());
const RELEASE_BRANCH = 'master';

const task = process.argv[2];
const args = process.argv.slice(3).join(' ');

run();

async function run() {
	logInfo(args ? `[args:"${args}"]` : '');

	switch (task) {
		// As per NPM documentation (https://docs.npmjs.com/cli/v9/using-npm/scripts)
		// `prepare` script:
		//
		// - Runs BEFORE the package is packed, i.e. during `npm publish` and `npm pack`.
		// - Runs on local `npm install` without any arguments.
		// - NOTE: If a package being installed through git contains a `prepare` script,
		//   its dependencies and devDependencies will be installed, and the `prepare`
		//   script will be run, before the package is packaged and installed.
		//
		// So here we compile TypeScript to JavaScript.
		case 'prepare': {
			buildTypescript({ force: false });

			break;
		}

		case 'typescript:build': {
			installDeps();
			buildTypescript({ force: true });

			break;
		}

		case 'typescript:watch': {
			deleteLib();
			executeCmd(`tsc --watch ${args}`);

			break;
		}

		case 'lint': {
			lint();

			break;
		}

		case 'format': {
			format();

			break;
		}

		case 'test': {
			buildTypescript({ force: false });
			test();

			break;
		}

		case 'coverage': {
			buildTypescript({ force: false });
			executeCmd(`jest --coverage ${args}`);
			executeCmd('open-cli coverage/lcov-report/index.html');

			break;
		}

		case 'release:check': {
			checkRelease();

			break;
		}

		case 'release': {
			checkRelease();
			generateDoc();
			executeCmd('git add doc');
			executeCmd(`git commit -am '${PKG.version}'`);
			executeCmd(`git tag -a ${PKG.version} -m '${PKG.version}'`);
			executeCmd(`git push origin ${RELEASE_BRANCH}`);
			executeCmd(`git push origin '${PKG.version}'`);
			executeCmd('npm publish');

			break;
		}

		case 'doc': {
			generateDoc();
			executeCmd('open-cli doc/index.html');

			break;
		}

		default: {
			logError('unknown task');

			exitWithError();
		}
	}
}

function deleteLib() {
	if (!fs.existsSync('lib')) {
		return;
	}

	logInfo('deleteLib()');

	fs.rmSync('lib', { recursive: true, force: true });
}

function buildTypescript({ force = false } = { force: false }) {
	if (!force && fs.existsSync('lib')) {
		return;
	}

	logInfo('buildTypescript()');

	deleteLib();
	executeCmd('tsc');
}

function lint() {
	logInfo('lint()');

	executeCmd('prettier . --check');

	// Ensure there are no rules that are unnecessary or conflict with Prettier
	// rules.
	executeCmd('eslint-config-prettier .eslintrc.js');

	executeCmd(
		'eslint -c .eslintrc.js --ignore-path .eslintignore --max-warnings 0 .',
	);
}

function format() {
	logInfo('format()');

	executeCmd('prettier . --write');
}

function test() {
	logInfo('test()');

	executeCmd(`jest --silent false --detectOpenHandles ${args}`);
}

function installDeps() {
	logInfo('installDeps()');

	// Install/update deps.
	executeCmd('npm ci --ignore-scripts');
	// Update package-lock.json.
	executeCmd('npm install --package-lock-only --ignore-scripts');
}

function checkRelease() {
	logInfo('checkRelease()');

	installDeps();
	buildTypescript({ force: true });
	lint();
	test();
}

function generateDoc() {
	logInfo('generateDoc()');

	// NOTE: typedoc options are given in tsconfig.json.
	// NOTE: .nojekyll is required, otherwise GitHub pages will ignore
	// generated HTML files with underscore.
	executeCmd('typedoc && touch doc/.nojekyll');
}

function executeCmd(command, exitOnError = true) {
	logInfo(`executeCmd(): ${command}`);

	try {
		execSync(command, { stdio: ['ignore', process.stdout, process.stderr] });
	} catch (error) {
		if (exitOnError) {
			logError(`executeCmd() failed, exiting: ${error}`);

			exitWithError();
		} else {
			logInfo(`executeCmd() failed, ignoring: ${error}`);
		}
	}
}

function logInfo(message) {
	// eslint-disable-next-line no-console
	console.log(`npm-scripts \x1b[36m[INFO] [${task}]\x1b[0m`, message);
}

// eslint-disable-next-line no-unused-vars
function logWarn(message) {
	// eslint-disable-next-line no-console
	console.warn(`npm-scripts \x1b[33m[WARN] [${task}]\x1b[0m`, message);
}

function logError(message) {
	// eslint-disable-next-line no-console
	console.error(`npm-scripts \x1b[31m[ERROR] [${task}]\x1b[0m`, message);
}

function exitWithError() {
	process.exit(1);
}
