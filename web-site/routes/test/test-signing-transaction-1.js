/**
 * Test a sending of a signed transaction.
 *
 */

// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

const express = require('express');
const router = express.Router();

const http_status_codes = require('http-status-codes');

// Lodash utility library.  Load the full build.
const _ = require('lodash');

const common_routines = require('../../common/common-routines');
// const ethereum_server_side_only = require('../../private-objects/ethereum-server-side-only');

router.get('/test/test-signing-transaction-1', function(req, res, next) {
	// At first, we assume any errors are due to a bad PIN.
	let httpRetStatusCode = http_status_codes.UNAUTHORIZED;
	
    try
    {
    	let errPrefix = '(/test/test-signing-transaction-1) ';
    	
		// Localhost use only and with a valid PIN.
		common_routines.localhostAndCheckPinOrDie(req, res);
		
		// Test the getNumGamesCreated() smart contract method belonging ot the EtherBandBattlesManager
		//  smart contract.
		//
		// Execute a server side signed transaction that calls the getNumGamesCreated() smart
		//  contract method.
		// TODO: Is it necessary to use a signed transaction here?  Isn't getNumGamesCreated() a
		//  'view' function?
		ethereum_server_side_only.doServerSideSignedTransaction_promise(
			'dummy game id',
			'get the number of games created',
			(contractInstance) => {
				return contractInstance.methods.getNumGamesCreated();
		})
		.then(function(txHash) {
			// Return a successfulConfirmation result to the caller.
			res.status(http_status_codes.OK).send('Transaction succeeded.  Tx hash: ' + txHash.blockHash);
		})
		.catch(function(err)
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during transaction signing test while getting accounts (promise). Details -> ' + err.message);
			res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during server side signed transaction test.');
			return;
		});
	}
    catch (err)
    {
        console.log('[ERROR: test-signing-transaction-1] Error during request -> ' + err.message);
        res.status(httpRetStatusCode).send(err.message);
        return;
    } // try/catch
});

module.exports = router;

