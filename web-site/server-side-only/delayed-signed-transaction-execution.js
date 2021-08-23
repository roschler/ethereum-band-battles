/**
 * This module contains the code for using delayed signed transactions.
 *
 */

// const EnumDelayedEthTransStatus = require('../process/ethereum-transactions').EnumDelayedEthTransStatus;
const winstonLogger = require('../common/winston-logging-module').winstonLogger;
// v4 for "random" uuid creation mode.
const uuidv4 = require('uuid/v4');
const EnumDelayedEthTransStatus = require('../ethereum/ethereum-globals').EnumDelayedEthTransStatus;

/**
 * This object is used to defer the execution of a Web3 signed transaction
 * 	until later, so you don't have to wait through the lengthy delay that
 * 	is part of sending an Ethereum transaction to a non-local network.
 *
 * @param {Object} - A valid Web3 object with it's provider URL assumed to
 * 	be set.
 * @param {Promise<string>} doSignSendTransactionPromise - A promise that will sign
 * 	and send the desired transaction and returns the transaction hash
 * 	received  from the send operation.
 * @param {string} operationDesc - A simple description of the operation.  Used for
 * 	logging purposes.
 * @param {number} delay_ms - The number of milliseconds to wait before
 * 	executing the transaction.
 *
 * 	TODO: See if running your own node, instead of using Infura, eliminates
 * 		the delay that occurs with sending transactions.  This is NOT the
 * 		delay associated with waiting for a transaction to be mined.
 *
 * @constructor
 */
function DelayedSignedTransactionExecution(web3, doSignSendTransactionPromise, operationDesc, delay_ms = 100)
{
	var self = this;
	
	this._errPrefix = '(DelayedSignedTransactionExecution) ';
	
	/** @property {string} - Automatically generated unique ID. */
	this.id = uuidv4();
	
	if (!web3)
		throw new Error(this._errPrefix + 'The Web3 object is unassigned.');
		
	/** @property {Object} - A valid Web3 object. */
	this._web3 = web3;
	
	/** @property {Promise} - A promise that will format, sign, and send the Ethereum transaction. */
	if (!doSignSendTransactionPromise)
		throw new Error(this._errPrefix + 'The promise that signs and sends that transaction is unassigned.');
		
	this._doSignedTransaction_promise = doSignSendTransactionPromise;
	
	/** @property {string} - A short description of the transaction, used for logging purposes. */
	this._operationDesc = operationDesc;
	
	if (delay_ms < 1)
		throw new Error(this._errPrefix + 'Invalid execution delay(ms): ' + delay_ms);
		
	/** @property {number} - The delay in milliseconds before executing the transaction send. */
	this._delay_ms = delay_ms;
	
	/** @property {EnumDelayedEthTransStatus} statusOfTransactionPromise - The current status of
	 * 	the promise that executes the deferred transaction.
	 */
	this.statusOfTransactionPromise = EnumDelayedEthTransStatus.pending;
	
	/**
	 * If an Error occurs, use this function to log the error.
	 *
	 * @param {Object} err - An error object.
	 * @param {string} suffix - A helpful suffix to show the origin of the error, usually
	 * 	'promise' or 'try'.
	 *
	 * @private
	 */
	this._logErrorMsg = function(err, suffix = 'promise')
	{
		let errPrefix = '(_logErrorMsg) ';
		
		let errMsg = '(none)';
		
		if (err)
		{
			if (err.message)
				errMsg = err.message;
			else
				console.log(errPrefix + "The error object does not have a 'message' property.");
		}
		else
			console.log(errPrefix + 'The error object is unassigned.');
			
		let errMsgAdv =
			self._errPrefix
			+ 'Sending of signed Ethereum transaction('
			+ '>>>>>'
			+ self._operationDesc
			+ '<<<<<'
			+ ') failed with the error: ' + errMsg + ' - ' + suffix + '.'
			+ ' Object ID -> '
			+ self.id;
			
		console.log(errMsgAdv);
		winstonLogger.log('error', errMsgAdv);
	}

	/**
	 * If transaction succeeds, use this function to log the result.
	 *
	 * @param {SignedTransactionResult} signedTransResult - An object containing
	 * 	the results of the signed Ethereum transaction attempt.
	 *
	 * @private
	 */
	this._logSuccessMsg = function(signedTransResult)
	{
		let errPrefix = '(_logSuccessMsg) ';
		
		if (!signedTransResult)
			throw new Error(errPrefix + ' The signed transaction result object is unassigned.');
			
		let successMsg =
			self._errPrefix
			+ 'Sending of signed Ethereum transaction('
			+ self._operationDesc
			+ ') succeeded.' +
			+ ' Object ID -> '
			+ self.id
			+ '\n  Transaction details.' + signedTransResult.prettyPrint();
			
		console.log(successMsg);
		winstonLogger.log('info', successMsg);
	}
	
	/**
	 * Attaching a "then" operator to this function will trigger the execution of the delayed transaction.
	 */
	this.delayedExec_promise = function()
	{
		return new Promise(function (resolve, reject) {
			try {
				// self._web3.eth.sendSignedTransaction(self._serializedTx)
				self._doSignedTransaction_promise
				.then(result =>
				{
					// Just show the transaction result.
					self._logSuccessMsg(result);
					self.statusOfTransactionPromise = EnumDelayedEthTransStatus.resolved;
				})
				.catch(err => {
					self.statusOfTransactionPromise = EnumDelayedEthTransStatus.rejected;
					self._logErrorMsg(err);
				});
			}
			catch(err)
			{
				self.statusOfTransactionPromise = EnumDelayedEthTransStatus.rejected;
				self._logErrorMsg(err, 'try');
			}
		});
	}
	
	// Set a time-out to being the deferred execution.
	// setTimeout(this._delayedExec, this._delay_ms);
}

module.exports = {
	DelayedSignedTransactionExecution: DelayedSignedTransactionExecution
};