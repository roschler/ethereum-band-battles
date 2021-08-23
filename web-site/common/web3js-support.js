// This file contains code for commonly used with code that uses the Web3.js interface.

var common_routines = require("./common-routines");

/**
 * This function gets the desired Web3.js provider (E.g. Gananche, or Rinkeby, or Main net, etc.)
 *  from the environment.  It throws an error if a value can not be found.
 *
 * @return {string}
 */
function getWeb3Provider()
{
	let theWeb3Provider = process.env.WEB3JS_PROVIDER;

	if (common_routines.isEmptyString(theWeb3Provider))
		throw new Error("The Web3.js provider was not found in the system environment.");

	return theWeb3Provider;
}

module.exports =
	{
		getWeb3Provider: getWeb3Provider
	};