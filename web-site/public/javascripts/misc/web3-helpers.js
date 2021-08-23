/**
 * This file contains code to help with Web3.js client side pages, including Metamask interaction.
 *
 * This code is only used CLIENT SIDE so the Web3 object should have been injected into the
 * 	global namespace by the Metamask plug-in.  That is why you don't see it being passed
 * 	in to the various functions.
 */
 
const Web3 = require('web3')

/**
 * This function checks to see if the Web3 object has been defined, indicating whether
 * 	or not we have access to the Web3 interface and also Metamask.
 *
 * @return {Web3|null} - Returns a Web3 object if successful.  Throws and
 *  error if not.
 */
function web3AndMetamaskCheck()
{
	let errPrefix = '(web3AndMetamaskCheck) ';
	
	// Metamask no longer injects Web3 into the code space.  Instead,
	//  it can be found in the window.ethereum property, if a Web3
	//  provider is active.
	const ethEnabled = () => {
		if (window.ethereum) {
			window.web3 = new Web3(window.ethereum);
			window.ethereum.enable();
			return true;
		}
		
		return false;
	}
	
	// Has the Web3 object been defined and initialized?
	// if (typeof web3 == 'undefined')
	if (!ethEnabled())
		throw new Error(errPrefix + "The Web3 object is unassigned.");
		
	// Success.
	return window.web3;
}

module.exports = {
	web3AndMetamaskCheck: web3AndMetamaskCheck
}