/**
 * This file contains a primary server side test of the EtherBandBattles smart contract, without using
 * 	Metamask.
 *
 */
const express = require('express');
const router = express.Router();

const http_status_codes = require('http-status-codes');

// Lodash utility library.  Load the full build.
const _ = require('lodash');

const common_routines = require('../../common/common-routines');
const Tx = require('ethereumjs-tx');
const misc_shared_lib = require ('../../public/javascripts/misc/misc-shared');
const logging_helpers_lib = require('../../common/logging-helpers');
const solidity_helpers_misc = require('../../common/solidity-helpers-misc');
// const defaultLoggingDetailsFunc = require('../ethereum/ethereum-state-machine').defaultLoggingDetailsFunc;
const EthereumGlobals = require('../../ethereum/ethereum-globals').EthereumGlobals;
const ethereum_js_util = require('ethereumjs-util');

// ----------------------------------------------------------------------

//const Web3 = require('web3')
//const web3 = new Web3()

/*
router.get('/test/test-1', function(req, res, next) {
	// At first, we assume any errors are due to a bad PIN.
	let httpRetStatusCode = http_status_codes.UNAUTHORIZED;

    try
    {
		let errPrefix = '(broadcastMessage) ';
		
		// Localhost use only and with a valid PIN.
		common_routines.localhostAndCheckPinOrDie(req, res);
		
		// Any errors after this point are considered internal server errors.
		httpRetStatusCode = http_status_codes.INTERNAL_SERVER_ERROR;
		
		// TODO: Note, we are assuming the use of the account 0 in the Ganache
		//  client wallet.  Is this a valid assumption and is there a more robust
		//  way to make sure all the elements used here belong to the same
		//  account?
		let theWeb3ProviderUrl = 'http://localhost:8545';
		web3.setProvider(new web3.providers.HttpProvider(theWeb3ProviderUrl));
		
		web3.eth.getAccounts()
		.then(function (aryAccounts)
		{
			if (common_routines.isArrayAndNotEmpty(aryAccounts))
			{
				// Get the account balance.
				return web3.eth.getBalance(aryAccounts[0]);
			}
			else
			{
				console.log("The JSON RPC response to our accounts query was not an array: ");
				console.log(aryAccounts);
				console.log("Is the target Ethereum network running and are you using the correct URL and HTTP/HTTPS protocol? (e.g. - Ganache)");
				return null;
			}
		})
		.then(function(accountBalance) {
			doTestBody(req, res, accountBalance);
		})
		.catch(function(err)
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during transaction signing test while getting accounts (promise). Details -> ' + err.message);
			res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during get game object request.');
			return;
		});
	}
    catch (err)
    {
        console.log('[ERROR: test_1js] Error during request -> ' + err.message);
        res.status(httpRetStatusCode).send(err.message);
        return;
    } // try/catch
});
*/

function TestObj() {
	this.retryCount = 0;
	this.isLooping = true;
	this.isDeleted = false;

	this.executionLoop = function() {
		let errPrefix = '(executionLoop) ';
		
		try	{
			// Save the retry count so we can see if anyone changed it while we are loopin.
			let savedRetryCount = self.retryCount;
			
			// Loop through the transaction's steps until we reach a completion step or
			//	we time-out.  Note, the time-out/aging code is in the _ageTransactionsInterval
			//	method sets this object's time-out flag.  The object itself does NOT.
			while (self.isLooping) {
				// Check if the "deleted" flag is set.  This should never happen while
				//  we are still active.
				if (self.isDeleted)
					throw new Error(errPrefix + 'The deletion flag is set, yet this transaction is still active.');
					
				// Wait a long time.
				misc_shared_lib.delayMS_promise(10000)
				.then(result => {
					// Did the retry count change?
					if (self.retryCount != savedRetryCount) {
						console.log('The retry count CHANGED.');
						throw new Error('Aborting execution loop because the retry count changed.');
					}
					else {
						let dt = logging_helpers_lib.formatDateTimeForLogging_default();
		
						console.log('[' + dt + '] The retry count did NOT change.  Exiting execution loop normally.');
					}
				})
				.catch(err => {
					// Convert the error to a promise rejection.
					let errMsg =
						errPrefix + errPrefix + conformErrorObjectMsg(err);

					console.error(errMsg);
				});
			}
			
		}
		catch(err) {
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + errPrefix + conformErrorObjectMsg(err);
			
			console.error(errMsg + '  - try/catch');
		}
	}
}

function intervalCode() {
	// THIS PROJECT ABANDONED FOR NOW ???
}

/*
router.get('/test/test-1', function(req, res, next) {
	// At first, we assume any errors are due to a bad PIN.
	let httpRetStatusCode = http_status_codes.UNAUTHORIZED;

    try
    {
		let errPrefix = '(broadcastMessage) ';
		
		// Localhost use only and with a valid PIN.
		common_routines.localhostAndCheckPinOrDie(req, res);
		
		let testObj = new TestObj();
		
		// Start the test object's execution loop asynchronously.
		setTimeout(testObj.executionLoop, 1000)
		.catch(function(err)
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during TEST route. Details -> ' + err.message);
			res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during get game object request.');
			return;
		});
	}
    catch (err)
    {
        console.log('[ERROR: test_1js] Error during TEST route -> ' + err.message);
        res.status(httpRetStatusCode).send(err.message);
        return;
    } // try/catch
});

*/

/*
router.get('/test/test-1', function(req, res, next) {
	// At first, we assume any errors are due to a bad PIN.
	let httpRetStatusCode = http_status_codes.UNAUTHORIZED;

    try
    {
		let errPrefix = '(test-1) ';
		
		let contractInstance = EthereumGlobals.ebbContractInstance;
		
		// Test the testReturnTuple() function in the EtherBandBattles smart contract.
		return contractInstance.methods.testReturnTuple().call()
			.then(result => {
				console.log('TUPLE RETURNED: ' + result);
			})
			.catch(err => {
				console.log('[ERROR: test_1js] Error during TEST route -> ' + err.message);
				res.status(httpRetStatusCode).send(err.message);
				return;
			});
	}
    catch (err)
    {
        console.log('[ERROR: test_1js] Error during TEST route -> ' + err.message);
        res.status(httpRetStatusCode).send(err.message);
        return;
    } // try/catch
});
*/

/*
var g_DataBag = new Object();

// TEST: Test the smart contract function that tests use of EcRecover to recover the
//  public Ethereum address for a package signed by one of our private keys.  We use
//  a SEND transaction and some gas so we can trace the result with the Truffle
//	debugger.
router.get('/test/test-1', function(req, res, next) {
	// At first, we assume any errors are due to a bad PIN.
	let httpRetStatusCode = http_status_codes.UNAUTHORIZED;

	let errPrefix = '(test-1) ';
	
	let contractInstance = EthereumGlobals.ebbContractInstance;
	
	try {
		// Ask the smart contract how many pending payments there are for the entire contract.
		let contractInstance = EthereumGlobals.ebbContractInstance;
		
		// Build a call to the testEcRrecovery call with the proper parameters.
		
		
		// var msg = '0x8CbaC5e4d803bE2A3A5cd3DbE7174504c6DD0c1C'
		g_DataBag.msg = 'hello world';
		g_DataBag.msgHashed = ethereum_js_util.keccak256(g_DataBag.msg);
		g_DataBag.msgHashedBuffToHexStr = "0x" + g_DataBag.msgHashed.toString('hex');
		g_DataBag.msgPadded32Chars = solidity_helpers_misc.padStringTo32Bytes(g_DataBag.msg);
		g_DataBag.msgPadded32CharsAsBytes32 = solidity_helpers_misc.stringToBytes32(g_DataBag.msgPadded32Chars);
		// gethClientprefix = new Buffer("\x19Ethereum Signed Message:\n");
		g_DataBag.addrToSignWith = EthereumGlobals.ebbContractHelperObj.wallet.getAddressString();
		g_DataBag.fromNonce = null;
		g_DataBag.encodedAbiForCall = null;
		g_DataBag.accounts = null;
		g_DataBag.fromRpcSig = null;
		
		// --------------------
		
		// Add prefix to message because utils.sign() does that internally.
		let msgBuf = null;
		let prefix = null;
		let msgLengthAsStrBuffer = null;
		let buffList = null;
		let concatenatedBuffList = null;
		
		let prefixedMsgBuffer = null;
		
		EthereumGlobals.getNonce_promise()
		.then(result => {
			g_DataBag.fromNonce = result;
			
			return EthereumGlobals.web3Global.eth.getAccounts();
		})
		.then(result => {
			g_DataBag.accounts = result;
			
			// TODO: Should not be getting the address from the accounts array.
			g_DataBag.addrToSignWith = g_DataBag.accounts[1];
			
			console.log('Using account #1 address: ' + g_DataBag.addrToSignWith);
			
			// Sign the message with the desired public address.
			// let str = '0x' + g_DataBag.msgHashed.toString('hex');
			// If we hash the message than the message is useless on the smart contract
			//  side since hashing is a one-way process.
			// let str = g_DataBag.msgHashedBuffToHexStr;
			// let str = ethereum_js_util.fromAscii(g_DataBag.msgPadded32Chars);
			let str = g_DataBag.msgPadded32CharsAsBytes32;
			return EthereumGlobals.web3Global.eth.sign(str, g_DataBag.addrToSignWith);
			// return EthereumGlobals.web3Global.eth.sign(h, EthereumGlobals.ebbContractHelperObj.privateKey);
		})
		.then(result => {
			let sig = result;
			
			g_DataBag.fromRpcSig = ethereum_js_util.fromRpcSig(sig);

			// Quick test to make sure we are getting back what expect before using the data with
			//  the testEcRecovery() call in the smart contract.
			/
			//let prefixedMessageStr =
			//	EthereumGlobals.web3Global.utils.sha3(
  			//		Buffer.concat([gethClientprefix, new Buffer(String(msg.length)), msg])
			// );
			
			// Add prefix to message because utils.sign() does that internally.
			prefix = new Buffer("\x19Ethereum Signed Message:\n");
			msgLengthAsStrBuffer = new Buffer(String(g_DataBag.msgPadded32Chars.length));
			msgBuf = new Buffer(g_DataBag.msgPadded32Chars);
			buffList = [prefix, msgLengthAsStrBuffer, msgBuf];
			concatenatedBuffList = Buffer.concat(buffList);
			
			// Hash the concatenated buffer list that joins the Geth client prefix, the
			// length of the message in Buffer format, and the message in Buffer format,
			// into the payload we will sign and send to testEcRecovery()
			prefixedMsgBuffer = ethereum_js_util.keccak256(concatenatedBuffList);
			
			let pubKey  		= ethereum_js_util.ecrecover(prefixedMsgBuffer, g_DataBag.fromRpcSig.v, g_DataBag.fromRpcSig.r, g_DataBag.fromRpcSig.s);
			let publicAddrBuf 	= ethereum_js_util.pubToAddress(pubKey);
			let publicAddr    	= ethereum_js_util.bufferToHex(publicAddrBuf);
			console.log('Public address recovered using Web3JS ecrecover: ' + publicAddr);

			// let contractMethodToCall = self.confirmAndCompleteObj.funcBuildCurriedMethodCall(EthereumGlobals.ebbContractInstance);
			let strHex_r = "0x" + g_DataBag.fromRpcSig.r.toString('hex');
			let strHex_s = "0x" + g_DataBag.fromRpcSig.s.toString('hex');

			g_DataBag.encodedAbiForCall = contractInstance.methods.testEcRecovery(
				// g_DataBag.msgHashedBuffToHexStr,
				g_DataBag.msgPadded32CharsAsBytes32,
				g_DataBag.fromRpcSig.v,
				strHex_r,
				strHex_s).encodeABI();
			
			// Use some high gas price and limit for testing.
			let gasPriceGwei = 0x09184e72a000;
			let gasLimit = 300000;

			
			let rawTx = {
				nonce: g_DataBag.fromNonce,
				gasPrice: gasPriceGwei,
				// Use the estimated gas.
				gasLimit: gasLimit,
				// Adding both gas and gasLimit just in case.
				// gas: estimatedGas,
				to: EthereumGlobals.ebbContractHelperObj.contractAddr,
				value: '0x00',
				data: g_DataBag.encodedAbiForCall
			}
			
			let tx = new Tx(rawTx);
			
			// Sign the transaction.
			tx.sign(EthereumGlobals.ebbContractHelperObj.privateKeyBuffer);
			
			let serializedTx = '0x' + tx.serialize().toString('hex');
			
			// Execute the getIsPlayerInGame() contract method using the request nonce that was
			//  used during the makeGame() call.
			//contractInstance.methods.getPendingPaymentCount().call()
			// Send it.
			return EthereumGlobals.web3Global.eth.sendSignedTransaction(serializedTx);
		})
		.then(function(result) {
			// TODO: Warning.  This will not work on non-local Ethereum networks like Ganache
			//	because we are not waiting on the transaction to be mined and expecting it to
			//  be mined before we do this check.  If we want to test this on non-local
			//  networks we will need to create a full-blown transaction like executed by
			//  the Ethereum State Machine.
			
			// Make the smart contract method call that retrieves the results of our last transaction
			//  on the smart contract.
			return contractInstance.methods.getLastTestEcRecoverResults().call();
		}).then(result => {
			// The result should be the input and output data of the SEND transaction we just
			//  executed using the testEcRecovery() call.
			
			// Inspect the results with the WebStorm debugger.
			let testEcRecoverResults = result;
		
			let returned_msg = testEcRecoverResults[0];
			let returned_msg_as_str = solidity_helpers_misc.decodeBytes32Return(returned_msg);
			let returned_v = testEcRecoverResults[1];
			let returned_r = testEcRecoverResults[2];
			let returned_s = testEcRecoverResults[3];
			let returned_signer_1 = testEcRecoverResults[4];
			let returned_signer_2 = testEcRecoverResults[5];
			
			// This is the original RPC signature object that was the source of the elements
			//  we passed to testEcRecovery().
			let fromRpcSig = g_DataBag.fromRpcSig;
		
			// Result should be the number of payments that still need to be made.  Currently the
			//  smart contract returns the value as a string.
			let pendingPaymentsCount = 0;

			if (typeof result == 'number')
				pendingPaymentsCount = result;
			else if (typeof result == 'string')
				pendingPaymentsCount = parseInt(result);
			else
				throw new Error(errPrefix + 'The result of the getPendingPaymentCount() call was not numeric.');
			
		})
		.catch(err => {
			console.log('[ERROR: test_1js] Error during TEST route -> ' + err.message);
			res.status(httpRetStatusCode).send(err.message);
			return;
		});
	}
    catch (err)
    {
        console.log('[ERROR: test_1js] Error during TEST route -> ' + err.message);
        res.status(httpRetStatusCode).send(err.message);
        return;
    } // try/catch
});
*/

var g_DataBag = new Object();

/**
 * Test the Solidity contract testPayment() method using the Ganache network.
 */
router.get('/test/test-1', function(req, res, next) {
	// At first, we assume any errors are due to a bad PIN.
	let httpRetStatusCode = http_status_codes.UNAUTHORIZED;

	let errPrefix = '(test-1) ';
	
	let contractInstance = EthereumGlobals.ebbContractInstance;
	
	try {
		// Ask the smart contract how many pending payments there are for the entire contract.
		let contractInstance = EthereumGlobals.ebbContractInstance;
		
		// Build a call to the testPayment method with the proper parameters.
		
		
		// --------------------

		// Payee Account index #6 in Ganache.
		let payeeAddr = '0x967E0c83a2D407cba8cBC6302D442a0E1B32d958';
		let paymentAmountGwei = 1500000000;

		EthereumGlobals.getNonce_promise()
		.then(result => {
			g_DataBag.fromNonce = result;
			
			return EthereumGlobals.web3Global.eth.getAccounts();
		})
		.then(result => {
			g_DataBag.accounts = result;
			
			g_DataBag.encodedAbiForCall = contractInstance.methods.testPayment(payeeAddr).encodeABI();
			
			// Use some high gas price and limit for testing.
			let gasPriceGwei = 0x09184e72a000;
			let gasLimit = 300000;
			
			let rawTx = {
				nonce: g_DataBag.fromNonce,
				gasPrice: gasPriceGwei,
				// Use the estimated gas.
				gasLimit: gasLimit,
				// Adding both gas and gasLimit just in case.
				// gas: estimatedGas,
				to: EthereumGlobals.ebbContractHelperObj.contractAddr,
				value: paymentAmountGwei, // '0x00',
				data: g_DataBag.encodedAbiForCall
			}
			
			let tx = new Tx(rawTx);
			
			// Sign the transaction.
			tx.sign(EthereumGlobals.ebbContractHelperObj.privateKeyBuffer);
			
			let serializedTx = '0x' + tx.serialize().toString('hex');
			
			return EthereumGlobals.web3Global.eth.sendSignedTransaction(serializedTx);
		})
		.then(result => {
			let msg = 'Payment of (' + paymentAmountGwei.toString() + ') made to payee address: ' + payeeAddr;
			
			console.log(msg);
			
			res.status(http_status_codes.OK).send(msg);
			
			return;
		})
		.catch(err => {
			console.log('[ERROR: test_1js] Error during TEST route -> ' + err.message);
			res.status(httpRetStatusCode).send(err.message);
			return;
		});
	}
    catch (err)
    {
        console.log('[ERROR: test_1js] Error during TEST route -> ' + err.message);
        res.status(httpRetStatusCode).send(err.message);
        return;
    } // try/catch
});


module.exports = router;

 