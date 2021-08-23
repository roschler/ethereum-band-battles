/**
 * This module contains the new architecture for carefully tracking and managing the
 * 	lifecycle of an Ethereum Transaction:
 *
 * PRIMARY CLASS LIST AND USAGE:
 *
 *  EthTransLifecycle - The object that tracks an Ethereum transaction from start to finish.
 *  EthTransMetaGroup - The object that groups a series of Ethereum transactions that together
 *  	form a larger application level objects.  For example, an EtherBandBattles game, which
 *  	consists of: a game creation, one or more add player, a start game, one or more add
 *  	game round results, etc. group of Ethereum transactions.
 *  EthTransManager - The object that is responsible for driving the entire application level
 * 		execution, tracking, and management of all the Ethereum transactions for the server.
 * 		For example, all the game currently in progress for the EtherBandBattles app.  It maintains
 * 		a collection of EthTransMetaGroup objects (games).
 *
 * NOTE: All state machine step functions are expected to return TRUE if the step is completed
 * 		or FALSE if the step should be called again on the next iteration of the interval
 * 		object in the transaction manager class.  Currently we are not doing anything with
 * 		these values.
 *
 * NOTE: The lifecycle object's execution step promises all return TRUE if the promise
 * 	is completed (success or failure) and FALSE if it is not.  HOWEVER, we are not
 * 	using this value and currently don't need it!  The lifecycle objects control the
 * 	movement between steps by itself.
 *
 * TODO: Currently an Ethereum transaction only has a single time-out value for the entire
 * 	transaction lifecycle.  later, add a more refined approach that has separate time-outs
 * 	for each step.
 */

const common_routines = require('../common/common-routines');
const EthereumGlobals = require('./ethereum-globals').EthereumGlobals;
const ebbDetails = require('../common/contract-details').EtherBandBattlesManager_details;
// const EthereumContractHelper = require('../common/solidity-helpers-misc').EthereumContractHelper;
const EthTransConfirmAndComplete = require('./confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthereumTransactionResult = require('../ethereum/ethereum-transaction-result').EthereumTransactionResult;
const gamemaster_lib = require('../common/game-master');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
// v4 for "random" uuid creation mode.
// const SignedTransactionResult = require('../process/wait-for-ethereum-blocks').SignedTransactionResult;
const Tx = require('ethereumjs-tx');
const uuidv4 = require('uuid/v4');
const moment_lib = require('moment');
const winstonLogger = require('../common/winston-logging-module').winstonLogger;
const logging_helpers_lib = require('../common/logging-helpers');
const PromiseThenBlockSkippedResult = require('../public/javascripts/misc/misc-shared').PromiseThenBlockSkippedResult;

// ----------------------------------------------------------------------

const EnumEthMetaGroupGameOperations = {
	add_player: "add_player",
	add_game_round_result: "add_game_round_result",
	start_game: "start_game",
	game_creation: "game_creation",
	make_payments: "make_payments"
}

// TODO: Get rid of this global variable later.
var g_LastNonceUsed = null;

// ----------------------- DEFAULT VALUES ----------------------
const DEFAULT_GAS_AMOUNT_FOR_ETHTRANS_TESTING = 120000;
const DEFAULT_GAS_PRICE_GWEI = '0x09184e72a000';
const DEFAULT_GAS_LIMIT = 1000;

// The number of times an Ethereum transaction will be retried before giving.
//  At this time we don't know how to do the retry operation so it is set to 0.
const ETHTRANS_MAX_RETRY_COUNT = 0;

/**
 * Set this to FALSE to skip the estimate gas step.
 *
 * 	This should ONLY BE USED FOR TESTING!  The purpose of this flag is to help with
 * 	contract reverts that happen during the estimate gas step.  When this flag is FALSE,
 * 	a large amount of gas will be used instead of trying to estimate it, just so we
 * 	can get a transaction hash to use for debugging purposes.  Reverts that happen
 * 	during an estimate gas call do not generate a transaction hash.  MAKE SURE THIS
 * 	FLAG IS TRUE WHEN IN PRODUCTION!
 */
const IS_GAS_TO_BE_ESTIMATED = true;
// const IS_GAS_TO_BE_ESTIMATED = false;


/**
 * These are the different states a transaction enters.  They are listed
 * 	below in the order of their occurrence during the lifetime of an
 * 	Ethereum transaction.  Some states will be skipped if there is
 * 	no event handler function defined for that state.
 *
 * WARNING: If you change the state LABELS (not values), you MUST update
 * 	the validateEthTrans() function!
 *
 * @type {{STATE_ETL_POLLING_FOR_PREREQUISITES: string, STATE_ETL_READY_TO_SEND: string, STATE_ETL_RAW_TRANSACTION_CHECK: string, STATE_ETL_POLLING_FOR_CONFIRMATION: string, STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER: string, STATE_ETL_FAILED: string, STATE_ETL_SUCCEEDED: string}}
 */
const EnumEthTransLifecyleStates = {
	STATE_ETL_POLLING_FOR_PREREQUISITES: "polling_for_prerequisites",
	// The transaction is polling the smart contract for proof that it has
	//  been mined/confirmed.
 	// The transaction is ready to be sent to the Ethereum network.
	STATE_ETL_READY_TO_SEND: "ready_to_send_transaction",
	// The transaction has already been sent and now we are polling to at
	//  the "raw" transaction level until we get a block mined or failed
	//  notification from the Ethereum network.
	STATE_ETL_RAW_TRANSACTION_CHECK: "raw transaction check",
	// The transaction is waiting for a certain event to occur in the target
	//  smart contract.  For example, waiting for all the add game round result
	//  records to be posted before issuing the process payments transaction
	//	in an EtherBandBattles game.
	STATE_ETL_POLLING_FOR_CONFIRMATION: "polling_for_confirmation",
	// The transaction was confirmed/mined.
	STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER: "do_execute_on_completion_handler",
	// The transaction failed.
	STATE_ETL_FAILED: "transaction failed",
	// The transaction succeeded.
	STATE_ETL_SUCCEEDED: "transaction succeeded"
}

/**
 * Simple conformed helper function to throw an Error indicating that the given state
 * 	is invalid.  It memerely throws the error, it does NOT validate the given state
 * 	as being one of the valid dates.
 *
 * @param {string} callerErrPrefix - The prefix to add to the Error's error message.
 * @param {string|null} state - The state value that caused the error.
 */
function throwUnknownOrInvalidStateError(callerErrPrefix, state)
{
	let useErrPrefix = '(not provided)';
	
	if (misc_shared_lib.isEmptySafeString(callerErrPrefix))
		useErrPrefix = callerErrPrefix;

	if (misc_shared_lib.isEmptySafeString(state))
		throw new Error(useErrPrefix + 'The state field is not set.');
	else
		throw new Error(useErrPrefix + 'Unknown state: ' + state);
}

/**
 * This function returns TRUE if the given state is one of the known state values,
 * 	otherwise FALSE is returned.
 *
 * @param {string} state - The state to validate.
 *
 * @return {boolean}
 */
function isValidEthTransState(state) {
	let errPrefix = '(isValidEthTransState) ';
	
	if (misc_shared_lib.isEmptySafeString(state))
		throw new Error(errPrefix + 'The state parameter is empty.');

	if (state == EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_PREREQUISITES)
		return true;
	if (state == EnumEthTransLifecyleStates.STATE_ETL_READY_TO_SEND)
		return true;
	if (state == EnumEthTransLifecyleStates.STATE_ETL_RAW_TRANSACTION_CHECK)
		return true;
	if (state == EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_CONFIRMATION)
		return true;
	if (state == EnumEthTransLifecyleStates.STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER)
		return true;
	if (state == EnumEthTransLifecyleStates.STATE_ETL_FAILED)
		return true;
	if (state == EnumEthTransLifecyleStates.STATE_ETL_SUCCEEDED)
		return true;
		
	// Invalid sate.
	return false;
}

/*
 * This is the default logging details function for the Ethereum transactions used in
 * 	the EtherBandBattles dApp.
 *
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum
 * 	transaction confirm and complete object.
 *
 * @return {string} - Returns a logging friendly string with details about the
 * 	transaction that are common to all EtherBandBattles transactions.
 *
function defaultLoggingDetailsFunc(confirmAndCompleteObj) {
	let errPrefix = "(defaultLoggingFunc) ";
	
	if (!confirmAndCompleteObj)
		throw new Error(errPrefix + 'The confirm and complete object is unassigned.');
		
	let gameId = confirmAndCompleteObj.getPropFromBagByName(EthereumGlobalConstants.BAG_PROP_GAME_ID);
	let ethTransId = confirmAndCompleteObj.getPropFromBagByName(EthereumGlobalConstants.BAG_PROP_ETHEREUM_TRANSACTION_ID);
		
	return "Game Id(" + gameId + ") -> Transaction ID(" + ethTransId + ')';
}
*/

// TODO: Get rid of this global variable when you can.  It tracks the
//  last nonce we used when submitting an Ethereum transaction for the
//  server Ethereum account.
var g_LastNonceUsed = null;

/**
 * This function builds a promise that broadcasts an Ethereum transaction result to the
 * 	PubNub network.
 *
 * @param {EthereumTransactionResult} ethTransResult - The Ethereum transaction result
 * 	to broadcast.
 *
 * @return {Promise} - Returns a promise that publishes the given transaction result over
 * 	the PubNub network channel associated with the game details object found in the
 * 	transaction result object.
 *
 * @private
 */
function buildBroadcastPromise(ethTransResult) {
	let errPrefix = '(buildBroadcastPromise) ';
	
	if (!ethTransResult)
		throw new Error(errPrefix + 'The Ethereum transaction result object is unassigned.');
	
	if (!ethTransResult.gameDetailsObj)
		throw new Error(errPrefix + 'The Ethereum transaction result object contains an invalid or missing game details object.');
		
	return new Promise(function(resolve, reject) {
		// Execute the PubNub broadcast methods.
		gamemaster_lib.gamemaster.broadcastEthereumTransactionResult_promise(ethTransResult)
		.then(function(result) {
			// The PubNub broadcast promise will return TRUE on a successful broadcast
			//  FALSE if not..
			//
			// TODO: What additional actions can we take here to notify the players
			//	of a most likely temporary problem with our server or the PubNub
			//  network?
			
			// Resolve the promise with the result.
			resolve(result);
		})
		.catch(function(err)
		{
			// Reject the promise with the error received.
			reject(err);
		});
	});
}

/** --------------------------------- BEGIN: EthTransLifecycle ----------------------------------- */

/**
 * The steps executed by this object are:
 *
 * >>>>> SERVER SIDE TRANSACTIONS ONLY:  If the object was generated by the server then the
 * 	steps below will execute, otherwise the following steps are handled by Metamask or an
 * 	equivalent client side entity:
 *
 * 	- Creation and sending of a transaction
 * 	- Waiting for the return of a Tx Hash object from the Ethereum network
 *
 * >>>>> ALL TRANSACTIONS (client side generated and server side too):
 *
 * - (loop) Check for confirmation of the Ethereum transaction by calling a method on the
 * 	relevant smart contract that facilitates that confirmation.
 * - on-success-event-handler: Execute the on-success event handler that takes any necessary
 * 	server side follow-up action after the event completes.  Note, the client side has its
 * 	own mechanism/Object for handling client side follow-up actions.
 * *
 * @constructor
 */

// --------------- EthTransLifecycle STATES ------------------

/**
 * Simple function to validate a numeric argument as a positive number.
 *
 * @param {string} methodName - The method name to use when throwing an error.
 * @param {string{ valueDesc - A short description of the value being validated, for
 * 	creating error messages.
 * @param {number} value - The value to validate.
 */
function validateAsPositiveNumber(methodName, valueDesc, value) {
	let errPrefix = '(validateAsPositiveNumber) ';
	
	let str = '{callingMethod: ' + methodName + '} ';
	
	if (misc_shared_lib.isEmptySafeString(methodName))
		throw new Error(errPrefix + 'The methodName parameter is empty.');
	
	if (misc_shared_lib.isEmptySafeString(valueDesc))
		throw new Error(errPrefix + 'The value description parameter is empty.');
	
	if (typeof value == 'undefined' || value == null)
		throw new Error(str + 'The value parameter is missing.');
	
	if (typeof value != 'number')
		throw new Error(str + 'The ' + valueDesc + ' is not a number.');
	
	if (value < 0)
		throw new Error(str + 'The ' + valueDesc + ' is negative.');
}

/**
 * This is a helper object that stores the fields required from a failed
 * 	transaction to create the new transaction that will execute the retry
 * 	operation.
 *
 * @param {EthTransLifecycle} lifecycleObj - The failed transaction that will
 * 	be retried.
 *
 * @constructor
 */
function PendingRetryRequest(lifecycleObj) {
	let methodName = 'PendingRetryRequest';
	let errPrefix = '(' + methodName + ') ';
	
	if (typeof lifecycleObj == 'undefined')
		throw new Error(errPrefix + 'The lifecycle object parameter is unassigned.');
		
	if (lifecycleObj == null)
		throw new Error(errPrefix + 'The lifecycle object parameter is NULL.');
		
	lifecycleObj.validateMe(methodName);
	
	/** @property {EthTransConfirmAndComplete} -  A valid confirm and complete object. */
	this.confirm_and_complete_obj = lifecycleObj.confirmAndCompleteObj;
	
	/** @property {number} retryCount - The retry count from the failed transaction. */
	this.retry_count = lifecycleObj.retryCount;
	
	/** @property {Array<string>} aryHistoryMessages - An array of history messages to
	 *  	seed the new transaction that will be created from this object. */
	this.aryHistoryMessages = lifecycleObj.aryHistoryMessages;
}

/**
 * This simple object MUST be returned by ALL of the STEP functions in the EthTransLifecycle object.
 * 	It allows us to trace back to the source lifecycle object that produced a particular value
 * 	in the promises array used by the Ethereum state machine polling function.
 *
 * @param {EthTransLifecycle} srcLifecycleObj - A valid Ethereum transaction lifecycle object.
 * @param {boolean} isError - If TRUE, this object is the result of a lifecycle STEP suffering
 * 	an error during execution (i.e. - a promise rejection).  If FALSE, then it is the result
 * 	of the successful execution of the STEP.
 * @param resultOrErrorReturned - The result of the STEP or the error result.
 *
 * @constructor
 */
function LifecycleStepResult(srcLifecycleObj, isError, resultOrErrorReturned) {
	let errPrefix = '(LifecycleStepResult::constructor) ';
	
	var self = this;
	
	if (!srcLifecycleObj)
		throw new Error(errPrefix + 'The source lifecycle object is unassigned.');
		
	if (!(srcLifecycleObj instanceof EthTransLifecycle))
		throw new Error(errPrefix + 'The value given for the source lifecycle object parameter is not an EthTransLifecycle object.');

	/** @property The result of the STEP's execution or the error returned by the STEP. */
	this.result_or_error_returned = resultOrErrorReturned;
	/** @property {boolean} - TRUE if the source STEP errored out, FALSE if it completed successfully. */
	this.is_error = isError;
	/** @property {EthTransLifecycle} - The lifecycle object that owned the STEP. */
	this.source_lifecycle_object = srcLifecycleObj;
}

/**
 * A simple object used for calculating and tracking the time it took for an Ethereum
 * 	transaction to complete or fail.
 *
 * @constructor
 */
function EthTransDuration() {
	let errPrefix = '(EthTransDuration) ';
	
	var self = this;

	/** @property {Date|null} - The time that the transaction started execution at. */
	this.startTime = null;
	/** @property {Date|null} - The time that the transaction ended execution at, whether
	* 	due to success or failure. */
	this.endTime = null;
	
	/**
	 * This function returns the duration in milliseconds between the start and end times this
	 * 	object carries.
	 *
	 * @return {number}
	 */
	this.calcDurationInMilliseconds = function() {
		if (self.startTime == null || self.endTime == null)
			throw new Error(errPrefix + 'Both the start time and end time have not been set yet.');
		if (self.startTime == null)
			throw new Error(errPrefix + 'The start time has not been set yet.');
		if (self.startTime == null || self.endTime == null)
			throw new Error(errPrefix + 'The end time has not been set yet.');
		if (self.startTime > self.endTime)
			throw new Error(errPrefix + 'The start time is greater than the end time.');
			
		let durationMS = self.endTime - self.startTime;
		
		return durationMS;
	}
}

/**
 * This is the object that defines an Ethereum transaction history message.
 *
 * @param {string} callingStepName - The name of the transaction step that added this history message
 * @param {string} message - The history message.
 *
 * @constructor
 */
function EthTransHistoryMessage(callingStepName, message) {
	var self = this;
	
	let errPrefix = '(EthTransHistoryMessage) ';
	
	if (misc_shared_lib.isEmptySafeString(callingStepName))
		throw new Error(errPrefix + 'The calling step name parameter is empty.');
	
	if (misc_shared_lib.isEmptySafeString(message))
		throw new Error(errPrefix + 'The calling message parameter is empty.');
	
	/** @property {Date} - The date/time the log message was added.  We consider the
	 * 	date/time this object was created as the "added" date/time. */
	this.date_time = Date.now();
		
	/** @property {string} - The name of the transaction step that added this history message.  */
	this.calling_step_name = callingStepName;
	
	/** @property {string} - The history message. */
	this.message = message;
	
	/**
	 * This method pretty prints the contents of this object.
	 *
	 * @return {string}
	 */
	this.prettyPrint = function() {
		let strDt = logging_helpers_lib.formatDateTimeForLogging_default(self.date_time);
		
		return '[' + strDt + ' : ' + self.calling_step_name + '] ' + self.message;
	}
}


/**
 * This method takes a transaction STEP and wraps it to provide automatic logging
 * 	of the entry, and the resolution or rejection of the given promise.  Messages
 * 	are added to the transaction's history array.
 *
 * @param {EthTransLifecycle} lifecycleObj - The transaction that owns the STEP found in
 * 	the stepToExec_promise parameter.
 * @param {Promise} stepToExec_promise - The promise that comprises the
 * 	currently execution STEP.
 *
 * @return {EthTransWrappedStep} - Returns an object that has a property named
 * 	 "wrappedStepToExec_promise".  Use that property as the promise to
 * 	 execute since it wraps the original
 * 	 promise containing the STEP to execute with logging/auditing code that
 * 	 provides auto-history capability for the wrapped STEP.
 *
 * @constructor
 */
function EthTransWrappedStep(lifecycleObj, stepToExec_promise) {
	let errPrefix = '(EthTransWrappedStep) ';
	
	let self = this;
	
	// -------------- PARAMETER VALIDATION ------------
	
	if (!lifecycleObj)
		throw new Error(errPrefix + 'The Ethereum transaction parameter is unassigned.');
	
	if (!(lifecycleObj instanceof EthTransLifecycle))
		throw new Error(errPrefix + 'The value in the lifecycleObj parameter is not a EthTransLifecycle object.');
	
	if (!(lifecycleObj instanceof EthTransLifecycle))
		throw new Error(errPrefix + 'The value in the Ethereum transaction parameter is not a lifecycle object.');
	
	if (!stepToExec_promise)
		throw new Error(errPrefix + 'The STEP to execute parameter is unassigned.');
	
	if (!(stepToExec_promise instanceof Promise))
		throw new Error(errPrefix + 'The value in the stepToExec_promise parameter is not a Promise object.');
	
	/** @property {EthTransLifecycle} - The lifecycle object whose STEP we are wrapping. */
	this.lifecycleObj = lifecycleObj;
		
	/** @property {Promise} - The promise we wrap.  DO NOT ACCESS THIS PROPERTY FROM OUTSIDE THIS OBJECT!
	 *
	 * @private
	 */
	this._stepToExec_promise = stepToExec_promise;
	
	/**
	 * {Promise<any>} - This function builds returns a promise that wraps the STEP we execute, the one
	 *  that stored in the stepToExec_promise property.
	 */
	this.buildWrappedStepToExec_promise = function() {
		return new Promise(function wrapStepToExec(resolve, reject) {
			try
			{
				// Log the entering of the promise.
				lifecycleObj.addHistoryMessage(self.lifecycleObj.stepName, 'BEGIN STEP');
				
				// Execute the step now.
				self._stepToExec_promise
				.then(result => {
					// Log the successful resolution of the STEP.
					lifecycleObj.addHistoryMessage(self.lifecycleObj.stepName, 'END STEP -> RESOLVED');
					
					// Pass on the STEP's result.
					resolve(result);
				})
				.catch(err =>  {
					let errMsg =
						errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
					
					// Log the rejection of the STEP.
					lifecycleObj.addHistoryMessage(self.lifecycleObj.stepName, 'END STEP -> REJECTED.  Details: ' + errMsg);
					
					// Pass on the error object from the STEP rejection.
					reject(err);
				});
			}
			catch(err) {
				let errMsg =
					errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
				
				// Log the rejection of the STEP.
				lifecycleObj.addHistoryMessage(self.lifecycleObj.stepName, 'END STEP -> EXCEPTION.  Details: ' + errMsg);
				
				// Pass on the error object from the STEP rejection.
				reject(err);
			}
		});
	}
}


/**
 * This object represents a single Ethereum transaction.
 *
 * @constructor
 */
function EthTransLifecycle() {
	var self = this;

	this._errConstructorPrefix = '(EthTransLifecycle::constructor) ';
	this._errPrefix = '(EthTransLifecycle::constructor::';

	/** @property {string} - Automatically generated unique ID. */
	this.id = uuidv4();
	
	// ----------------- BEGIN: FLAGS ---------------
	
	/** @property {boolean} - The transaction manager uses this field to
	 *		tell if a transaction has been marked as deleted or not.
	 *
	 * WARNING: Do not set this flag to TRUE directly!  Use the
	 *	finalizeBeforeDeletion_polling_func_only() method instead.
	 */
	this.isDeleted = false;
	/** @property {boolean} - After an error occurs SPECIFICALLY DURING
	 * 		THE EXECUTION LOOP (i.e. - not a time-out error) We signal a
	 * 		request to the transaction manager to retry this transaction.
	 */
	this.isRetryRequested = false;
	/** @property {boolean} - If TRUE then the Ethereum transaction timed out before it
	 *		was reported as confirmed/mined.  If not, then it is still in waiting for
	 *		execution, OR it has executed but is not confirmed/mined yet, OR it has
	 *		succeeded.
	 */
	this.isTimedOut = false;
	/** @property {number} - This field will store the amount of time that has elapsed
	 *		since the Ethereum transaction was submitted.  It is used to determine if
	 *		the transaction timed out or not.
	 */
	/** @property {boolean} - This field will be set to TRUE if the transaction
	 *		has already been sent.  FALSE if it has not been sent yet.
	 */
	this.isTransactionSent = null;
	
	// ----------------- END : FLAGS ---------------
	
	
	/** @property {EthTransConfirmAndComplete} - An Ethereum transaction confirm and complete object. */
	this.confirmAndCompleteObj = null;
	/** @property {string} - If an error occurs an error message will be stored here.
	* TODO: Is this field being used?  */
	this.errorMessage = null;
	
	this.timeElapsed_ms = null;
	/** @property {number} - This field will contains the current STATE of the Ethereum
	 *		transaction.
	 */
	this.state = null;
	
	/** @property {number} - This field tracks the number of times a transaction has been
	 * 	retried.
	 */
	this.retryCount = 0;
	
	/** @property {EthTransDuration} - A duration tracking object. */
	this.durationTracker = null;
	
	
	/** @property {WrapTransactionResult} - The object returned by the Web3JS getTransactionCall() during the
	 * 		_rawTransactionCheck_promise STEP, wrapped in a helper object.
	 */
	this.wrappedResultOfGetTransactionCall = null;
	
	/** @property {Object} - The object returned by the Web3JS getTransactionReceiptCall() during the
	 * 		_rawTransactionCheck_promise STEP. wrapped in a helper object.
	 */
	this.wrappedResultOfGetTransactionReceiptCall = null;
	
	/** @property {string} - The name of the STEP that is currently executing, so other code has easy access to it. */
	this.stepName = null;
	
	/** @property {Array<EthTransHistoryMessage>} Array of progress messages that detail
	 * 	the progression of this transaction from start to end, where end is completion
	 * 	OR failure.
	 *
	 */
	this.aryHistoryMessages = new Array();
	
	/**
	 * This method adds a history message to the history message array.
	 *
 	 * @param {string} callingStepName - The name of the transaction step that added this history message.
 	 * 	NOTE: It may be a "pseudo" step name created by code outside of the lifecycle object STEP
 	 * 	handlers for enhanced reporting purposes.
 	 * @param {string} message - The history message.
 	 *
	 */
	this.addHistoryMessage = function(callingStepName, message) {
		let errPrefix = '(addHistoryMessage) ';
		
		let historyMsgObj
			= new EthTransHistoryMessage(callingStepName, message);
		
		self.aryHistoryMessages.push(historyMsgObj);
	}
	
	/**
	 * This function returns a string that contains the entire history message contents
	 * 	for this transaction as of now.
	 *
	 * @return {string}
	 */
	this.prettyPrintHistory = function() {
	
		let errPrefix = '(prettyPrintHistory) ';
		
		let linefeedSymbol = '<CRLF>';
		
		let separator = '-------------------------------- TRANSACTION HISTORY -----------------------' + linefeedSymbol;
		let retStr = '';
		
		for (let ndx = 0; ndx < self.aryHistoryMessages.length; ndx++) {
			retStr += self.aryHistoryMessages[ndx].prettyPrint() + linefeedSymbol;
		}
		
		retStr += separator;
		
		return retStr;
	}
	
	/**
	 * Helper function that builds a decorated log message that contains the calling
	 * 	method name, the STEP name, and a log message.
	 *
	 * @param {string} callerErrPrefix - The calling method's errPrefix variable.
	 * @param {string} logMessage - The log message.
	 *
	 * @return {string} - A fully decorated log message.
	 */
	this.buildStepLogMessage = function(callerErrPrefix, logMessage) {
		let errPrefix = '(buildStepLogMessage) ';
		
		if (misc_shared_lib.isEmptySafeString(callerErrPrefix))
			throw new Error(errPrefix + 'The callerErrPrefix parameter is empty.');
		
		if (misc_shared_lib.isEmptySafeString(self.stepName))
			throw new Error(errPrefix + 'Our stepName property is empty.');
		
		if (misc_shared_lib.isEmptySafeString(logMessage))
			throw new Error(errPrefix + 'The logMessage parameter is empty.');
		
		return callerErrPrefix + ' MESSAGE during STEP: ' + self.stepName + ', ' + logMessage;
	}
	
	/**
	 * Helper function to log a message to the Winston logs.
	 *
	 * @private
	 */
	this._doWinstonLogMessage = function(logMessage) {
		// Add the per-transaction logging custom message found in the transaction's confirm and
		//	complete object.
		let logMessageExt = logMessage + ' ' + self.confirmAndCompleteObj.transactionDetailsForLogging(self);
		winstonLogger.log('info', logMessageExt);
	}
	
	/**
	 * Helper function to log a history message to the Winston logs.
	 *
	 * See this file to find out what the current logging level is:
	 *
	 * PATH: ether-band-battles-work/web-site/common/winston-logging-module.js
	 *
	 * @private
	 */
	this._doWinstonHistoryMessage = function(logMessage) {
		// Add the per-transaction logging custom message found in the transaction's confirm and
		//	complete object.
		let logMessageExt = logMessage + ' ' + self.confirmAndCompleteObj.transactionDetailsForLogging(self);
		winstonLogger.log('verbose', logMessageExt);
	}
	
	/**
	 * Helper function to log an ERROR message to the Winston logs.  Echoes
	 * 	the error message to the console too.
	 *
	 * @private
	 */
	this._doWinstonErrorMessage = function(errMessage) {
		// Add the per-transaction logging custom message found in the transaction's confirm and
		//	complete object.
		let errMessageExt = errMessage + ' ' + self.confirmAndCompleteObj.transactionDetailsForLogging(self);
		winstonLogger.log('error', errMessageExt);
		
		// Echo the error message to the console too.
		console.error(errMessageExt);
	}
	
	/**
	 * Helper function that builds a decorated error message that contains the calling
	 * 	method name, the STEP name, and a error message.
	 *
	 * @param {string} callerErrPrefix - The calling method's errPrefix variable.
	 * @param {Object} err - A Javascript error object.
	 *
	 * @return {string} - A fully decorated error message.
	 */
	this.buildStepErrorMessage = function(callerErrPrefix, err) {
		let errPrefix = '(buildStepErrorMessage) ';
		
		if (misc_shared_lib.isEmptySafeString(callerErrPrefix))
			throw new Error(errPrefix + 'The callerErrPrefix parameter is empty.');
		
		if (misc_shared_lib.isEmptySafeString(self.stepName))
			throw new Error(errPrefix + 'The stepName property is empty.');
		
		if (!err)
			throw new Error(errPrefix + 'The error object is unassigned.');
		
		return callerErrPrefix + ' ERROR during STEP: ' + self.stepName + ', ' + misc_shared_lib.conformErrorObjectMsg(err);
	}
	
	/**
	 * WARNING: This function must ONLY be called by the polling function
	 *
	 * This function does final clean-up measures after a transaction has succeeded
	 * 	or failed (ended).  As a side effect the transaction's deletion flag
	 * 	is set to TRUE.
	 *
	 * @param {string} callerDesc - The code entity that called this method (i.e. -
	 * 	the context that terminated this transaction).
	 */
	this.finalizeBeforeDeletion_polling_func_only = function(callerDesc) {
		let errPrefix = '(finalizeBeforeDeletion_polling_func_only) ';
		
		if (misc_shared_lib.isEmptySafeString(callerDesc))
			throw new Error(errPrefix + 'The callerDesc parameter is empty.');
	
		// The transaction completed.  Mark the end time of the transaction.
		self.durationTracker.endTime = Date.now();
		
		// Add a history message to that effect.
		let durationInMilliseconds = self.durationTracker.calcDurationInMilliseconds();
		let durationInSecondsFractional = durationInMilliseconds / 1000;
		let strNowDate = logging_helpers_lib.formatDateTimeForLogging_default(self.durationTracker.endTime);
		let finalState = self.state;
		let historyMessage =
			'Transaction completed at date/time: '
			+ strNowDate
			+ '.  Duration: '
			+ durationInSecondsFractional
			+ ' seconds.  Final state: '
			+ finalState;

		self.addHistoryMessage(callerDesc, historyMessage);
		
		// Write the full transaction history to the logs.  Note, these log lines will appear
		//  ONLY if the current logging level for the Winston logger is set to VERBOSE.
		//
		// See the _doWinstonHistoryMessage() method for important info on transaction
		//	history logging.
		self._doWinstonHistoryMessage(self.prettyPrintHistory());

		// Mark this transaction as deleted.
		self.isDeleted = true;
	}
	
	/**
	 * This function is called by the setTimeout() call startTransaction() executes.  It 
	 * 	is responsible for moving this transaction through it's component steps.  It is a
	 * 	loop only in the sense that as long as an error does not occur, it will keep
	 * 	scheduling setTimeout() calls to itself until the transaction completes or fails.
	 * 	
	 * @private
	 */
	this._executionLoop = function() {
		let errPrefix = '(executionLoop) ';
		
		try	{
			
			// Loop through the transaction's steps as long as we are not deleted, timed-out,
			//	or completed whether due to success or failure/error.
			// 
			//	NOTE: the time-out/aging code is in the _pollingFunc
			//	method sets this object's time-out flag.
			if (self.isDeleted || self.isTimedOut || self.isTransactionComplete()) {
				// We have failed or are done.  Just get out after logging the event.
				self._doWinstonLogMessage('Transaction finished or failed.  Exiting execution loop.');
				
				// Show the transaction history in the console.
				let strHistory = self.prettyPrintHistory();
				
				console.log(strHistory);
				
				return;
			}
			
			// Get the next STEP to execute as a wrapped promise, which is contained
			//  in our field that contains the EthTransWrappedStep object that wraps
			//  it.
			let wrappedStepObj = self._getWrappedNextStepToExec(null);
			
			wrappedStepObj.buildWrappedStepToExec_promise().then(ignoreResult => {
				// Success.  If we are not in a "succeeded" or "failed" states,
				//  then schedule another call to ourselves.
				if (self.isTransactionComplete()) {
					// --------------- TRANSACTION COMPLETE ----------------
					
					// The transaction completed.  Mark the end time of the transaction.
					self.durationTracker.endTime = Date.now();
					
					// Add a history message to that effect.
					let strNowDate = logging_helpers_lib.formatDateTimeForLogging_default(self.durationTracker.startTime);
					let pseudoStepName = '_executionLoop(SUCCESSFUL COMPLETION)';
					let historyMessage = 'Transaction resolved properly at date/time: '+ strNowDate;
					
					self.addHistoryMessage(pseudoStepName, historyMessage);
					
					// Done.
				}
				
				// The transaction is still "live".
				setTimeout(self._executionLoop, 100);
			})
			.catch(err => {
				// Convert the error to a promise rejection.
				
				let errMsg = self.buildStepErrorMessage(errPrefix, err);
				
				// Log it.
				self._doWinstonErrorMessage(errMsg);
				
				// -------------------- RETRY TRANSACTION CHECK ------------
				
				// Mark the end time of the transaction.
				self.durationTracker.endTime = Date.now();
				
				let strNowDate = logging_helpers_lib.formatDateTimeForLogging_default(self.durationTracker.startTime);
				let pseudoStepName = '_executionLoop(STEP catch block)';
				let historyMessage = 'Transaction failed at date/time: '+ strNowDate;
				
				// Call the error handler while checking to see if a retry is allowed given
				// 	the transaction's current condition.  This method will set the
				//  flag to request a retry if that is the indicated choice.
				if (self.doRetryIfOnErrorRequestsItAndIsAllowed())
					historyMessage += ' - RETRYING.';
				else
					// If a retry was not requested, then the error is treated as "fatal".
					historyMessage += ' - not retrying.';

				self.addHistoryMessage(pseudoStepName, historyMessage);
			});
		}
		catch(err) {
			// Convert the error to a promise rejection.  We do not try to retry transactions
			//  that fail outside the body of the execution loop because it most likely is
			//	is some fundamental architectural problem that needs to be fixed first.
			let errMsg =
				errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
			
			// Mark the end time of the transaction.
			self.durationTracker.endTime = Date.now();
			
			let strNowDate = logging_helpers_lib.formatDateTimeForLogging_default(self.durationTracker.startTime);
			let pseudoStepName = '_executionLoop(OUTER catch block)';
			let historyMessage = 'Transaction failed at date/time: '+ strNowDate;
			
			self.addHistoryMessage(pseudoStepName, historyMessage);
			
			self._doWinstonErrorMessage(errMsg + '  - try/catch');
		}
	}
	
	// --------------------------------- DEFAULT ERROR HANDLER FOR FAILED TRANSACTIONS ---------------
	
	/**
	 * This is the default error handler for failed transactions.
	 *
	 * @return {boolean} - A return OF TRUE tells the caller that we want to retry
	 * 	the transaction.  A return of FALSE tells it we don't.
	 *
	 * @private
	 */
	this._defaultErrorHandler = function() {
		let errPrefix = '(_defaultErrorHandler) ';
		
		// Current this handler does nothing except tell the caller that we DON'T want to
		//  retry the transaction.
		return false;
	}
	
	/**
	 * This function calls the error handler in the Ethereum transactions confirm and complete object,
	 * 	if it has one.  If not, our default error handler is called.
	 *
	 * @return {boolean} - A return OF TRUE signals the caller that we want to retry
	 * 	the transaction.  A return of FALSE tells it we don't.
	 *
	 * @private
	 */
	this._doOnErrorHandler = function() {
		let errPrefix = '(_doOnErrorHandler) ';
		try {
			if (self.confirmAndCompleteObj.funcOnError)
				// Pass on the RETRY or NO-RETRY result from the user defined error handler to the caller.
				return self.confirmAndCompleteObj.funcOnError(self);
			else
				// Pass on the RETRY or NO-RETRY result from the default error handler to the caller.
				return self._defaultErrorHandler();
		}
		catch(err)
		{
			// An error occurred in the error handler.  For now, just log the problem and
			//  continue.
			self._doWinstonErrorMessage(errPrefix + misc_shared_lib.conformErrorObjectMsg(err));
		}
	}
	
	
	/**
	 * This function calls the transaction's on-error handler if it has one, or our default
	 *  handler if it does not have one, to see if the transaction should be retried.  If
	 *  a retry request is indicated by the on-error handler executed, then a check will be
	 *  made first to see if retrying the transaction is allowed given the transaction's
	 *  current condition.  If allowed, then the isRetryRequested flag will be set to TRUE
	 *  to signal the ESM to retry this transaction.
	 *
	 * @return {boolean} - TRUE will be returned if the on-error handler executed requested
	 * 	one AND it is OK to do so given the current condition of the transaction..  FALSE
	 * 	will be returned if the on-error handler did not want to retry the transaction OR
	 * 	if a retry attempt is not allowed.
	 *
	 */
	this.doRetryIfOnErrorRequestsItAndIsAllowed = function() {
		let errPrefix = '(doRetryIfOnErrorRequestsItAndIsAllowed) ';
		
		// Does the on-error handler want to retry the transaction?
		let bRetryRequested = self._doOnErrorHandler();
		
		if (bRetryRequested) {
			// Yes. Are we below the max retry count?
			if (self.retryCount >= ETHTRANS_MAX_RETRY_COUNT)
			{
				// --------------------- MAX RETRY COUNT EXCEEDED  ------------------
				
				// No. Max retry count exceeded.  Cancel the retry request.
				bRetryRequested = false;
				
				// Log the retry count exceeded event.
				let errMsg =
					"The Ethereum transaction with tracking ID('"
					+ self.ethereumTransactionTrackingId
					+ "') can not be retried because the max number of retry attempts have been made."
					+ "  Current retry count: " + self.retryCount.toString();
	
				self._doWinstonErrorMessage(errMsg);
			}
		}
		
		// Retry the transaction?
		if (bRetryRequested) {
			// --------------------- RETRYING TRANSACTION ------------------
			
			// Yes.  Increment the retry count.
			// self.retryCount++;
			
			/* Reset the transaction.
			self.initialize(
				// TODO: Passing back in the confirm and complete object to the initialize() method
				//  feels strange.  Revisit this later.
				self.confirmAndCompleteObj,
				DEFAULT_GAS_LIMIT,
				DEFAULT_GAS_PRICE_GWEI);
			*/
			
			// Set the flag that tells the ESM to retry this transaction.
			self.isRetryRequested = true;
			
			// Increment the retry count.
			self.retryCount++;
			
			//  Log the retry attempt.
			let logMsg =
				"The Ethereum transaction with tracking ID('"
				+ self.ethereumTransactionTrackingId
				+ "') is requesting a retry operation.  Current retry count: "
				self.retryCount.toString();

			self._doWinstonErrorMessage(logMsg);
			
		}
		
		// Return the value of the retry requested flag to the caller.
		return self.isRetryRequested;
	}
	
	/**
	 * This function executes a setTimeout() call to kick off the STEP execution
	 * 	loop for this transaction.  It does this instead of executing the loop directly
	 * 	so the calling code is not held up waiting for the transaction to complete.
	 */
	this.startTransaction = function() {
		// Mark the time that execution began at.
		self.durationTracker = new EthTransDuration();
		self.durationTracker.startTime = Date.now();
		
		let strStartDate = logging_helpers_lib.formatDateTimeForLogging_default(self.durationTracker.startTime);
	
		// Add a message to the transaction history describing the transaction.
		self.addHistoryMessage(
			'startTransaction',
			' Starting execution of transaction('
			+ self.confirmAndCompleteObj.operationDesc
			+ ') with ID ('
			+ self.id
			+ ' at date/time: '
			+ strStartDate);
		
		setTimeout(self._executionLoop, 100);
	}
	
	/**
	 * Changes the state of the transaction to that given and performs any other useful or
	 * 	necessary operations, like logging, etc.
	 *
	 * NOTE: Always use this function to change the state.  Do not change it directly!
	 * @param newState
	 *
	 * @private
	 */
	this._changeState = function(newState) {
		let methodName = 'changeState';
		let errPrefix = '(' + methodName + ') ';
		
		if (newState == EnumEthTransLifecyleStates.STATE_ETL_FAILED)
			throw new Error(errPrefix + 'The transaction is in a failed state: STATE_ETL_FAILED.');
		
		if (misc_shared_lib.isEmptySafeString(newState))
			throw new Error(errPrefix + 'The new state is empty.');
		
		if (!isValidEthTransState(newState))
			throw new Error(errPrefix + 'The newState parameter is not a valid.');
		
		let oldState = self.state;
		self.state = newState;
		
		let logMsg = 'STATE CHANGE -> from: ' + oldState + ', to: ' + newState + '.';
		
		self.addHistoryMessage(methodName, logMsg);
		
		self._doWinstonLogMessage(logMsg);
	}
	
	
	/**
	 * This function makes sure that certain object level fields required by many
	 * 	the methods used in this object have been set properly, otherwise those
	 * 	methods can not function.
	 */
	this.validateMe = function(caller)
	{
		if (misc_shared_lib.isEmptySafeString(caller))
			caller = '(not set)';
			
		let errPrefix = self._errPrefix + 'validateMe called by' + caller + ')';
		
		// Deleted transactions are not valid transactions, even if they have all
		//  the proper fields filled in.
		if (self.isDeleted)
			throw new Error('This transaction is deleted.');
			
		// Transactions that have timed out are not valid transactions, even if they have all
		//  the proper fields filled in.
		if (self.isTimedOut)
			throw new Error('This transaction has timed out.');
			
		if (!self.confirmAndCompleteObj)
			throw new Error(errPrefix + 'The confirm and complete object is unassigned.');
			
		// Validate it.
		self.confirmAndCompleteObj.validateMe();
		
		// if (misc_shared_lib.isEmptySafeString(self.gameId))
		//	throw new Error(errPrefix + 'The game ID field has not been set.');
			
		if (self.state === null)
			throw new Error(errPrefix + 'The state is not set.');
			
		if (self.timeElapsed_ms === null)
			throw new Error(errPrefix + 'The time elapsed in milliseconds value is not set.');
	}
	
	/**
	 * Initialize an Ethereum transaction object.
	 *
	 * WARNING: DO NOT RESET THE RETRY COUNT OR THE MAX RETRY COUNT CHECK WILL NEVER EXECUTE!
	 *
	 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum
	 * 	transaction confirm and complete object.
	 * @param {number} gasLimit - The maximum gas allowed for the transaction.
	 * @param {string} gasPriceGwei - The gas price in Gwei units in string format.
	 *
	 */
	this.initialize = function(
			confirmAndCompleteObj,
			gasLimit,
			gasPriceGwei) {
			
		let caller = 'initialize';
		let errPrefix = '(' + caller + ') ';
		
		if (!confirmAndCompleteObj)
			throw new Error(errPrefix + 'The Ethereum transaction confirm and complete object is unassigned.');
			
		// Validate the confirm and complete object.
		confirmAndCompleteObj.validateMe();
		
		self.confirmAndCompleteObj = confirmAndCompleteObj;
		
		self.timeElapsed_ms = 0;
		
		// Server side transaction?
		if (self.confirmAndCompleteObj.isServerSideTransaction)
		{
			// --------------------------------- SERVER SIDE CREATED TRANSACTION ----------------
			
			// We are now ready to send the underlying Ethereum transaction. Do we have a prerequisites check function?
			if (common_routines.isNonNullFunction(self.confirmAndCompleteObj.funcPrerequisitesCheck_promise))
				// Yes.  Set the initial state to execute the Prerequisite check first.
				self.state = EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_PREREQUISITES;
  			else
				// No.  Set the state to the ready-to-send state.
				self.state = EnumEthTransLifecyleStates.STATE_ETL_READY_TO_SEND;
			
			// Server side transactions start out with the transaction-sent flag as FALSE
			//  because we have not sent it yet.
			self.isTransactionSent = false;
		}
		else
		{
			// --------------------------------- CLIENT SIDE CREATED TRANSACTION ----------------
			
			// Skip the ready to send step since the client created and sent the transaction
			// 	to the Ethereum network.
			
			// No.  Set the initial state to the raw transaction check..
			self.state = EnumEthTransLifecyleStates.STATE_ETL_RAW_TRANSACTION_CHECK;
				
			// Client side transactions start out with the transaction-sent flag as TRUE
			//  because the client has already sent the transaction.
			self.isTransactionSent = true;
		}
		
		// Make sure everything is in order so we can properly execute.
		self.validateMe(caller);
		
		let str = self.confirmAndCompleteObj.isServerSideTransaction ? 'server side ' : ' client side';
		
		self._doWinstonLogMessage(
			'info',
			'New lifecycle object created.  : '
				+ '.  Transaction source: ' + str);
	}
	
	/**
	 * Common handling for errors that occur during this transactions lifecycle.
	 *
	 * @param {Function} rejectFunc - A valid Promise reject function.
	 * @param {Error} err - An error object or an error message.
	 * @param {string}  errSuffix - A suffix to attach to the main error message.
	 *
	 * @private
	 */
	this._rejectTransactionPromise = function(rejectFunc, err, errSuffix)
	{
		let errPrefix = '(_rejectTransactionPromise) ';
		
		let errMsg = misc_shared_lib.conformErrorObjectMsg(err);
		
		if (misc_shared_lib.isEmptySafeString(errMsg))
			throw new Error(errPrefix + 'Missing error message suffix.');
			
		if (!common_routines.isNonNullFunction(rejectFunc))
			throw new Error(errPrefix + 'The promise level reject function is invalid.');

		self._doWinstonErrorMessage(errMsg + errSuffix);
		
		// Set the state to the failure state.
		self._changeState(EnumEthTransLifecyleStates.STATE_ETL_FAILED);
		// self.state = EnumEthTransLifecyleStates.STATE_ETL_FAILED;
		self.errorMessage = errMsg;
		
		// Now call the calling promise's rejection function.
		rejectFunc(errMsg);
		
		// Pass back an error object that carries a reference back to this lifecycle object
		//  so we can trace.
		// return new LifecycleStepResult(self, true, errMsg);
	}
	
	/**
	 * Send this Ethereum transaction to the Ethereum network.
	 *
	 * @param {Array|null} opts - Array of options that can be used to overwrite various
	 * 	default values used by this method.
	 *
	 * @return {Promise<Object>}
	 */
	this._sendTransaction_promise = function(opts) {
		let methodName = '_sendTransaction_promise';
		let errPrefix = '(' + methodName + ') ';
		
		self.validateMe(errPrefix);
		
		return new Promise(function(resolve, reject) {
			try {
				// TODO: Putting this here instead of at the top because at the top, otherwise it executes
				//  before the singleton that ebbDetails derives from hasn't been built yet.
				// const ebbDetails = require('../common/contract-details').EtherBandBattlesManager_details;
				let gasPriceGwei = DEFAULT_GAS_PRICE_GWEI;
				let gasLimit = DEFAULT_GAS_LIMIT;
				
				if (opts && opts.hasOwnProperty('gasPriceGwei'))
					gasPriceGwei = opts.gasPriceGwei;
					
				if (opts && opts.hasOwnProperty('gasLimit'))
					gasLimit = opts.gasLimit;
			
				let encodedAbiForCall = null;
				
				// Actual nonce value will be determined below by querying the Ethereum network for the
				//  transaction count for the desired public address/account.
				let fromNonce = 0;
				
				let serializedTx = null;
	
				let rawTx = null;
				
				let ethStatusMsg = '(none)';
	
				// Make sure we have enough funds for this transaction.
				let actualAccountBalance = 0;
				
				console.log(errPrefix + `Sending transaction using public address: ${EthereumGlobals.ebbContractHelperObj.publicAddr}.`);
				
				EthereumGlobals.web3Global.eth.getBalance(EthereumGlobals.ebbContractHelperObj.publicAddr)
				.then(result => {
					actualAccountBalance = result;
					
					console.log(
						errPrefix
						+ 'Actual balance at time of sending the ('
						+ self.confirmAndCompleteObj.operationDesc
						+ ') transaction is: '
						+ actualAccountBalance);
					
					// Get a nonce using the public key by using the current transaction count
					//  for that key/account.
					return EthereumGlobals.getNonce_promise();
				})
				.then(function(result)
				{
					// We have a nonce now.  Save it.
					fromNonce = result;
					
					let contractMethodToCall = self.confirmAndCompleteObj.funcBuildCurriedMethodCall(EthereumGlobals.ebbContractInstance);
					
					encodedAbiForCall = contractMethodToCall.encodeABI();
					
					let useGasLimit = 1500000;
					
					if (IS_GAS_TO_BE_ESTIMATED) {
						// We're estimating gas.  Do that now.
						// console.log("ESTIMATING GAS: gas price in gwei: " + gasPriceGwei);
						// console.log("ESTIMATING GAS: gas limit: " + gasLimit);

						// Estimate gas usage for the transaction.
						// return contractHelperObj.contractInstance.methods.getNumGamesCreated().estimateGas(estimateOptions);
						// TODO: Can we do better than using the current hard-coded values?
						// TODO: What happens if we call a payable method where we need to pass a value?
						return contractMethodToCall.estimateGas({ from: EthereumGlobals.ebbContractHelperObj.publicAddr, gasPrice: DEFAULT_GAS_PRICE_GWEI, gas: useGasLimit});
					}
					else
					{
						console.warn(
							'GAS ESTIMATION IS DISABLED.  Using gas price of('
							+ DEFAULT_GAS_PRICE_GWEI.toString()
							+ ') and gas limit of ('
							+ useGasLimit.toString()
							+ ').');
												// We are not estimating gas.  Use some reasonably large amount of
						//  gas so that the call goes through, but not so large we can't
						//  afford it or we exceed the target Ethereum network's limit.
						return DEFAULT_GAS_AMOUNT_FOR_ETHTRANS_TESTING;
					}
				})
				.then(function(result) {
					if (result <= 0)
						throw new Error("The estimated gas for the transaction is zero.");
						
					// The result contains the estimated gas required to send the transaction
					//  on the current Ethereum network.  Pass the value by our fixer function
					//  for that value.
					let estimatedGas = solidity_helpers_misc.fixEstimatedGas(
						self.confirmAndCompleteObj.operationDesc, EthereumGlobals.ethereumNetworkId, result);
						
					console.warn(
						'GAS AMOUNT('
						+ self.confirmAndCompleteObj.operationDesc
						+ ') Using the following gas amount: '
						+ estimatedGas.toString());
					
					rawTx = {
						nonce: fromNonce,
						gasPrice: gasPriceGwei,
						// Use the estimated gas.
						gasLimit: estimatedGas,
						// Adding both gas and gasLimit just in case.
						gas: estimatedGas,
						to: EthereumGlobals.ebbContractHelperObj.contractAddr,
						value: '0x00',
						data: encodedAbiForCall
					}
					
					ethStatusMsg =
						errPrefix +
						'Created raw transaction for for operation('
						+ '>>>>>'
						+ self.confirmAndCompleteObj.operationDesc
						+ '<<<<<'
						+').  Nonce: '
						+ fromNonce
						+ ', gas price(gwei): '
						+ gasPriceGwei
						+ ', estimatedGas: '
						+ estimatedGas;
						
					console.log(ethStatusMsg);
					self._doWinstonLogMessage(ethStatusMsg);
					
					let tx = new Tx(rawTx);
					
					// Sign the transaction.
					tx.sign(EthereumGlobals.ebbContractHelperObj.privateKeyBuffer);
					
					serializedTx = '0x' + tx.serialize().toString('hex');
					
					// Send it.
					return EthereumGlobals.web3Global.eth.sendSignedTransaction(serializedTx);
				}).then(result => {
					let txHashObj = result;
					
					// Store the transaction hash in the data bag.
					self.confirmAndCompleteObj.bag.txHashObj = txHashObj;
					
					let logMsg =
						errPrefix +
						'Received the following transaction hash for the operation('
						+ self.confirmAndCompleteObj.operationDesc
						+ '): '
						+ txHashObj.transactionHash;
						
					// Put the transaction hash in the data bag for later use.
					self.confirmAndCompleteObj.bag.txHash = txHashObj.transactionHash;
						
					self.addHistoryMessage(methodName, logMsg);
					console.log(logMsg);
						
					// let signedTransResult = new SignedTransactionResult(txHashObj, fromNonce, self.operationDesc);
					// resolve(signedTransResult);
					
					// Set the flag that lets others know the transaction was successfully sent.
					self.isTransactionSent = true;
					
					// Transaction sent.  Advance to the next state.
					self._advanceState();
					
					resolve(new LifecycleStepResult(self, false, true));
				})
				.catch(function(err)
				{
					self._rejectTransactionPromise(reject, err, ' - promise');
				});
			}
			catch(err)
			{
				self._rejectTransactionPromise(reject, err, ' - try/catch');
			}
		});
	}
	
	/**
	 * Returns a promise that checks with the smart contract to see if
	 *  the smart contract has reached a certain state that may be needed
	 *  for the current transaction to execute.  See the lifecycle
	 *  state enumerator for more details.
	 *
	 * @param {Array|null} opts - An array of options that can be used to overwrite various
	 * 	default values used by this method.
	 *
	 * NOTE: prerequisite check promises are expected to return boolean TRUE if the
	 * 	conditions for the prerequisites check have been met (i.e. - satisfied),
	 * 	FALSE if not.
	 *
	 * @return {Promise<Object>}
	 */
	this._checkForPrerequisites_promise = function(opts) {
		let errPrefix = '(_checkForPrerequisites_promise) ';
		
		self.validateMe(errPrefix);
		
		return new Promise(function(resolve, reject) {
			try {
				
				self.confirmAndCompleteObj.funcPrerequisitesCheck_promise(self)
				.then(result => {
					if (typeof result !== 'boolean')
						throw new Error(errPrefix + 'The result of the prerequisites check function was not boolean.');
						
					if (result) {
						// Transaction sent.  Advance to the next state.
						self._advanceState();
					}
					
					// Pass the result on.
					resolve(new LifecycleStepResult(self, false, result));
				})
				.catch(function(err)
				{
					self._rejectTransactionPromise(reject, err, ' - promise');
				});
			}
			catch(err)
			{
				self._rejectTransactionPromise(reject, err, ' - try/catch');
			}
		});
	}
	
	/**
	 * Returns a promise that checks with the Ethereum network to see if
	 * 	this transaction has been confirmed/mined yet, or if it has failed.
	 *
	 * @param {Array|null} opts - Array of options that can be used to overwrite various
	 * 	default values used by this method.
	 *
	 * @return {Promise<LifecycleStepResult>}
	 */
	this._rawTransactionCheck_promise = function(opts) {
		let methodName = '_rawTransactionCheck_promise';
		let errPrefix = '(' + methodName + ') ';
		
		
		self.validateMe(errPrefix);
		
		return new Promise(function(resolve, reject) {
			try {
				// Validate the data bag.
				self.confirmAndCompleteObj.bag.validateMe();
			
				// Get the transaction hash from the data bag.
				let txHash = self.confirmAndCompleteObj.bag.txHashObj.transactionHash;
				
				if (misc_shared_lib.isEmptySafeString(txHash))
					throw new Error(errPrefix + 'The transaction hash is empty.');
				
				// The block number from the result of the getTransaction() call.
				let blockNumber_1 = null;
				// The block number from the result of the getTransactionReceipt() call.
				let blockNumber_2 = null;
				let rawTransactionStatus = null;
				
				// We must have a "success" property in our result object. Pass on the onCompletionResult
				//  for logging purposes.
				let rawTransactionCheckResultObj =
					{
						// We duplicate the success result in the is_confirmed_as_mined property for more
						// informative log messaging purposes.
						is_confirmed_as_mined: false,
						success: false
					}
				
				// TODO: If the result of sending a signed transaction is the exact same result as what
				//	we get back from the getTransaction() below, then we may be able to skip the call below
				//  if store the result of the send-signed-transaction call, but only if there is no
				//  new useful information that comes back from the call below that may not be in the
				//	result object that comes back from the send-signed-transaction call.
				
				// First, use the getTransaction() call to determine if the block has been confirmed/mined
				//  yet.
				EthereumGlobals.web3Global.eth.getTransaction(txHash)
				.then(result => {
					// Wrap the result in a helper object to make it easier to handler.
					let wrappedResult = new solidity_helpers_misc.WrapTransactionResult(result);
					
					// Get the transaction block number from the result.  It will be NULL if the
					//  transaction has not been confirmed/mined yet.
					blockNumber_1 = wrappedResult.getBlockNumber();
					
					// Store the wrapped result of the getTransaction() call.
					self.wrappedResultOfGetTransactionCall = wrappedResult;
					
					// Add a message to the history.
					let dtNow = Date.now();
					let strNowDate = logging_helpers_lib.formatDateTimeForLogging_default(dtNow);
					let historyMessage =
						'(eth.getTransaction) Call completed at date/time: '
						+ strNowDate
						+ '. Result object received: '
						+ JSON.stringify(result);
						
					self.addHistoryMessage(methodName, historyMessage);
					
					return blockNumber_1;
				})
				.then(result =>
				{
					if (result == null)
						// The block number is NULL, indicating our transaction has not bee confirmed/mined
						//	by the Ethereum network yet.
						//
						// Return the object that lets successive blocks in this promise chain
						//  know not to continue processing.
						return Promise.resolve(new PromiseThenBlockSkippedResult());
					else
						// Call the getTransactionReceipt() call to get the "status" field for the
						//  block our transaction was in.
						return EthereumGlobals.web3Global.eth.getTransactionReceipt(txHash)
				})
				.then(result =>
				{
					// Skip this step?
					if (result instanceof PromiseThenBlockSkippedResult)
						// Yes.  Return FALSE to let the next block know that our transaction has not bee confirmed/mined
						//	by the Ethereum network yet.
						return false;
					else {
						// Wrap the result in a helper object to make it easier to handler.
						let wrappedReceiptResult = new solidity_helpers_misc.WrapTransactionReceiptResult(result);
						
						// Get the transaction block number from the result.  It will be NULL if the
						//  transaction has not been confirmed/mined yet.
						blockNumber_2 = wrappedReceiptResult.getBlockNumber();
						
						// Sanity check to make sure the block numbers returned from the getTransaction()
						//  and getTransactionReceipt() calls match.  If not, something is seriously wrong.
						if (blockNumber_1 != blockNumber_2)
							throw new Error(
								errPrefix
								+ 'The block number value from the get transaction call('
								+ blockNumber_1.toString()
								+ ') does not match the value received in the get transaction receipt call('
								+ blockNumber_2.toString());
						
						// Store the wrapped result object returned by the getTransactionReceipt() call.
						self.wrappedResultOfGetTransactionReceiptCall = wrappedReceiptResult;
						
						// Add a message to the history.
						let dtNow = Date.now();
						let strNowDate = logging_helpers_lib.formatDateTimeForLogging_default(dtNow);
						let historyMessage =
							'(eth.getTransactionReceipt) Call completed at date/time: '
							+ strNowDate
							+ '. Result object received: '
							+ JSON.stringify(result);
						
						self.addHistoryMessage(methodName, historyMessage);
						
						let transactionStatus = wrappedReceiptResult.getTransactionStatus();
						
						let historyMessage2 =
							'(eth.getTransactionReceipt) Call completed with status: '
							+ transactionStatus.toString();
						
						self.addHistoryMessage(methodName, historyMessage2);
						
						// Did the transaction fail?
						if (solidity_helpers_misc.isFailedRawTransactionStatus(transactionStatus))
							// Yes.  Set the transaction's status to FAILED by throwing an error.
							throw new Error(errPrefix + 'The Ethereum network reports that the raw transaction failed.');
							
						// Return TRUE to let the next step know the transaction was confirmed/mined successfully.
						return true;
					}
				})
				.then(result =>
				{
					if (typeof result != 'boolean')
						throw new Error(errPrefix + 'The result of the previous THEN block was not boolean.');
						
					if (result) {
						// Transaction confirmed/mined.  Advance to the next state.
						self._advanceState();
					}
					
					// Pass the result on.
					rawTransactionCheckResultObj.is_confirmed_as_mined = result;
					rawTransactionCheckResultObj.success = result;
					
					// Resolve the promise.
					resolve(new LifecycleStepResult(self, false, rawTransactionCheckResultObj));
				})
				.catch(function(err)
				{
					self._rejectTransactionPromise(reject, err, ' - promise');
				});
			}
			catch(err)
			{
				self._rejectTransactionPromise(reject, err, ' - try/catch');
			}
		});
	}
	
	/**
	 * Returns a promise that checks with the smart contract to see if
	 * 	this transaction has been confirmed/mined yet by using one of the
	 * 	smart contract's methods to determine that information.  This is
	 * 	NOT the same as the _rawTransactionCheck() function which uses
	 * 	function inherent to the Ethereum network itself to determine
	 * 	if the block associated wit this transaction has been
	 * 	mined/confirmed or has failed.
	 *
	 * @param {Array|null} opts - Array of options that can be used to overwrite various
	 * 	default values used by this method.
	 *
	 * @return {Promise<LifecycleStepResult>}
	 */
	this._checkForConfirmation_promise = function(opts) {
		let methodName = '_checkForConfirmation_promise';
		let errPrefix = '(' + methodName + ') ';
		
		self.validateMe(errPrefix);
		
		return new Promise(function(resolve, reject) {
			try {
				// We must have a "success" property in our result object. Pass on the onCompletionResult
				//  for logging purposes.
				let confirmationResultObj =
					{
						// We duplicate the success result in the is_confirmed_by_smart_contract property for more
						// informative log messaging purposes.
						is_confirmed_by_smart_contract: false,
						success: false
					}
					
				self.confirmAndCompleteObj.funcConfirmTrans_promise(self)
				.then(confirmationResult => {
					if (!confirmationResult.hasOwnProperty('success'))
						throw new Error(errPrefix + 'The result of the confirmation function did not contain a "success" property.');
					
					if (typeof confirmationResult.success !== 'boolean')
						throw new Error(errPrefix + 'The "success" property of the confirmation function result was not boolean.');
						
					if (confirmationResult.success)
					{
						confirmationResultObj.success = true;
						confirmationResultObj.is_confirmed_as_mined = true;
						
						// Transaction sent.  Advance to the next state.
						self._advanceState();
					}
					
					// Resolve the promise.
					resolve(new LifecycleStepResult(self, false, confirmationResultObj));
				})
				.catch(function(err)
				{
					self._rejectTransactionPromise(reject, err, ' - promise');
				});
			}
			catch(err)
			{
				self._rejectTransactionPromise(reject, err, ' - try/catch');
			}
		});
	}
	
	/**
	 * Returns a promise that executes the on-completion handler.
	 *
	 * @param {Array|null} opts - Array of options that can be used to overwrite various
	 * 	default values used by this method.
	 *
	 * @return {Promise<Object>}
	 */
	this._doOnCompletionHandler_promise = function(opts) {
		let errPrefix = '(_doOnCompletionHandler_promise) ';
		
		self.validateMe(errPrefix);
		
		return new Promise(function(resolve, reject) {
			try {
				// This step should not have been called if there is no on-completion handler.
				if (!(common_routines.isNonNullFunction(self.confirmAndCompleteObj.funcOnCompletion_promise)))
					throw new Error(errPrefix + 'An on-completion handler does not exist for this Ethereum transaction.');
			
				// We must have a "success" property in our result object. Pass on the onCompletionResult
				//  for logging purposes.
				let doOnCompletionHandlerResultObj =
					{
						on_completion_result: null,
						success: false
					}
					
				// Execute the on-completion handler.
				self.confirmAndCompleteObj.funcOnCompletion_promise(self)
				.then(onCompletionResult => {
					if (!onCompletionResult.hasOwnProperty('success'))
						throw new Error(errPrefix + 'The result of the on-completion handler did not contain a "success" property.');
					
					if (typeof onCompletionResult.success !== 'boolean')
						throw new Error(errPrefix + 'The "success" property of the on-completion handler result was not boolean.');
						
					if (onCompletionResult.success)
					{
						doOnCompletionHandlerResultObj.success = true;
						
						// Advance to the next state.
						self._advanceState();
					}
					
					doOnCompletionHandlerResultObj.on_completion_result = onCompletionResult;
					
					// Resolve the promise.
					resolve(new LifecycleStepResult(self, false, doOnCompletionHandlerResultObj));
				})
				.catch(function(err)
				{
					self._rejectTransactionPromise(reject, err, ' - promise');
				});
			}
			catch(err)
			{
				self._rejectTransactionPromise(reject, err, ' - try/catch');
			}
		});
	}
	

	/**
	 * This method ages the transaction by incrementing it's time elapsed value by the
	 * 	given amount.
	 * @param {number|string} ageValue_ms - A positive integer greater than 0.  If in
	 * 	string format, this method will attempt to parse it as an integer first.
	 *
	 * @return {number} - The new time elapsed value of this transaction after aging.
	 */
	this.ageTransaction =function(ageValue_ms) {
		let errPrefix = '(ageTransaction) ';
		
		// Validate this transaction.
		self.validateMe();
		
		// Aging a transaction is only allowed if it is not in the ready to send state
		//  or it has completed (success or failure).
		if (self.isTransactionSent == false)
			throw new Error(errPrefix + 'Transaction can not be aged because it has not been sent yet.');
	
		if (self.state === EnumEthTransLifecyleStates.STATE_ETL_FAILED)
			throw new Error(errPrefix + 'Transaction can not be aged because it has failed.');
	
		if (self.isTransactionComplete())
			throw new Error(errPrefix + 'Transaction can not be aged because it has been completed.');
	
		let useAgingValue = common_routines.validateAsIntegerGreaterThanZero(errPrefix, ageValue_ms);
		
		self.timeElapsed_ms += useAgingValue;
		
		return self.timeElapsed_ms;
	}
	
	/**
	 * This method returns TRUE if this transaction has completed, whether it completed
	 * 	successfully or errored out.
	 *
	 * @return {boolean}
	 */
	this.isTransactionComplete = function() {
		return (
			self.state === EnumEthTransLifecyleStates.STATE_ETL_FAILED
				||
			self.state === EnumEthTransLifecyleStates.STATE_ETL_SUCCEEDED);
	}
	
	/**
	 * Each transaction step MUST call this function when it completes successfully.
	 * 	It determines the next state for the transaction based on the state that
	 * 	was jus completed and the available handler functions.
	 *
	 * NOTE: If a lifecycle object does not have a confirmation check handler, then
	 * 	a success result during the raw transaction check acts as the confirmation
	 * 	check for the transaction.
	 *
	 * @private
	 */
	this._advanceState = function() {
		let errPrefix = '(_advanceState) ';
		
		let stateJustCompleted = self.state;
		
		if (!stateJustCompleted)
			throw new Error(errPrefix + 'The state just completed parameter is invalid.');
			
		if (misc_shared_lib.isEmptySafeString(stateJustCompleted))
			throw new Error(errPrefix + 'The state just completed parameter is empty.');
			
		// JUST COMPLETED STATE: STATE_ETL_POLLING_FOR_PREREQUISITES
		if (stateJustCompleted == EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_PREREQUISITES)
		{
			// The transaction is ready to be executed since all prerequisites have been met.
			//  Is it a server side transaction?
			if (self.confirmAndCompleteObj.isServerSideTransaction)
				// Yes.  Time to send the transaction.
				self._changeState(EnumEthTransLifecyleStates.STATE_ETL_READY_TO_SEND);
			else
				// No.  We should never be here.  Client side transactions should never
				//  have server side prerequisite conditions.  That should have been
				//  handled on the client side before the transaction was sent to the
				//  Ethereum network.
				throw new Error(errPrefix + 'The just completed state was a prerequisites check.  This is a client side transaction so there should not be any prerequisites.');
		}
		// JUST COMPLETED STATE: STATE_ETL_READY_TO_SEND
		else if (stateJustCompleted == EnumEthTransLifecyleStates.STATE_ETL_READY_TO_SEND)
		{
			// We just sent a transaction.  Time to execute the raw transaction check function.
			self._changeState(EnumEthTransLifecyleStates.STATE_ETL_RAW_TRANSACTION_CHECK);
		}
		// JUST COMPLETED STATE: STATE_ETL_RAW_TRANSACTION_CHECK
		else if (stateJustCompleted == EnumEthTransLifecyleStates.STATE_ETL_RAW_TRANSACTION_CHECK)
		{
			// The raw transaction was confirmed/mined.  Do we have an confirmation check handler?
			if (self.confirmAndCompleteObj.funcConfirmTrans_promise)
				// Yes.  Execute that handler.
				self._changeState(EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_CONFIRMATION);
			else
				// No confirmation check handler.  Skip to the on-completion handler.
				self._changeState(EnumEthTransLifecyleStates.STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER);
		}
		// JUST COMPLETED STATE: STATE_ETL_POLLING_FOR_CONFIRMATION
		else if (stateJustCompleted == EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_CONFIRMATION)
		{
			// Transaction was confirmed by one of the smart contract confirmation methods.
			// 	Do we have an on-completion handler?
			if (self.confirmAndCompleteObj.funcOnCompletion_promise)
				// Yes.  Execute that handler.
				self._changeState(EnumEthTransLifecyleStates.STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER);
			else
				// Transaction succeeded.
				self._changeState(EnumEthTransLifecyleStates.STATE_ETL_SUCCEEDED);
		}
		// JUST COMPLETED STATE: STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER
		else if (stateJustCompleted == EnumEthTransLifecyleStates.STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER)
		{
			// Transaction succeeded.
			self._changeState(EnumEthTransLifecyleStates.STATE_ETL_SUCCEEDED);
		}
		else
			// UNKNOWN JUST COMPLETED STATE.
			throw new Error(errPrefix + "Don't know how to handle transaction state: " + stateJustCompleted);
	}
	
	/**
	 * This method returns a promise that executes the next action to take to facilitate
	 * 	this Ethereum transaction, given the current state of the object.  The STEP,
	 * 	which is a promise, is wrapped in another promise that provides auto-history
	 * 	features.
	 *
	 * @param {Array|null} opts - Other parameters required by various calls.  For
	 * 	example, the send transaction promise's defaults for gas limit and
	 * 	price can be overwritten via the opts parameter.
	 *
	 * @return {EthTransWrappedStep} - Returns an EthTransWrappedStep object that
	 * 	contains the wrapped STEP promise.  The wrapped STEP promise will execute the
	 * 	next step required by the transaction.  Do not attempt to access this
	 * 	object itself as a promise!  Instead, access the property it maintains that
	 * 	CONTAINS the wrapped STEP.
	 *
	 * @private
	 */
	this._getWrappedNextStepToExec = function(opts)
	{
		let errPrefix = '(_getWrappedNextStepToExec) ';
		
		self.validateMe();
		
		// The transaction manager should not call this function on a completed or deleted
		//  transaction.
		if (self.isDeleted || self.isTransactionComplete())
			throw new Error(errPrefix + 'This function should not be called on a completed or deleted transaction.');
		
		// Choose the correct promise to execute based on the current state of this Ethereum transaction.
		let promiseToExec = null;
		let stepName = '(not set)';
		
		if (!self.state)
			throw new Error(errPrefix + 'Our state property is unassigned.');

		if (self.state === EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_PREREQUISITES)
		{
			promiseToExec = self._checkForPrerequisites_promise(opts);
			self.stepName = '_checkForPrerequisites_promise';
		}
			
		if (self.state === EnumEthTransLifecyleStates.STATE_ETL_READY_TO_SEND)
		{
			promiseToExec = self._sendTransaction_promise(opts);
			self.stepName = '_sendTransaction_promise';
		}
		
		if (self.state === EnumEthTransLifecyleStates.STATE_ETL_RAW_TRANSACTION_CHECK)
		{
			promiseToExec = self._rawTransactionCheck_promise(opts);
			self.stepName = '_rawTransactionCheck_promise';
		}
		
		if (self.state === EnumEthTransLifecyleStates.STATE_ETL_POLLING_FOR_CONFIRMATION)
		{
			promiseToExec = self._checkForConfirmation_promise(opts);
			self.stepName = '_checkForConfirmation_promise';
		}
		
		if (self.state === EnumEthTransLifecyleStates.STATE_ETL_EXECUTE_ON_COMPLETION_HANDLER)
		{
			promiseToExec = self._doOnCompletionHandler_promise(opts);
			self.stepName = '_doOnCompletionHandler_promise';
		}
		
		if (promiseToExec === null)
			throwUnknownOrInvalidStateError(errPrefix, self.state);
			
		// Wrap the promise in our auto-history object.
		let wrappedPromiseToExecObj = new EthTransWrappedStep(self, promiseToExec);
		
		return wrappedPromiseToExecObj;
		
		// promiseToExec.lifecycle_id = 'can you see me';
	}
}




/** --------------------------------- END  : EthTransLifecycle ----------------------------------- */

/**
 * NOTE: The following discussion is pertinent only to the EtherBandBattles app or any app that
 * 	has the exact same game  state.
 *
 * The steps executed by this object are:
 *
 * - Game creation
 * - Add players (multiple instances)
 * - Start game
 * - Add game round result (multiple instances)
 * - Finalize Game (Calculate winners and process payments)
 *
 * @constructor
 */

/** --------------------------------- BEGIN: EthereumTransactionManager ----------------------------------- */

/**
 * This is the Ethereum transaction manager.
 */
// Singleton pattern.
const EthereumTransactionManager = (function() {
	const self = this;
	
	/**
	 * @property The number of milliseconds to wait between polling attempts.
	 *
	 * @type {number}
	 */
	this._pollingInterval_ms = 1000;
	
	/**
	 * @property _timeOutValue_ms - The number of milliseconds to wait before considering an
	 * 	Ethereum transaction as failed.
	 *
	 * @type {number}
	 *
	 * @private
	 */
	this._timeOutValue_ms = 60 * 1000;

	/** @property {array<EthTransLifecycle>} - The array of Ethereum transaction lifecycle objects are currently active. */
	this._aryEthTransLifecycle = new Array();
	
	/**
	 * This function creates a new transaction from a confirm and complete object.
	 *
	 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum confirm and complete
	 * 	object, that contains all the elements needed to execute this transaction.
	 * @param {number} retryCount - The retry count to set the newly created transaction too.
	 * @param {Array<string>} [aryHistoryMessages] - Optionally you can pass in an array of messages
	 * 	to load into the new transaction's history array.
	 * @return {EthTransLifecycle} - A reference is returned to the new lifecycle object created
	 * 	for the new transaction.
	 */
	this._createTransFromConfirmAndComplete = function(confirmAndCompleteObj, retryCount, aryHistoryMessages = null) {
		let methodName = '_createTransFromConfirmAndComplete';
		let errPrefix = '(' + methodName + ') ';
		
		if (!confirmAndCompleteObj)
			throw new Error(errPrefix + 'The confirm and complete object parameter is unassigned.');
			
		validateAsPositiveNumber(methodName, 'retry count parameter', retryCount);
		
		// Create a new lifecycle object.
		let lifecycleObj = new EthTransLifecycle();
		
		lifecycleObj.initialize(
				confirmAndCompleteObj,
				DEFAULT_GAS_LIMIT,
				DEFAULT_GAS_PRICE_GWEI);
				
		lifecycleObj.retryCount = retryCount;
		
		if (aryHistoryMessages) {
			for (let ndx = 0; ndx < aryHistoryMessages.length; ndx++)
				lifecycleObj.aryHistoryMessages.push(aryHistoryMessages[ndx]);
		}
		
		
		// Return a reference to the new transaction.
		return lifecycleObj;
	}
	
	/**
	 * This function adds a transaction.
	 *
	 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum confirm and complete
	 * 	object, that contains all the elements needed to execute this transaction.
	 * @param {number} retryCount - The retry count to set the newly created transaction too.
	 * @param {Array<string>} [aryHistoryMessages] - Optionally you can pass in an array of messages
	 * 	to load into the new transaction's history array.
	 *
	 * @return {EthTransLifecycle} - A reference is returned to the new lifecycle object created
	 * 	for the added transaction.
	 */
	this.addTransaction = function(confirmAndCompleteObj, retryCount = 0, aryHistoryMessages = null) {
		let methodName = 'addTransaction';
		let errPrefix = '(' + methodName + ') ';
		
		if (!confirmAndCompleteObj)
			throw new Error(errPrefix + 'The confirm and complete object parameter is unassigned.');
			
		validateAsPositiveNumber(methodName, 'retry count parameter', retryCount);
		
		// Create a new lifecycle object.
		let lifecycleObj = self._createTransFromConfirmAndComplete(confirmAndCompleteObj, retryCount, aryHistoryMessages);
		
		let bReplaced = false;

		// Add it to our lifecycle object collection, but reuse any existing deleted
		//	lifecycle objects so we don't have to worry about the array of
		//  lifecycle objects changing order and to go easy on memory usage.
		for (let ndx = 0; ndx < self._aryEthTransLifecycle.length; ndx++)
		{
			if (self._aryEthTransLifecycle[ndx].isDeleted)
			{
				// Replace it with the new lifecycle object.
				self._aryEthTransLifecycle[ndx] = lifecycleObj;
				bReplaced = true;
				break;
			}
		}
		
		// Did we execute a replacement?
		if (!bReplaced)
			// No.  Add it.
			self._aryEthTransLifecycle.push(lifecycleObj);
			
		// Start the transaction's execution loop in a deferred asynchronous manner.
		lifecycleObj.startTransaction();
			
		// Return a reference to the new transaction.
		return lifecycleObj;
	}
	
	/** property {boolean} - If TRUE, then the last age transactions iteration has completed
	 * 	so it is OK to run a new iteration.  If FALSE, then the last iteration has not completed
	 * 	yet.  This is a "guard" flag to prevent re-entrancy into the age transactions interval
	 * 	code.
	 *
	 * @private
	 */
	this._isLastPollingFuncStillBusy = false;
	
	/**
	 * Set the busy flag.
	 */
	this._setBusyFlag = function() {
		self._isLastPollingFuncStillBusy = true;
	}
	
	/**
	 * Clear the busy flag.
	 */
	this._clearBusyFlag = function() {
		self._isLastPollingFuncStillBusy = false;
	}
	
	/**
	 * This function scans the list of all Ethereum transactions we are monitoring and
	 * 	checks to see if they have completed (successfully or failed), or timed out.
	 */
	this._pollingFunc = function() {
		let errPrefix = '(EthereumTransactionManager::_pollingFunc) ';
		
		// If the busy flag is still set from the last iteration, just get out
		//  and wait for that iteration to complete.
		if (self._isLastPollingFuncStillBusy) {
			// Log the occurrence.
			// let logMsg = errPrefix + 'Polling function iteration skipped because the last iteration is still busy.';

			// winstonLogger.log('info', logMsg);
			return;
		}
	
		// Set the busy flag for this iteration.
		self._setBusyFlag();
		
		try {
			// This array is for the pending retry requests found during the FOR loop below,
			let aryPendingRetryRequests = new Array();
		
			// Scan the array of Ethereum transaction lifecycle objects we are monitoring.
			for (let ndx = 0; ndx < _aryEthTransLifecycle.length; ndx++) {
				let lifecycleObj = _aryEthTransLifecycle[ndx];
				
				// Skip deleted items.
				if (lifecycleObj.isDeleted)
					continue;
					
				// ---------------------- BEGIN: RETRY CODE (failed during lifecycle execution loop) ----------------
				
				// Do we have a transaction that failed in the execution loop that wants to be retried?
				if (lifecycleObj.isRetryRequested) {
				
					// Yes.  Save the confirm and complete object belonging to the
					//	failed transaction requesting a retry operation along with its
					//  history message array and its retry count.
					aryPendingRetryRequests.push(new PendingRetryRequest(lifecycleObj));
					
					// Finalize the failed transaction, which will mark it as deleted.
					lifecycleObj.finalizeBeforeDeletion_polling_func_only('polling function, retry requested');
					
					// Skip this transaction.
					continue;
				}
				
				// ---------------------- END  : RETRY CODE ----------------
				
				// Delete items that succeeded or failed (i.e. - they are done).
				if (lifecycleObj.isTransactionComplete()) {
					// Finalize the transaction, which will mark it as deleted.
					lifecycleObj.finalizeBeforeDeletion_polling_func_only('polling function, transaction completed');
					continue;
				}
				
				// We do not start aging the transaction until it has been sent to the network.
				let timeElapsed_ms = 0;
				
				if (lifecycleObj.isTransactionSent == true) {
					// Check for a time-out condition.
					
					// Increment the seconds elapsed since this lifecycle object was commissioned. If
					//  this function returns FALSE, then the associated Ethereum transaction
					//  has timed-out, at least as far as we are concerned.
					timeElapsed_ms = lifecycleObj.ageTransaction(self._pollingInterval_ms);
				}
				
				// Timed-out?
				if (timeElapsed_ms < self._timeOutValue_ms)
				{
					// No. The lifecycle object is still viable.  Allow it to continue.
				}
				else
				{
					// --------------------- TIME-OUT OCCURRED --------------

					// Set the "timed-out" flag so the transaction knows it timed out.
					//  We handle the error here because the transaction may be stuck
					//	waiting on a promise in its execution loop.  The loop will abort
					//  when it sees the timed-out flag has been set.
					lifecycleObj.isTimedOut = true;
					
					// Call the on-error handler.  If a retry is warranted and allowed,
					//  this method will set the isRetryRequested flag on the lifecycle object.
					lifecycleObj.doRetryIfOnErrorRequestsItAndIsAllowed();

					// Retry requested?
					if (lifecycleObj.isRetryRequested) {
						// ---------------------- BEGIN: RETRY CODE (failed due to time-out condition) ----------------

						// Yes.  Save the confirm and complete object belonging to the
						//	failed transaction requesting a retry operation along with its
						//  history message array and its retry count.
						aryPendingRetryRequests.push(new PendingRetryRequest(lifecycleObj));
							
						// Finalize the transaction, which will mark it as deleted.
						lifecycleObj.finalizeBeforeDeletion_polling_func_only('time-out occurred, retry requested');
						
						// ---------------------- END  : RETRY CODE ----------------
					}
				}
			}
			
			// Now that we are out of the FOR loop, we can safely create the new transactions
			//  for the pending retry requests we accumulated during that loop.
			for (let ndx = 0; ndx < aryPendingRetryRequests.length; ndx++) {
				// Carry over the retry count from the failed transaction.
				self.addTransaction(
					aryPendingRetryRequests[ndx].confirm_and_complete_obj,
					aryPendingRetryRequests[ndx].retry_count,
					aryPendingRetryRequests[ndx].aryHistoryMessages);
			}
			
			self._clearBusyFlag();
		}
		catch(err) {
			let errMessage =
				errPrefix
				+ misc_shared_lib.conformErrorObjectMsg(err);
				
			winstonLogger.log('error', errMessage);
				
			// Make sure the busy flag is always cleared.
			self._clearBusyFlag();
		}
	}
		
	
	// Create an interval that executes the polling function once a second.
	this._interval = setInterval(_pollingFunc, _pollingInterval_ms);
	
	// If we get notification of a program termination, stop the polling interval function.
	process.on('SIGNINT', function()
		{
			// Break the loop that waits for Ethereum blocks.  We are exiting.
			clearInterval(self._interval);
		});

	
	return this;
})();

/** --------------------------------- END : EthereumTransactionManager ----------------------------------- */


module.exports = {
	buildBroadcastPromise: buildBroadcastPromise,
	// defaultLoggingDetailsFunc: defaultLoggingDetailsFunc,
	EthTransLifecyle: EthTransLifecycle,
	EthereumTransactionManager: EthereumTransactionManager,
	EthTransConfirmAndComplete: EthTransConfirmAndComplete
}
