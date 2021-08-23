/**
 * This module contains the code that interacts with the EtherBandBattles contract to discover what pending
 * 	payments need to be made by the smart contract and then creates the necessary Ethereum transactions
 * 	necessary to facilitate them.
 */

const moment_lib = require('moment');
const winstonLogger = require('../common/winston-logging-module').winstonLogger;
const logging_helpers_lib = require('../common/logging-helpers');
const common_routines = require('../common/common-routines');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
const Tx = require('ethereumjs-tx');
const EthereumGlobals = require('./ethereum-globals').EthereumGlobals;
const claimNextPayment_promise = require('./ethtrans-ebb-make-payment').claimNextPayment_promise;

/**
 * This object contains the code for facilitating the actual payments to players and bands that have
 * 	participated in games manages by the EtherBandBattles smart contract.
 *
 * @constructor
 */
// Singleton pattern.
const EthereumEbbPaymentManager = (function() {
	const self = this;
	
	/**
	 * @property The number of milliseconds to wait between polling attempts.
	 *
	 * @type {number}
	 */
	this._pollingInterval_ms = 1000;

	
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
		let errPrefix = '(EthereumEbbPaymentManager::_pollingFunc) ';
		
		// If the busy flag is still set from the last iteration, just get out
		//  and wait for that iteration to complete.
		if (self._isLastPollingFuncStillBusy) {
			// Log the occurrence.
			// let logMsg = errPrefix + 'Polling function iteration skipped because the last iteration is still busy.';

			// winstonLogger.log('info', logMsg);
			return;
		}
	
		// Set the busy flag for this iteration.  This really isn't necessary since the polling function is
		//  not on an interval but persists by calling setTimeout() after each iteration.  But leaving it
		//	here just in case to avoid re-entrancy problems.
		self._setBusyFlag();
		
		try {
			// Ask the smart contract how many pending payments there are for the entire contract.
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			contractInstance.methods.getPendingPaymentCount().call()
			.then(function(result) {
				// Result should be the number of payments that still need to be made.  Currently the
				//  smart contract returns the value as a string.
				let pendingPaymentsCount = 0;
 
				if (typeof result == 'number')
					pendingPaymentsCount = result;
				else if (typeof result == 'string')
					pendingPaymentsCount = parseInt(result);
				else
					throw new Error(errPrefix + 'The result of the getPendingPaymentCount() call was not numeric.');
				
				if (pendingPaymentsCount > 0 )
				{
					console.log('The EtherBandBattlesManager smart contract says there are this many pending payments: ' + pendingPaymentsCount.toString());
					return claimNextPayment_promise();
				}
				else
					// Just get out and check again later for pending payments.
					return true;
			})
			.then(result => {
				// Make sure the busy flag is always cleared.
				self._clearBusyFlag();
				
				// Schedule another check but wait one second to go easier on the Infura API.
				setTimeout(self._pollingFunc, self._pollingInterval_ms);
			})
			.catch(function(err)
			{
				let errMsg  =
						errPrefix
						+ misc_shared_lib.conformErrorObjectMsg(err);
						
				console.error(errMsg);
				winstonLogger.log('error', errMsg);
				
				// Make sure the busy flag is always cleared.
				self._clearBusyFlag();
			});
		}
		catch(err) {
			let errMsg  =
					errPrefix
					+ misc_shared_lib.conformErrorObjectMsg(err);
					
			console.error(errMsg);
			winstonLogger.log('error', errMsg);
				
			// Make sure the busy flag is always cleared.
			self._clearBusyFlag();
		}
	}
	

	// Start the polling "loop".
	setTimeout(self._pollingFunc, self._pollingInterval_ms);
	// console.warn('The payment manager polling function is currently disabled.');

	
	// If we get notification of a program termination, stop the polling interval function.
	process.on('SIGNINT', function()
		{
			// Break the loop that waits for Ethereum blocks.  We are exiting.
			clearInterval(self._interval);
		});

	
	return this;
})();