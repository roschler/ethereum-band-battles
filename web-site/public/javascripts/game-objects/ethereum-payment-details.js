/**
 * This file contains the object that we use to store the details for an
 * 	Ethereum payment transaction.
 *
 * 	WARNING!: Check to see if this object is actually being used by any other code?
 */
 
// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No. The needed routines should already be in the global namespace.
}
else
{
	// Yes.  Need to require some modules.
	var misc_shared_lib = require('../misc/misc-shared');
}

/**
 * Call this method to validate the fields of a EthereumPaymentDetails object.
 *
 * @param {Object} objToValidate
 *
 */
function validateEthereumPaymentDetailsObj(objToValidate)
{
	var errPrefix = '(validateEthereumPaymentDetailsObj) ';
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');

	if (!objToValidate.methodName)
		throw new Error(errPrefix + 'The method name field is unassigned.');
		
	// All fields must be filled in.
	if (!objToValidate.encodedMethod)
		throw new Error(errPrefix + 'The encoded method field is unassigned.');
		
	if (!objToValidate.from)
		throw new Error(errPrefix + 'The FROM field is empty.');
		
	if (!objToValidate.gasPrice || objToValidate.gasPrice <= 0)
		throw new Error(errPrefix + 'The gas price field is invalid.');
		
	if (!objToValidate.gas || objToValidate.gas <= 0)
		throw new Error(errPrefix + 'The gas field is unassigned.');
		
	if (!objToValidate.valueAsWei)
		throw new Error(errPrefix + 'The value as wei field is unassigned.');
}

/**
 * This object is used to pass around an encoded smart payment method.  It has
 * 	all the details necessary to make an Ethereum smart contract method send() call
 * 	(e.g. - for triggering a Metamask payment, etc.)
 *
 * 	EXAMPLE: callAddPlayer.send({ from: userDetailsObj.ethereumPublicAddress, gasPrice: 20000000000, gas: estimatedGas, value: entryFeeAsWei});
 *
 * @constructor
 */
function EthereumPaymentDetails()
{
	/** @property {string|null} - The method name.  Usually used only for diagnostic and debugging purposes. */
	this.methodName = null;
	
	/** @property {Object|null} - The smart contract method encoded into an Object that can
	 * 	be called to initiate an Ethereum transaction.
	 */
	this.encodedMethod = null;

	/** @property {string|null} - The Ethereum public address to use as the FROM address. */
	this.from = null;
	
	/** @property {number|null} - The gas price. */
	this.gasPrice = null;
	
	/** @property {number|null} - The estimated gas needed to execute the Ethereum transaction. */
	this.gas = null;
	
	/** @property {number|null} - The payment amount in Wei units, required for the transaction. */
	this.valueAsWei = null;
	
	// -------------------- METHODS -----------------------

	/**
	 * Call this function to validate the current details of this object. If
	 * 	any field is invalid, an error will be thrown with the validation
	 * 	problem stored in the error message property.
	 */
	this.validateMe = function()
	{
		return validateEthereumPaymentDetailsObj(this);
	};
}

/**
 * This method takes a JSON string, parses it into a EthereumPaymentDetails object, validates it, and then
 * 	returns it.
 *
 * @param {String} strJson - The EthereumPaymentDetails object in JSON format.
 *
 * @return {Object} - A valid EthereumPaymentDetails object.
 */
function parseJsonStringToEthereumPaymentDetailsObject(strJson)
{
	var errPrefix = '(parseJsonStringToEthereumPaymentDetailsObject) ';
	
	if (misc_shared_lib.isEmptySafeString(strJson))
		throw new Error(errPrefix + 'The JSON string is empty.');
		
	return misc_shared_lib.parseJsonStringToObjectOfType(strJson, EthereumPaymentDetails);
}


// Use code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
    window.EthereumPaymentDetails = EthereumPaymentDetails;
	window.parseJsonStringToEthereumPaymentDetailsObject = parseJsonStringToEthereumPaymentDetailsObject;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			EthereumPaymentDetails: EthereumPaymentDetails,
			parseJsonStringToEthereumPaymentDetailsObject: parseJsonStringToEthereumPaymentDetailsObject
		};
}

