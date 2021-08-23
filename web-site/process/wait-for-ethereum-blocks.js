/**
 * This file contains the code that polls for Ethereum transactions to complete
 * 	and dispatches various actions as they do or the wait operation times out.
 *
 */
// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()
// v4 for "random" uuid creation mode.
const uuidv4 = require('uuid/v4');

// ----------------------------------------------------------------------

var express = require("express");

const common_routines = require('../common/common-routines');
const gamemaster_lib = require('../common/game-master');
const ethereum_transactions = require('../process/ethereum-transactions');
const EnumEthereumTransactionType_ebb = require('../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
const misc_shared_lib = require ('../public/javascripts/misc/misc-shared');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
const Tx = require('ethereumjs-tx');
const DelayedSignedTransactionExecution = require('../server-side-only/delayed-signed-transaction-execution').DelayedSignedTransactionExecution;

const DUMMY_ETHEREUM_TRANSACTION_ID_OLD = "no_app_event_id_required";

const winstonLogger = require('../common/winston-logging-module').winstonLogger;

// TODO: Get rid of this global variable when you can.  It tracks the
//  last nonce we used when submitting an Ethereum transaction for the
//  server Ethereum account.
var g_LastNonceUsed_old = null;

/**
 * This function builds a promise that broadcasts an Ethereum transaction result to the
 * 	PubNub network.
 *
 * @param {EthereumTransactionResult_ebb} ethTransResult - The Ethereum transaction result
 * 	to broadcast.
 *
 * @return {Promise} - Returns a promise that publishes the given transaction result over
 * 	the PubNub network channel associated with the game details object found in the
 * 	transaction result object.
 *
 * @private
 */
function _buildBroadcastPromise(ethTransResult) {
	let errPrefix = '(_buildBroadcastPromise) ';
	
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


/**
 * This the object that contains the details for one Ethereum transaction that we are waiting
 * 	for the block to be mined on the network.
 *
 * @constructor
 */
function EthereumTransactionWaiter()
{
	var self = this;
	
	var errPrefix = '(EthereumTransactionWaiter) ';
	
	/** @property {string} - Automatically generated unique ID. */
	this.id = uuidv4();

	/**
	 * @property gameDetailsObj - The game details object the Ethereum transaction is
	 * 	associated with.
	 *
	 * @type {Object}
	 */
	this.gameDetailsObj = null;
	
	/**
	 * @property isDeleted - This property is set to TRUE when the waiter is
	 * 	no longer needed, whether it is due to a the transaction block being
	 * 	successfully mined or atime-out or other failure condition.  Once TRUE,
	 * 	it can be re-used for a new transaction.
	 *
	 * NOTE: We initialize the value to TRUE because although new instances
	 * 	don't start out in the deleted state, the initialize() function will
	 * 	not allow any instances to be initialized if the deleted flag is not
	 * 	set to TRUE.
	 *
	 * @type {boolean}
	 */
	this.isDeleted = true;
	
	/**
	 * @property isConfirmed - This property is set to TRUE once the block
	 *  belonging to the Ethereum transaction the waiter was waiting successfully
	 *  mines, indicating the transaction is confirmed.
	 *
	 * @type {boolean}
	 */
	this.isConfirmed = false;
	
	/**
	 * @property The number of milliseconds to wait before considering the associated
	 * 	Ethereum transaction mining operation as having timed-out.
	 *
	 * @type {number}
	 */
	this.timeout_ms = -1;
	
	/**
	 * @property If we time-out waiting for confirmation, then this variable will be
	 * 	set to TRUE, otherwise it is FALSE.
	 *
	 * @type {boolean}
	 */
	this.isTimedOut = false;
	
	/**
	 * @property The number of milliseconds that have elapsed since the object was commissioned.
	 *
	 * @type {number}
	 */
	this.elapsedSeconds_ms = -1;
	
	/**
	 * @property buildPollingMethod_promise - This contains the function that builds a
	 * 	promise that will execute the correct, curred Web3.js smart contract method
	 * 	that when called tells us if the goal of the Ethereum transaction
	 * 	we are waiting to be mined has been achieved.  The method call is expected to be
	 * 	fully encoded with necessary parameters to make the call.
	 *
	 * For example:
	 *
	 * 	It could contain a function that builds a a fully parameterized Web3.js call
	 * 	 (as a Promise) that calls the EtherBandBattlesManager contract's getGameId()
	 * 	 method to see if a makeGame() call succeeded.
	 *
	 * @type {Function<Promise>}
	 */
	this.buildPollingMethod_promise = null;
	
	/**
	 * @property auxObj - Use this to store any object that is relevant to the transaction.
	 * 	It will be broadcast along with the EthereumTransactionResult_ebb object that is
	 * 	broadcast to the PubNub channel associated with the game the transaction
	 * 	is associated with.
	 *
	 * @type {Object}
	 */
	this.auxObj = null;
	
	/**
	 * @property onSuccess_promise - This function is called to build event handler function
	 * 	that should be called when the Ethereum transaction is successfully mined.  It is
	 * 	expected to return a promise that does that.  The result of the promise is ignored.
	 *
	 * @type {Function<Promise>}
	 */
	this.buildOnSuccess_promise = null;
	
	/**
	 * @property ethereumTransactionTrackingId - The transaction ID that we assigned to the Ethereum
	 * 	transaction.
	 *
	 * @type {string}
	 */
	this.ethereumTransactionTrackingId = "";
	
	/**
	 * @property ethereumTransactionType - The transaction type (game_creation, etc.)
	 *
	 * @type {EnumEthereumTransactionType_ebb}
	 */
	this.ethereumTransactionType = EnumEthereumTransactionType_ebb.notset;
	
	/**
	 * This method uses the given parameters to set the properties of this object.  It
	 * 	will throw an error if an attempt is made to initialize an object that has not
	 * 	been deleted yet.
	 *
	 * @param {Object} gameDetailsObj - The game details object the Ethereum transaction is
	 * 	associated with.
	 * @param {Object} confirmTransPromiseBuilder - An object that builds
	 * 	a curried promise that executes the smart contract method that is used to confirm
	 * 	the mining of an Ethereum transaction's block.
	 * @param {DelayedPromiseExecution} delayedOnSuccessBuilder - An object that builds the promise
	 * 	to call that checks to see if the block is successfully mined indicating the relevant
	 * 	Ethereum transaction succeeded.  It can be NULL if one is not needed.
	 * @param {Object} auxObj - A data object that you want to accompany the PubNub
	 * 	broadcast that will be sent when the target transaction succeeds or fails.
	 * 	(E.g. - A user details object).
	 * @param {string} ethereumTransactionTrackingId - A valid Ethereum transaction tracking ID.
	 * @param {EnumEthereumTransactionType_ebb} ethereumTransactionType - A valid Ethereum transaction type.
	 *
	 * @constructor
	 */
	this.initialize =
		function(
		gameDetailsObj,
		confirmTransPromiseBuilder,
		timeout_ms,
		delayedOnSuccessBuilder,
		auxObj,
		ethereumTransactionTrackingId,
		ethereumTransactionType)
	{
		let errPrefix_2 = errPrefix + '-> initialize: '
		
		if (self.isDeleted == false)
			throw new Error(errPrefix_2 + 'You can not initialize an object that has not been deleted yet.');
		
		if (!gameDetailsObj)
			throw new Error(errPrefix_2 + 'The game details object is unassigned.');
			
		// Validate the game details object.
		gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
		
		if (!confirmTransPromiseBuilder)
			throw new Error(errPrefix_2 + 'The object that builds the polling method as a promise is unassigned.');
			
		if (timeout_ms <= 0)
			throw new Error(errPrefix_2 + 'Invalid time-out value: ' + timeout_ms);
			
		if (misc_shared_lib.isEmptySafeString(ethereumTransactionTrackingId))
			throw new Error(errPrefix_2 + 'The Ethereum transaction ID is empty.');
			
		if (!ethereumTransactionType || ethereumTransactionTrackingId == EnumEthereumTransactionType_ebb.notset)
			throw new Error(errPrefix_2 + 'Invalid Ethereum transaction type..');
			
		self.gameDetailsObj = gameDetailsObj;
		
		self.confirmTransPromiseBuilder = confirmTransPromiseBuilder;

		// Reset the deleted property.
		self.isDeleted = false;
		
		self.timeout_ms = timeout_ms;
		
		// Reset the time-out seconds counter.
		self.elapsedSeconds_ms = 0;
		
		self.auxObj = auxObj;
		
		self.delayedOnSuccessBuilder = delayedOnSuccessBuilder;
		
		self.ethereumTransactionTrackingId = ethereumTransactionTrackingId;
		
		self.ethereumTransactionType = ethereumTransactionType;
	}
	
	
	/**
	*
	 * This method increments our elapsed second value by the given polling interval.
	 * @param pollingInterval_ms
	 *
	 * @return {boolean} - Returns FALSE if the resulting elapsed seconds value exceeds
	 * 	our set time-out, otherwise it returns FALSE.
	 */
	this.incrementElapsedMilliSeconds = function(pollingInterval_ms) {
		let errPrefix = '(incrementElapsedMilliSeconds) ';
		
		if (pollingInterval_ms <= 0)
			throw new Error(errPrefix + 'Invalid polling interval: ' + pollingInterval_ms);
			
		// Increment the seconds elapsed since this waiter was commissioned
		//  by the polling interval given to us.
		self.elapsedSeconds_ms = self.elapsedSeconds_ms + pollingInterval_ms;
		
		return self.elapsedSeconds_ms < self.timeout_ms;
	}
}

/**
 * This function returns a promise that broadcasts the given Ethereum
 * 	transaction result over the PubNub network.  If the successfulConfirmation event
 * 	handler promise is assigned, that handler will be executed first
 * 	before broadcasting the transaction result.  Note: if the successfulConfirmation
 * 	event handler promise fails (rejects), the broadcast will not
 * 	be made to prevent further damage to the system that might occur
 * 	due to the problem that caused the successfulConfirmation event handler to fail.
 *
 * @param {EthereumTransactionResult_ebb} ethTransResult - A valid
 * 	Ethereum transaction result object.
 * @param {DelayedPromiseExecution} onSuccessPromiseBuilder - A DelayedPromiseExecution
 * 	that can build the Promise should be executed before broadcasting the transaction
 * 	result.  It can be NULL if one is not needed.
 *
 * @return {Promise<any>} - Returns a promise as described in the
 * 	main function description.
 *
 * @private
 */
function _buildOnSuccessWithBroadcast_promise(ethTransResult, onSuccessPromiseBuilder)
{
	let errPrefix = '(_buildOnSuccessWithBroadcast_promise)';
	
	if (!ethTransResult)
		throw new Error(errPrefix + 'The Ethereum transaction result is unassigned.');
	
	return new Promise(function(resolve, reject) {
		// Do we have a function that builds a success event handler promise?
		if (onSuccessPromiseBuilder)
		{
			//Yes.  Execute it and then broadcast
			//  the Ethereum transaction result over the PubNub network.
			//  If the onSuccess handler fails, then the broadcast won't
			//  happen.  This is what we want because we don't want the
			//  system to take further action if there's a problem with the
			//  chain of operations.
			//
			// NOTE: We ignore the result of the on-success event handler.
			// TODO: Can we make use of the result of the on-success event handler?  Currently
			//  they don't return a conformed result type so some work will be needed.
			onSuccessPromiseBuilder.buildPromise()
			.then(function(ignoreResult) {
				// Return a promise that broadcasts the Ethereum transaction result.
				return _buildBroadcastPromise(ethTransResult);
			})
			.then(function(result)
		  	{
				// Resolve the promise with the broadcast result.
				resolve(result);
		  	})
			.catch(function(err)
			{
				// Reject the promise with the error.
				reject(err);
			});
		}
		else
		{
			// No successfulConfirmation event handler promise.  Just return a promise that broadcasts the
			//  Ethereum transaction result.
			_buildBroadcastPromise(ethTransResult)
			.then(function(result)
		  	{
				// Resolve the promise with the broadcast result.
				resolve(result);
		  	})
			.catch(function(err)
			{
				// Reject the promise with the error.
				reject(err);
			});
		}
	});
}

/**
 * When a polling promise resolves successfully it returns a PollingPromiseResult object.
 * @constructor
 */
function PollingPromiseResult()
{
	this.isSucceeded = false;
}

// Singleton pattern.
/**
 * This is the Ethereum transaction monitor.  It maintains a list of "waiters" that
 * 	wait for a particular Ethereum transaction to be mined, taking the appropriate
 * 	action if: the transaction is mined successfully, it times out, or an error
 * 	occurs while polling the smart contract for confirmation of each transaction.
 */

var WaitForEthereumBlocks = (function() {
	var self = this;
	
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

	/** @property {array} - The array of EthereumTransactionWaiter objects we are currently monitoring. */
	this._aryWaitingTransactions = new Array();
	
	/**
	 * This function builds a polling promise that services the given Ethereum transaction result.
	 *
	 * @param {EthereumTransactionWaiter} ethTransWaiter - The Ethereum transaction waiter we
	 * 	are building polling promise for.
	 *
	 * @return {Promise<boolean>} - Returns a promise that executes the necessary smart contract method call to
	 * 	check if the given Ethereum transaction has been mined (i.e. - confirmed as written to the
	 * 	blockchain ledger).  If the transaction is confirmed, the waiter object will have its isConfirmed
	 * 	property set to TRUE.
	 *
	 * @private
	 */
	this._buildPollingPromise = function(ethTransWaiter) {
		let errPrefix = '(_buildPollingPromise) ';
		
		if (!ethTransWaiter)
			throw new Error(errPrefix + 'The Ethereum transaction waiter object is unassigned.');
		
		if (!ethTransWaiter.gameDetailsObj)
			throw new Error(errPrefix + 'The Ethereum transaction waiter object contains an invalid or missing game details object.');
			
		if (!ethTransWaiter.confirmTransPromiseBuilder)
			throw new Error(errPrefix + 'The object that builds a polling method as a promise is unassigned.');
			
		return new Promise(function(resolve, reject) {
		
			// Execute the function that builds a polling method promise.
			ethTransWaiter.confirmTransPromiseBuilder.buildPromise()
			.then(function(result) {
				// All Ethereum transaction confirmation promises must return an
				//	EthereumTransactionResult_ebb object.
				if (!(result instanceof ethereum_transactions.EthereumTransactionResult))
					throw new Error(
						errPrefix
						+ 'The result of the polling method promise was not an Ethereum transaction result.');
						
				let ethTransResult = result;
				
				// Did the transaction confirmation attempt succeed?  Remember, the successfulConfirmation
				//  field is assigned indirectly during the construction of the EthereumTransactionResult_ebb
				//  by the value passed to the constructor of that object.
				if (ethTransResult.successfulConfirmation)
				{
					// >>>>>> MAKE SURE THIS VALUE IS SEEN OUTSIDE THIS METHOD.  JAVASCRIPT IS
					//  SHARE-BY-VALUE, BUT STILL, MAKE SURE.
					ethTransWaiter.isConfirmed = true; // Successful confirmation of the Ethereum transaction.
					
					let successMsg =
						errPrefix
						+ 'Game ID/OpDesc: ('
						+ ethTransWaiter.gameDetailsObj.id
						+ '/'
						+ '>>>>> '
						+ ethTransWaiter.ethereumTransactionType
						+ ' <<<<<'
						+ ') has been mined/confirmed successfully.  Transaction ID: '
						+ ethTransWaiter.ethereumTransactionTrackingId
						+ ' Object ID -> '
						+ ethTransWaiter.id;

					
					// Log the successful Ethereum transaction result.
					winstonLogger.log('info',  successMsg);
					
					// Execute the successfulConfirmation event handler associated with the
					//  waiter (if any) and then broadcast the transaction result.
					return _buildOnSuccessWithBroadcast_promise(
						ethTransResult, ethTransWaiter.delayedOnSuccessBuilder);
				}
				
				return true;
			})
			.then(function(ignoreResult) {
				resolve(ethTransWaiter.isConfirmed);
			})
			.catch(function(err)
		    {
		    	// Reject the promise with the error received.
		    	reject(err);
		    });
		});
	}
	
	/**
	 * This function adds a new waiter to our list to monitor an Ethereum transaction that
	 * 	was recently submitted to the Ethereum network.
	 *
	 * @param {Object} gameDetailsObj - The game details object the Ethereum transaction is
	 * 	associated with.
	 * @param {Object} confirmTransPromiseBuilder - An object that builds
	 * 	a curried promise that executes the smart contract method that is used to confirm
	 * 	the mining of an Ethereum transaction's block.
	 * @param {Function<Promise>} buildOnSuccess_promise - A function that builds the promise
	 * 	to call that checks to see if the block is successfully mined indicating the relevant
	 * 	Ethereum transaction succeeded.  It can be NULL if one is not needed.
	 * @param {Object} auxObj - A data object that you want to accompany the PubNub
	 * 	broadcast that will be sent when the target transaction succeeds or fails.
	 * 	(E.g. - A user details object).
	 * @param {string} - A valid Ethereum transaction tracking ID.
	 * @param {EnumEthereumTransactionType_ebb} ethereumTransactionType - A valid Ethereum transaction type.
	 */
	this.addWaiterForTransaction =
		function(
			gameDetailsObj,
			confirmTransPromiseBuilder,
			buildOnSuccess_promise,
			auxObj,
			ethereumTransactionTrackingId,
			ethereumTransactionType)
	{
		// Create a new waiter for the given Ethereum transaction that was just submitted
		//  to the network.
		let newWaiter = new EthereumTransactionWaiter();
		
		newWaiter.initialize(
			gameDetailsObj,
			confirmTransPromiseBuilder,
			_timeOutValue_ms,
			buildOnSuccess_promise,
			auxObj,
			ethereumTransactionTrackingId,
			ethereumTransactionType);
		
		let bReplaced = false;

		// Add it to our waiter collection, but reuse any existing deleted waiter
		//  so we don't have to worry about the array of waiters changing order
		//  and to go easy on memory usage.
		for (let ndx = 0; ndx < _aryWaitingTransactions.length; ndx++)
		{
			if (_aryWaitingTransactions[ndx].isDeleted)
			{
				// Replace it with the new task.
				_aryWaitingTransactions[ndx] = newWaiter
				bReplaced = true;
				break;
			}
		}
		
		// Did we execute a replacement?
		if (!bReplaced)
			// No.  Add it.
			_aryWaitingTransactions.push(newWaiter);
	}
	
	
	/**
	 * This function scans the list of all Ethereum transactions we are monitoring and
	 * 	checks to see if they have completed successfully or timed out.
	 */
	this._pollingFunc = function() {
		let errPrefix = '(_pollingFunc) '
		
		// We will fill this array with all the promises necessary to poll
		//  our smart contract for each pending waiter, or to broadcast
		//  the result of polling the Ethereum transaction when we receive
		//  confirmation its block was mined or a time-out occurred.
		let aryPollingAndBroadcastPromises = new Array();
	
		// Scan the array of EthereumTransactionWaiter objects we are monitoring.
		for (let ndx = 0; ndx < _aryWaitingTransactions.length; ndx++) {
			let ethTransWaiter = _aryWaitingTransactions[ndx];
			
			// Skip deleted items.
			if (ethTransWaiter.isDeleted)
				continue;
				
			// Delete successfully confirmed/completed items.
			if (ethTransWaiter.isConfirmed)
			{
				// Mark the waiter as deleted so it can be reused.  It is finished.
				ethTransWaiter.isDeleted = true;
				continue;
			}
			
			// Check for a time-out condition.
			
			// Increment the seconds elapsed since this waiter was commissioned. If
			//  this function returns FALSE, then the associated Ethereum transaction
			//  has timed-out, at least as far as we are concerned.
			if (ethTransWaiter.incrementElapsedMilliSeconds(_pollingInterval_ms))
			{
				// The waiter is still viable.  Make a promise to poll our smart contract
				//  for confirmation of the associated Ethereum transaction, and add it
				//  to our array for those promises.
				let pollingMethodPromise = _buildPollingPromise(ethTransWaiter);
				
				aryPollingAndBroadcastPromises.push(pollingMethodPromise);
			}
			else
			{
				// A time-out occurred.  Add the broadcast of this condition to the promises
				//  array. TODO: Should we add code to the broadcast promise to take action
				//  if that promise fails/rejects?
				
				// Build a transaction result for the time-out condition.  we set the
				//  flag that tells the client side code whether or not to update their
				//  copy of the game details object from the one we're storing in the
				//  the transaction result to FALSE.  We do this because it has been
				//	a (relatively) long time between the time the server received the
				//  game details object and now, so it is likely the game details object
				//	stored in the waiter is stale and out-of-date (i.e. - it may not
				//  contain important changes made to the game details object on the client
				//	side).  Also
				let ethTransResult =
					new ethereum_transactions.EthereumTransactionResult(
						ethTransWaiter.ethereumTransactionType,
						ethTransWaiter.gameDetailsObj,
						false,
						ethTransWaiter.auxObj,
						false,
						ethTransWaiter.ethereumTransactionTrackingId);
				
				ethTransResult.isErrorResult = true;
				ethTransResult.errorMessage =
					"The Ethereum transaction with tracking ID('"
					+ ethTransWaiter.ethereumTransactionTrackingId
					+ "') failed to mine within the current time-out period (milliseconds): "
					+ _pollingInterval_ms;
					
				// Mark the waiter as timed out.
				ethTransWaiter.isTimedOut = true;
				
				// Mark the waiter as deleted so it can be reused because its transaction
				//  is done as far as we're concerned.
				ethTransWaiter.isDeleted = true;
				
				// Log it.
				winstonLogger.log('error',  ethTransResult.errorMessage);

				// Build a promise to broadcast the result.
				let broadcastPromise = _buildBroadcastPromise(ethTransWaiter);
				
				aryPollingAndBroadcastPromises.push(broadcastPromise);
			}
		}
		
		// Execute all the promises.
		// TODO: May need to stop logging here once the number of promises (i.e. - number
		//  of pending transactions) gets too large).
		if (aryPollingAndBroadcastPromises.length > 0)
		{
			Promise.all(aryPollingAndBroadcastPromises)
			.then(function(values) {
				console.log(errPrefix + 'The Promise.all() result: ');
				console.log(values);
			});
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

/**
 *
 * @param {Object} txHashObj - A valid Ethereum transaction hash.
 * @param {number} nonceUsed - The nonce used in the transaction.
 * @param {string} operationDesc - The description of the Ethereum transaction.
 *
 * @constructor
 */
function SignedTransactionResult_old(txHashObj, nonceUsed, operationDesc)
{
	let errPrefix = '(SignedTransactionResult) ';
	
	if (!txHashObj)
		throw new Error(errPrefix + 'The Ethereum transaction object is unassigned.');
		
	if ( (nonceUsed == null) || nonceUsed < 0)
		throw new Error(errPrefix + 'Invalid nonce used.');
		
	if (misc_shared_lib.isEmptySafeString(operationDesc))
		throw new Error(errPrefix + 'The Ethereum operation description is empty.');
		
	this.txHashObj = txHashObj;
	this.nonceUsed = nonceUsed;
	this.operationDesc = operationDesc;
	
	/**
	 * This function returns the contents of this object in a human friendly string.
	 *
	 * @return {string}
	 */
	this.prettyPrint = function()
	{
		let retMsg =
			'txHash: ' + this.txHashObj.transactionHash
			+ ', nonceUsed: ' + this.nonceUsed
			+ ', blockNumber: ' + this.txHashObj.blockNumber
			+ ', operationDesc: ' + this.operationDesc
			+ ', cumulativeGasUsed: ' + this.txHashObj.cumulativeGasUsed
			+ ', from: ' + this.txHashObj.from
			+ ', to: ' + this.txHashObj.to;
			
		return retMsg;
	}
}

/**
 * This object keeps a FIFO collection of promises that execute a deferred Ethereum
 * 	transaction.  As soon as one completes, the next one is executed.
 *
 * 	TODO: Add retry log later for failed transactions (i.e.  - try again with more
 * 	 gas, or try again later, etc.
 *
 * @constructor
 */
var DeferredTransactionExecutor = (function() {
	var self = this;
	
	/** @property {Array} _aryPendingTransactions - The array that contains the pending transactions,
	 * 	executed on a FIFO basis.
	 *
	 * @private
	 */
	this._aryPendingTransactions = new Array();
	
	/** @property {number|null} _lastNonceUsed - The last nonce used in a send transaction call.
	 * 		May be higher than the current result of calling the Web3 getTransactionCount()
	 * 		method.  Remember:
	 *
	 * 	- If a nonce is too low you'll get a rejected transaction
	 * 	- If a nonce is a duplicate, then it should be for an existing transaction submitted
	 * 		to the network, that you are providing more gas for this time in order to get it
	 * 		mined quicker.
	 *  - If a nonce is too high for a particular account (gap), it won't be mined until
	 *  	other transactions are submitted for that account
	 *
	 * @private
	 */
	this._lastNonceUsed = null;
	


	/** Add a deferred transaction to the end of the queue.
	 *
	 * @param {DelayedSignedTransactionExecution} - A deferred transaction.
	 *
	 */
	this._add = function(deferredTrans) {
		// Unshift adds an element to the beginning of an array.
		self._aryPendingTransactions.unshift(deferredTrans);
	}

	/** Remove the last (oldest) deferred transaction from the queue. */
	this._remove = function() {
		let len = self._aryPendingTransactions.length;
		
		if (len < 1)
			// Array is empty, just return.
			return;
	
		self._aryPendingTransactions.pop();
		
		// Need to reduce the length of the array since pop() doesn't do that apparently.
		self._aryPendingTransactions.length = len - 1;
	}
	
	/**
	 * Remove the last (oldest) deferred transaction from the queue while
	 * 	returning the last (oldest) element on the queue before it was removed.
	 *
	 * @return {{DelayedSignedTransactionExecution|null}} - Returns the last (oldest) element that was in
	 * 	the queue before removing it.  Returns NULL if the queue is empty.
	 */
	this._removeAndReturn = function() {
		let ret = self._last();
		
		self._remove();
		
		return ret;
	}
	
	/** Get the first (newest) element from the queue.
	 *
	 * @return {DelayedSignedTransactionExecution|null} - Returns the first (newest)
	 * 	deferred transaction in the queue or NULL if the queue is empty.
	 */
	this._first = function() {
		let len = self._aryPendingTransactions.length;
		
		if (len < 1)
			return null;
			
		return self._aryPendingTransactions[0];
	}

	/** Get the last (newest) element from the queue.
	 *
	 * @return {DelayedSignedTransactionExecution|null} - Returns the last (oldest)
	 * 	deferred transaction in the queue or NULL if the queue
	 * 	is empty.
	 */
	this._last = function() {
		let len = self._aryPendingTransactions.length;
		if (len < 1)
			return null;
			
		let lastNdx = len - 1;
		
		return self._aryPendingTransactions[lastNdx];
	}
	
	/**
	 * Return the number of items in the queue.
	 *
	 * @return {number} - Returns the number of items in the queue.
	 */
	this.count = function() {
		let len = self._aryPendingTransactions.length;
		
		return len;
	}
	
	/**
	 * Return TRUE if the queue is empty, otherwise FALSE.
	 *
	 * @return {boolean} - Returns TRUE if the queue is empty, otherwise FALSE.
	 */
	this.isEmpty = function() {
		return (self.count() == 0);
	}
	
	
	/**
	 * Add a promise that executes deferred Ethereum transaction to the queue.
	 *
	 * @param {Object} - A valid Web3 object with it's provider URL assumed to
	 * 	be set.
	 * @param {Promise<SignedTransactionResult>} doSignSendTransactionPromise - A promise that will sign
	 * 	and send the desired transaction and returns a SignedTransactionResult object
	 * 	containing certain details of the transaction submission.
	 * @param {string} operationDesc - A simple description of the operation.  Used for
	 * 	logging purposes.
	 *
	 * 	TODO: See if running your own node, instead of using Infura, eliminates
	 * 		the delay that occurs with sending transactions.  This is NOT the
	 * 		delay associated with waiting for a transaction to be mined.
	 *
	 */
	this.addDelayedTransaction = function(web3, doSignSendTransactionPromise, operationDesc)
	{
		let errPrefix = '(addDelayedTransaction) ';
		
		// The DelayedSignedTransactionExecution constructor will validate the parameters.
		let delayedEthTrans =
			new DelayedSignedTransactionExecution(
					web3,
					doSignSendTransactionPromise,
					operationDesc);
		
		// Add it to the queue for deferred execution.
		self._add(delayedEthTrans);
	}

	/**
	 * This function maintains the queue and executes any transactions that are
	 * 	ready to be executed.
	 */
	this._executiveFunc = function() {
		try {
			let errPrefix = '(_executiveFunc) ';
			
			// Is there anything in the queue?
			if (self.isEmpty())
				// Nothing to do.  Just return.
				return;
	
			// Get the next job to execute.
			let nextJob = self._last();
			
			if (!nextJob)
				throw new Error(errPrefix + 'Found a deferred Ethereum transaction that is unassigned.');
				
			// If the job is pending, start it.
			if (nextJob.statusOfTransactionPromise == ethereum_transactions.EnumDelayedEthTransStatus.pending) {
				// Mark the job as in progress.
				nextJob.statusOfTransactionPromise = ethereum_transactions.EnumDelayedEthTransStatus.in_progress;
				
				console.log(
					errPrefix
					+ 'EXECUTING deferred Ethereum transaction: '
					+ nextJob._operationDesc
					+ ' Object ID -> '
					+ nextJob.id);
					
				nextJob.delayedExec_promise()
				.then(result => {
					console.log(errPrefix + "Result of delayed Ethereum transaction('" +
					+ nextJob._operationDesc
					+ ") is: " + result
					+ ' Object ID -> '
					+ nextJob.id);
				})
				.catch(err => {
					// Just log the error for now.
					console.log(errPrefix + "PROMISE ERROR CAUGHT: During execution of delayed Ethereum transaction('" +
					+ nextJob._operationDesc
					+ "), details: " + err.message
 					+ ' Object ID -> '
					+ nextJob.id);
				});
				
				// ---------------- RETURN --------------
				return;
			}
			
			// If the job is in-progress, then just get out and try again later.
			if (nextJob.statusOfTransactionPromise == ethereum_transactions.EnumDelayedEthTransStatus.in_progress) {
				// ---------------- RETURN --------------
				return;
			}
			
			// Is it rejected?
			if (nextJob.statusOfTransactionPromise == ethereum_transactions.EnumDelayedEthTransStatus.rejected) {
				// TODO: Retry logic should go here for failed transactions, including potential PubNub
				//  broadcasts to interested parties.
				//
				// For now just post an error message and write an error to the Ethereum transactions log.
				let errMsg =
					errPrefix
					+ 'The following delayed transaction was REJECTED: ' + nextJob._operationDesc
					+ ' Object ID -> '
					+ nextJob.id;
				
				console.log(errMsg);
				winstonLogger.log('error', errMsg);
				
				// Remove the failed job.
				self._remove();
			}
			// Is it resolved?
			else if (nextJob.statusOfTransactionPromise == ethereum_transactions.EnumDelayedEthTransStatus.resolved) {
				// Log it.
				console.log(
					errPrefix
					+ 'The following delayed transaction was RESOLVED: '
					+ nextJob._operationDesc
					+ ' Object ID -> '
					+ nextJob.id);
				
				// Remove the successful job.
				self._remove();
			}
			else {
				// Don't know how to handle this status type.
				throw new Error(errPrefix + 'Invalid delayed Ethereum transaction status.');
			}
		}
		catch(err)
		{
			// Just log it for now.
			console.log(err.message);
		}
	}
	
	// Create an interval that executes the polling function once a second.
	this._interval = setInterval(_executiveFunc, 1000);
	
	// If we get notification of a program termination, stop the polling interval function.
	process.on('SIGNINT', function()
		{
			// Break the loop that waits for Ethereum blocks.  We are exiting.
			clearInterval(self._interval);
		});

	return this;
})();

/**
 * Quick test of the deferred transaction queue.
 */
function testQueue() {
	let dummyPromise = new Promise(function(resolve, reject) {});

	let dummy = new DelayedSignedTransactionExecution(web3, dummyPromise, "dummy 1");
	
	DeferredTransactionExecutor._add(dummy);
	
	dummy = new DelayedSignedTransactionExecution(web3, dummyPromise, "dummy 2");
	
	DeferredTransactionExecutor._add(dummy);

	let firstRec = 	DeferredTransactionExecutor._first();
	let lastRec = 	DeferredTransactionExecutor.last();
	
	DeferredTransactionExecutor._remove(dummy);
	
	firstRec = 	DeferredTransactionExecutor._first();
	lastRec = 	DeferredTransactionExecutor.last();
	
	dummy = new DelayedSignedTransactionExecution(web3, dummyPromise, "dummy 3");
	DeferredTransactionExecutor._add(dummy);
	
	firstRec = 	DeferredTransactionExecutor._first();
	lastRec = 	DeferredTransactionExecutor.last();
	
	nextRecToProcess = DeferredTransactionExecutor._removeAndReturn();
	
	firstRec = 	DeferredTransactionExecutor._first();
	lastRec = 	DeferredTransactionExecutor.last();
	bIsQueueEmpty = DeferredTransactionExecutor.isEmpty();
	
	nextRecToProcess = DeferredTransactionExecutor._removeAndReturn();
	
	firstRec = 	DeferredTransactionExecutor._first();
	lastRec = 	DeferredTransactionExecutor.last();
	bIsQueueEmpty = DeferredTransactionExecutor.isEmpty();
}

module.exports = {
	// DeferredTransactionExecutor: DeferredTransactionExecutor,
	// doSignedTransaction_promise: doSignedTransaction_promise,
	// DUMMY_ETHEREUM_TRANSACTION_ID: DUMMY_ETHEREUM_TRANSACTION_ID,
	// SignedTransactionResult: SignedTransactionResult,
	// testQueue: testQueue,
	// WaitForEthereumBlocks: WaitForEthereumBlocks
}





