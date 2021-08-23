// This utility script simply shell executes truffle with various command line
//  parameters and environment variables.  It was created solely for the purpose
//  of allowing us to keep our environment variables in the WebStorm IDE
//  run/debug configurations.

const argv = require('minimist')(process.argv);
const common_routines = require('../common/common-routines');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');

const operationName = argv.operation;
const networkName = argv.network;

const { exec } = require("child_process");

let errPrefix = `(shell-to-truffle.js) `;

try {
	if (misc_shared_lib.isEmptySafeString(operationName))
		throw new Error(errPrefix + `The operationName parameter is empty.`);
		
	if (!['compile', 'migrate'].includes(operationName))
		throw new Error(errPrefix + `Invalid operationName: ${operationName}.`);
	
	if (misc_shared_lib.isEmptySafeString(networkName))
		throw new Error(errPrefix + `The networkName parameter is empty.`);
	
	// Get the network name from the app arguments.
	
	// const cmd = "ls -la";
	const baseCmd = `bash ide-do-truffle.sh`;
	const cmd = `${baseCmd} ${operationName} ${networkName}`;
	
	console.log(`Executing bash command: ${cmd}.`);
	
	exec(
			cmd,
			{
				env: process.env
			},
			(error, stdout, stderr) =>
				{
					if (error) {
						console.log(`error: ${error.message}`);
						return;
					}
					if (stderr) {
						console.log(`stderr: ${stderr}`);
						return;
					}
					console.log(`stdout: ${stdout}`);
				}
		);
}
catch (err)
{
	let errMsg = errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
	
	console.error(errPrefix + err.message);
	throw err;
} // try/catch