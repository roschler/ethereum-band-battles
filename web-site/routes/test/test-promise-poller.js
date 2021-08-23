/**
 * This file contains code to test the promise-poller package.
 *
 * NOTE: This paradigm is ABANDONED for now since we centralized ALL
 * 	the polling operations into a single module to avoid an avalanche
 * 	of threads waiting for Ethereum transactions to succeed.
 */
// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

var express = require("express");
const http_status_codes = require('http-status-codes');
const router = express.Router();
// v4 for "random" uuid creation mode.

const common_routines = require('../../common/common-routines');

import promisePoller from 'promise-poller';

var countSeconds = 0;

function doPoll(numSecondsToWait)
{
	return new Promise(function (resolve, reject)
	{
		let errPrefix = '(doPollForMakeGameConfirmation) ';
		
		try {
			if (numSecondsToWait <= 0)
				throw new Error(errPrefix + 'Invalid number of seconds to wait: ' + numSecondsToWait);
			
			if (common_routines.isEmptyString(gameDetailsObj.requestNonceFormatted))
				throw new Error(errPrefix + 'The formatted request nonce is empty.');
	
			if (countSeconds > numSecondsToWait)
				// Success, resolve the promise with the number of seconds waited.
				resolve(countSeconds);
			else
			{
				// Continue.  Show a log message with the current seconds count.
				console.log('Current seconds = ' + countSeconds);
				countSeconds = countSeconds + 1;
			}
		}
		catch(err)
		{
			// Log the error message.
			console.error(err.message);
			
			// Returning FALSE cancels the polling operation.
			return false;
		}
	});
}

function poll(numSecondsToWait)
{
	let errPrefix = '(pollForMakeGameConfirmation) ';
	
	// Build the promise that polls the smart contract for us until we
	//  receive a valid game ID or it times out.
	let poller =
		promisePoller({
			interval: 1000, // Wait one second between attempts.
			masterTimeout: 10,
			retries: 0,
			taskFn: poll(5)
		})
		
	// Repeatedly call the EtherBandBattlesManager getGameId() function until it has
	//  a non-zero result for our requestNonce.
	
}

router.get('/test-promise-poller',function(req,res, next){
    try
    {
    	var errPrefix = '(test-promise-poller) ';

    }
    catch (err)
    {
        console.log('[ERROR: test-promise-poller] Details -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the promise-poller package test.');
        return;
    } // try/catch

});

module.exports = router;
