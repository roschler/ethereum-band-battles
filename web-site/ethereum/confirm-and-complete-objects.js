/**
 * This module contains the method that builds an Ethereum transaction confirm and complete object.
 */

const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const common_routines = require("../common/common-routines");
const EthTransLifecycle = require('./ethereum-state-machine').EthTransLifecyle;

/** --------------------------------- BEGIN: EthTransConfirmAndComplete ----------------------------------- */

/**
 * Assign an object of this type to a EthTransConfirmAndComplete object if it doesn't need
 * 	a data bag.
 *
 * @constructor
 */
function EmptyDataBag()
{
	/** @property {string} - A simple string property to let us know during debugging this is a proper
	 * 		empty data bag object.
	 */
	this.dummyProperty = '(empty data bag)';
}

/**
 * This object contains the transaction auxiliary elements and functions that
 * 	varies between the different uses for the EthTransLifecycle object.
 *
 * @constructor
 */
function EthTransConfirmAndComplete() {
	var self = this;
	
	/** @property {Object|null} bag - The object required by the transaction that is peculiar to it and not others.
	 * 	For example, most of the EtherBandBattle transactions need access to the game ID and the formatted request
	 * 	nonce used to create the game.
	 *
	 * 	NOTE: Create a new class for each different usage.  It is OK to share bag types (Javascript object
	 * 		types) between usage context as long as the object field properties are identical.
	 *
	 * 	NOTE: If a data bag is no required, assign the EmptyDataBag() object to keep the validateMe()
	 * 		function from throwing an error.
	 */
	this.bag = null;
	
	/** @property {Function|null} funcBuildCurriedMethodCall - The method that is called when
	 * 		building a smart contract method call that actually knows how to build that
	 * 		call for a particular Ethereum transaction.
	 */
	this.funcBuildCurriedMethodCall = null;
	
	/** @property {Promise|null} funcPrerequisitesCheck_promise - The method that is called repeatedly
	 *		until the smart contract is in a certain condition (and perhaps if other
	 *		non-contract conditions are met).  See the lifecycle state machine constants for
	 *		a more detailed explanation.
	 */
	this.funcPrerequisitesCheck_promise = null;
	
	/** @property {Promise|null} funcConfirmTrans_promise - The method that is called repeatedly
	 *		that knows what smart contract method to call to see if the transaction
	 *		was mined/confirmed successfully.
	 */
	this.funcConfirmTrans_promise = null;
	
	/** @property {Promise|null} [funcOnCompletion_promise] - This function will be called when
	 * 		when the transaction completes without a time-out or failure of a promise in the
	 * 		chain of steps involved with executing an Ethereum transaction fully.
	 */
	this.funcOnCompletion_promise = null;
	
	/** @property {Function<boolean>|null} [funcOnError] - MUST NOT BE A PROMISE or ASYNC!
	 * 		This function will be called when when the transaction times-out or
	 * 		if one of the promises in the chain of steps fails.  It returns TRUE if it
	 * 		wants the transaction to be retried, otherwise FALSE is returned.
	 */
	this.funcOnError = null;
	
	/** @property {Function<Eth|null} funcAddDetailsForLogging -
	 * 		Calling this method returns a string intended to be added to any log messages
	 * 			that involve the transaction associated with this object.  The function
	 * 			is expected to take a single EthTransLifecycle parameter.
	 */
	this.funcAddDetailsForLogging = null;
	
	/** @property {boolean} isServerSideTransaction - If TRUE, then the transaction
	 *		object services was created by ther server.  If FALSE, it was created
	 *		by some agent on the client side, like Metamask.
	 */
	this.isServerSideTransaction = null;
	
	/** @property {string} operationDesc - A helpful short description of the transaction. */
	this.operationDesc = null;
	
	/**
	 * This method validates this object's properties.  If one of the properties is
	 * 	invalid, an Error is thrown.
	 *
	 */
	this.validateMe = function () {
		let errPrefix = '(EthTransConfirmAndComplete::validateMe) ';
		
		if (!self.bag)
			throw new Error(errPrefix + 'The data bag is unassigned.  If one is not needed, use the EmptyDataBag object for this property.');
			
		// Validate the data bag.
		self.bag.validateMe();
		
		// Is this is a server side created Ethereum transaction?
		if (self.isServerSideTransaction) {
			// ================================== SERVER SIDE CREATED TRANSACTION ===========
			
			// Yes.  Then we must have a function that helps us build the Ethereum transaction
			//  since we are creating/executing that transaction on the server.
			if (!common_routines.isNonNullFunction(self.funcBuildCurriedMethodCall))
				throw new Error(errPrefix + 'The function that builds the Ethereum smart contract method is invalid and this is a server side transaction.');
		}
		else
		{
			// ================================== CLIENT SIDE CREATED TRANSACTION =============
		
			// No.  Then the function that helps us build a Ethereum transaction
			//  should be NULL since we are NOT creating/executing that transaction
			//  on the server, since that happened on the client side.
			if (common_routines.isNonNullFunction(self.funcBuildCurriedMethodCall))
				throw new Error(errPrefix + 'A function that builds the Ethereum smart contract method was provided which is invalid for a server side transaction.');
				
			// However, we must have the Ethereum transaction hash that Metamask gave the
			//  client side code when the user made a payment.  It should have been
			//  placed in the data bag with a property name of "txHash".
			if (!self.bag.hasOwnProperty("txHashObj"))
				throw new Error(errPrefix + 'The transaction is a client side transaction but the data bag does not have a field property for the expected Metamask transaction hash.');
				
			if (misc_shared_lib.isEmptySafeString(self.bag.txHashObj.transactionHash))
				throw new Error(errPrefix + 'The transaction is a client side transaction but the Metamask transaction object has an empty transaction hash.');
				
			// Client side created transactions can not have a prerequisites check function because the
			//  transaction has already been sent.
			if (common_routines.isNonNullFunction(self.funcPrerequisitesCheck_promise))
				throw new Error(errPrefix + 'Prerequisite check function found for a client side created transaction.  This is not allowed.');
		}
		
		// This function must be NULL or a valid function.
		if (self.funcConfirmTrans_promise !== null && !common_routines.isNonNullFunction(self.funcConfirmTrans_promise))
			throw new Error(errPrefix + 'The function that confirms that the transaction has been successfully'
				+ 'mined/confirmed is invalid.');
		
		// This function must be NULL or a valid function.
		if (self.funcAddDetailsForLogging !== null && !common_routines.isNonNullFunction(self.funcAddDetailsForLogging))
			throw new Error(errPrefix + 'The function that adorns logging messages is invalid.');
			
		// This function must be NULL or a valid function.
		if (self.funcOnCompletion_promise !== null && !common_routines.isNonNullFunction(self.funcOnCompletion_promise))
			throw new Error(errPrefix + 'The function that is called when a transaction completes properly is invalid.');
			
		// This function must be NULL or a valid function.
		if (self.funcOnError !== null && !common_routines.isNonNullFunction(self.funcOnError))
			throw new Error(errPrefix + 'The function that is called when a transaction suffers an error is invalid.');
			
		// Make sure the on-error function if it isn't NULL is not a promise!
		if (self.funcOnError !== null) {
			if (self.funcOnError instanceof Promise)
				throw new Error(
					errPrefix +
					'The function that is called when a transaction suffers an error is a Promise.'
					+ '  This function must not be a Promise or otherwise async in nature!.');
		}
		
		if (self.isServerSideTransaction === null)
			throw new Error(errPrefix + 'The flag that indicates if a transaction was created on the client or server side is not boolean.');
			
		if (misc_shared_lib.isEmptySafeString(self.operationDesc))
			throw new Error(errPrefix + 'The transaction operation description is empty.');
			
	}

	/**
	 * The method initializes the properties of this object.
	 *
	 * @param {boolean} bIsServerSideTransaction - If this transaction was created on
	 * 	server, set this value to TRUE.  If it was created on the client side, set it
	 * 	to FALSE.
	 * @param {Function<EthTransConfirmAndComplete>|null} funcAddDetailsForLogging - The optional function
	 * 	that if present can be called to adorn any log messages generated by this transaction.
	 * 	For example, the EtherBandBattles transactions would want to show the game ID for the
	 * 	transaction.  See the property description in EthTranConfirmAndComplete with the
	 * 	same name as the parameter for further details.  May be NULL.
	 * @param {Function<Contract>|null} funcBuildCurriedMethodCall - A function
	 * 	that accepts a Contract object with its deployment address set
	 * 	as its sole parameter that is expected to return a curried
	 * 	smart contract method for the desired method to be called.  May be NULL
	 * 	and will be NULL for client side created transactions.
	 * @param {Promise<boolean>|null} funcPrerequisitesCheck_promise - The method that is called
	 *  repeatedly until the smart contract is in a certain condition (and perhaps if other
	 *	non-contract conditions are met).  See the lifecycle state machine constants for
	 *	a more detailed explanation.  May be NULL.
	 * @param {Promise<boolean>} funcConfirmTrans_promise - The method that is called repeatedly
	 *	that knows what smart contract method to call to see if the transaction
	 *	was mined/confirmed successfully.
	 * @param {Promise<boolean>|null} funcOnCompletion_promise - The optional function that will be
	 * 	called when the transaction completes or failures.  In the event of a failure, an
	 * 	error object will be passed to the call.  Otherwise NULL will be passed to this
	 * 	function.  May be NULL.
	 * @param {Function<boolean>|null} funcOnError - NOT A PROMISE or ASYNC! The method that is called
	 *  if a transaction times-out or suffers a rejection in one of the promises involved
	 *  with the chain of steps in executing a full Ethereum transaction.  If it is NULL,
	 *  then the default error handler will be called.
	 *
	 *  IMPORTANT!: The on-error handler should return TRUE if it wants the transaction to be
	 *  	retried, FALSE if not!
	 * @param {string} operationDesc - A helpful short description of the transaction.
	 */
	this.initialize = function(
			bIsServerSideTransaction,
			funcAddDetailsForLogging,
			funcBuildCurriedMethodCall,
			funcPrerequisitesCheck_promise,
			funcConfirmTrans_promise,
			funcOnCompletion_promise,
			funcOnError,
			operationDesc) {
			
		let errPrefix = '(EthTransConfirmAndComplete::initialize) ';
		
		this.funcAddDetailsForLogging = funcAddDetailsForLogging;
		this.funcBuildCurriedMethodCall = funcBuildCurriedMethodCall;
		this.funcPrerequisitesCheck_promise = funcPrerequisitesCheck_promise;
		this.funcConfirmTrans_promise = funcConfirmTrans_promise;
		this.funcOnCompletion_promise = funcOnCompletion_promise;
		this.funcOnError = funcOnError;
		this.isServerSideTransaction = bIsServerSideTransaction;
		this.operationDesc = operationDesc;

		this.validateMe(errPrefix);
	}
	
	/**
	 * This method gets a property from the bag of data for this transaction.
	 *
	 * @param {string} propName - The name of the desired data element.
	 *
	 * @return {*} - Returns the value belonging to the given property.
	 */
	this.getPropFromBagByName = function(propName) {
		let errPrefix = '(thTransConfirmAndComplete::getPropFromBagByName) ';
		
		if (misc_shared_lib.isEmptySafeString(propName))
			throw new Error(errPrefix + 'The property name is empty.');

		if (!self.bag[propName])
			throw new Error(errPrefix + 'The Ethereum transaction bag of data object does not contain a property named: ' + propName);
			
		return self.bag[propName];
	}
	
	/**
	 * This method pretty prints a string containing the most useful field elements belonging to this
	 * 	transaction for use in adorning log messages.  The Ethereum State Machine calls this function to get additional
	 * 	information about the transaction the confirm and complete object belongs to.
	 *
	 * @param {EthTransLifecycle} - This input parameter should contain a reference to the lifecycle object
	 * 	that owns this confirm and complete object.
	 */
	this.transactionDetailsForLogging = function(ownerLifecycleObj) {
		let methodName = 'transactionDetailsForLogging';
		let errPrefix = '(' + methodName + ') ';
		
		let retStr = '';
		
		if (!ownerLifecycleObj)
			throw new Error(errPrefix + 'The owner lifecycle object parameter is empty.');
		
		if (!(ownerLifecycleObj instanceof EthTransLifecycle))
			throw new Error(errPrefix + 'The value in the ownerLifecycleObj parameter is not a EthTransLifecycle object.');
			
		// Were we provided an auxiliary object detail printing function?
		if (typeof self.funcAddDetailsForLogging === 'function')
			// Yes.  Call it to get the additional logging details.
			retStr += ' ' + self.funcAddDetailsForLogging(ownerLifecycleObj);
			
		return retStr;
	}

}

/** --------------------------------- END  : EthTransConfirmAndComplete ----------------------------------- */

module.exports = {
	// buildCreateGameObject_coc: buildCreateGameObject_coc,
	EmptyDataBag: EmptyDataBag,
	EthTransConfirmAndComplete: EthTransConfirmAndComplete
}