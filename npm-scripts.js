const process = require('process');
const { execSync } = require('child_process');

const task = process.argv.slice(2).join(' ');

// eslint-disable-next-line no-console
console.log(`npm-scripts.js [INFO] running task "${task}"`);

switch (task)
{
	case 'typescript:build':
	{
		execute('rm -rf lib');
		execute('tsc');

		break;
	}

	case 'typescript:watch':
	{
		const TscWatchClient = require('tsc-watch/client');

		execute('rm -rf lib');

		const watch = new TscWatchClient();

		watch.start('--pretty');

		break;
	}

	case 'lint':
	{
		execute('eslint -c .eslintrc.js --ext=ts src/ --ignore-pattern \'!.eslintrc.js\' .eslintrc.js');

		break;
	}

	case 'test':
	{
		execute('jest --colors --verbose');

		break;
	}

	case 'coverage':
	{
		execute('jest --colors --verbose --coverage');
		execute('open-cli coverage/index.html');

		break;
	}

	default:
	{
		throw new TypeError(`unknown task "${task}"`);
	}
}

function execute(command)
{
	// eslint-disable-next-line no-console
	console.log(`npm-scripts.js [INFO] executing command: ${command}`);

	try
	{
		execSync(command,	{ stdio: [ 'ignore', process.stdout, process.stderr ] });
	}
	catch (error)
	{
		process.exit(1);
	}
}
