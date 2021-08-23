/**
 * NOTE: All confirmation calls are expected to resolve with a value of  TRUE
 * 	if the relevant Ethereum transaction has been mined (i.e. - written to
 * 	the blockchain ledger) or FALSE if not.
 */

/**
 * This object is used to carry the results of an Ethereum transaction.
 *
 * @param {EnumEthereumTransactionType} - The type of Ethereum transaction type this object
 * 	is a result for.
 * @param {boolean} bSuccessConfirmation - Set the value to TRUE if the Ethereum transaction
 * 	was confirmed successfully, FALSE if not.
 * @param {Object|null} userDataObj - The user defined data object that this transaction result carries.
 * 	May be NULL if one is not required.
 * @param {string} ethereumTransactionTrackingId - A valid Ethereum transaction tracking ID.
 *
 * @constructor
 */
function EthereumTransactionResult(ethTransType, bSuccessConfirmation, userDataObj, ethereumTransactionTrackingId)
{
	let errPrefix = '(EthereumTransactionResult) ';
	
	/** @property {string} - The type of Ethereum transaction this result is for. */
	this.ethereumTransactionType = ethTransType;
	/** @property {boolean} - TRUE if the Ethereum transaction was successfully confirmed, FALSE if not. */
	this.successfulConfirmation = bSuccessConfirmation;
	/** @property {Object} - A user defined object that carries the per-use case "extra" data data
	 * 		an Ethereum transaction requires (i.e. - "user" as in programmer in this context). */
	this.bag = userDataObj;
	/** @property {string} - The tracking ID for the Ethereum transaction this result is for. */
	this.ethereumTransactionTrackingId = ethereumTransactionTrackingId;
	
	// --------------------------- ERROR PROPERTIES --------------------------

	// The following variables are set if an error occurs during processing
	//  after the object has been constructed.  For example, if the Ethereum
	//  transaction failed, the error fields below will be filled in to
	//  let you know what went wrong.
	/** @property {boolean} isErrorResult - If TRUE, an error occurred while
	 * 		waiting for the transaction to be confirmed (mined).
	 */
	this.isErrorResult = false;
	/** @property {string} errorMessage - This field will contain an error
	 * 		message if an error occurred.
	 */
	this.errorMessage = "(none)";
}

module.exports = {
	EthereumTransactionResult: EthereumTransactionResult
}

/*

 * @param {boolean} bIsUpdatedGameDetailsObject - If TRUE, then the client side
 * 	code that receives this transaction result from a PubNub broadcast
 * 	made by the server should update their local copy of the game details
 * 	object from the one contained in this object.
	/** @property {Object} - If TRUE, then the server is telling any client code to update their copy of the game details object with the one
	 * contained in this result.
	this.isUpdatedGameDetailsObj = bIsUpdatedGameDetailsObject;
*/