/**
 * This file contains code that helps with the usage of the data bags involved with
 * 	executing Ethereum transactions.
 */

const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const EthTransConfirmAndComplete = require('../ethereum/confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthTransLifecycle = require('../ethereum/ethereum-state-machine').EthTransLifecyle;

/**
 * This function takes an Ethereum transaction confirm and complete object and extracts the
 * 	data bag object from it.  It validates the object too.
 *
 * @param {string} objDesc - Simple description field to assist in reporting errors or for logging.
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum transaction
 * 	confirm object.
 * @param {Object} objOfType - The type of object the data bag is.
 * @param {Function|null} funcValidate - If not NULL this function will be called on the
 * 	extracted data bag to validate if.  Otherwise it will not be called.
 *
 * @return {Object}
 */
function getEthTransDataBag(objDesc, confirmAndCompleteObj, objOfType, funcValidate) {
	let errPrefix = '(getEthTransDataBag) ';
	
	if (misc_shared_lib.isEmptySafeString(objDesc))
		throw new Error(errPrefix + ' The object description parameter is empty.');
	
	if (!(confirmAndCompleteObj instanceof EthTransConfirmAndComplete))
		throw new Error(errPrefix + 'The confirm and complete object is unassigned or not the right object type.');
		
	if (typeof objOfType == 'undefined' || objOfType ==  null)
		throw new Error(errPrefix + 'The object of type parameter is unassigned.');
		
	if (!confirmAndCompleteObj.hasOwnProperty('bag'))
		throw new Error(errPrefix + 'The confirm and complete object does not have a property named "bag".');
		
	if (!(confirmAndCompleteObj.bag instanceof objOfType))
		throw new Error(errPrefix + 'The bag object in the confirm and complete object is unassigned or not the right object type for the "' + objDesc + '" transactions.');
		
	// Do we have a validation function?
	if (funcValidate)
		// Validate the data bag before returning it.
		funcValidate(confirmAndCompleteObj.bag);
		
	return confirmAndCompleteObj.bag;
}

module.exports = {
	getEthTransDataBag: getEthTransDataBag
}