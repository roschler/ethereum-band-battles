// FILE: check-balances-on-ganache.js

// This utility queries the current contract Ether Band Battles instance on
//  Ganache for certain accounts and owner IDs (i.e. - YouTube channel ID
//  etc.) so we can validate the results of playing a TBB game.

// This utility script simply shell executes truffle with various command line
//  parameters and environment variables.  It was created solely for the purpose
//  of allowing us to keep our environment variables in the WebStorm IDE
//  run/debug configurations.

const uuidV4 = require('uuid/v4');

const argv = require('minimist')(process.argv);
const common_routines = require('../common/common-routines');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');

const logging_helpers_lib = require('../common/logging-helpers');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
const EthereumGlobals = require('../ethereum/ethereum-globals').EthereumGlobals;

const { exec } = require("child_process");

let errPrefix = `(check-balances-on-ganache.js) `;

/**
 * Simple object to hold an ID string and the blockchain balance
 *  associated with that ID.
 *
 * @constructor
 */
function ID_And_Balance() {
	const self = this;
	let methodName = self.constructor.name + '::' + `constructor`;
	let errPrefix = '(' + methodName + ') ';
	
	/** @property {string} - A randomly generated unique ID for this object. */
	this.id = uuidV4();
	
	/** @property {Date} - The date/time this object was created. */
	this.dtCreated = Date.now();
	
	/** @property {String} - The ID of the entity that is associated with the balance. */
	this.idOfOwner = null;
	
	/** @property {Number} - The amount of value associated with the
	* 	 public blockchain address this object holds.  */
	this.balance = null;
	
	/**
	 * Show the relevant contents of this object in a formatted string.
	 */
	this.toString = function() {
		return `Address: ${self.idOfOwner}, Balance: ${self.balance}`;
	}
}

/**
 * Get the balances from the ThetaBandBattles smart contract for
 * 	each of the addresses in the given array of public addresses
 * 	given to us.
 *
 * @param {Array<string>} aryidOfOwner - An array of public addresses.
 *
 * @return {Promise<Array<ID_And_Balance>} - Returns and array of
 * 	ID_And_Balance objects, one for each public address given to us.
 */
async function getMultipleBalances(aryidOfOwner) {
	let errPrefix = `(getMultipleBalances) `;
	
	if (!Array.isArray(aryidOfOwner))
		throw new Error(errPrefix + `The aryidOfOwner parameter value is not an array.`);
		
	if (aryidOfOwner.length < 1)
		throw new Error(errPrefix + `The aryidOfOwner array is empty.`);
		
	let retAryIdAndBalance = new Array();
	
	for (let ndx = 0; ndx < aryidOfOwner.length; ndx++)
	{
		let idOfOwner = aryidOfOwner[ndx];
	
		// Query the smart contract for each balance.
		let actualAccountBalance = await EthereumGlobals.web3Global.eth.getBalance(idOfOwner)
		.catch(err => {
			let errMsg =
				errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
			
			console.error(errMsg + `Unable to fetch balance for public address: ${idOfOwner}. promise/catch.`);
		});
		
		// Accumulate the result.
		let idAndBalance = new ID_And_Balance();
		
		idAndBalance.balance = actualAccountBalance;
		idAndBalance.idOfOwner = idOfOwner;
		
		retAryIdAndBalance.push(idAndBalance);
	}
	
	return retAryIdAndBalance;
}

/**
 * Get the balances from the ThetaBandBattles smart contract for
 * 	each of the addresses in the given array of public addresses
 * 	given to us.
 *
 * @param {Object} - A smart contract instance.
 * @param {Array<string>} aryOwnerIDs - An array of owner IDs.
 *
 * @return {Promise<Array<ID_And_Balance>} - Returns and array of
 * 	ID_And_Balance objects, one for each owner ID given to us.
 */
async function getMultipleEscrowAmounts(contractInstance, aryOwnerIDs) {
	let errPrefix = `(getMultipleEscrowAmounts) `;
	
	if (!misc_shared_lib.isNonNullObjectAndNotArray(contractInstance))
		throw new Error(errPrefix + `The value in the contractInstance parameter is invalid.`);
	
	if (!Array.isArray(aryOwnerIDs))
		throw new Error(errPrefix + `The aryOwnerIDs parameter value is not an array.`);
		
	if (aryOwnerIDs.length < 1)
		throw new Error(errPrefix + `The aryOwnerIDs array is empty.`);
		
	let retAryIdAndBalance = new Array();
	
	for (let ndx = 0; ndx < aryOwnerIDs.length; ndx++)
	{
		let ownerID = aryOwnerIDs[ndx];
		
		// Format the owner ID for Solidity's use.
		let formattedOwnerID = EthereumGlobals.web3Global.utils.fromAscii(ownerID);
	
		// Query the smart contract for each escrow amount.
		let actualAccountBalance = await contractInstance.methods.getEscrowBalance(formattedOwnerID).call()
		.catch(err => {
			let errMsg =
				errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
			
			console.error(errMsg + `Unable to fetch escrow amount for owner ID: ${ownerID}. promise/catch.`);
		});
		
		// Accumulate the result.
		let idAndBalance = new ID_And_Balance();
		
		idAndBalance.balance = actualAccountBalance;
		idAndBalance.idOfOwner = ownerID;
		
		retAryIdAndBalance.push(idAndBalance);
	}
	
	return retAryIdAndBalance;
}

try {
	let contractInstance = EthereumGlobals.ebbContractInstance;
	
	// Test our access to the contract.
	/*
	contractInstance.methods.testReturnTuple().call()
	.then(result => {
		console.log('TUPLE RETURNED: ' + result);
		
		// Get the total number of games created.
		return contractInstance.methods.getNumGamesCreated().call();
	})
	.then(result => {
		console.log(`Num games created call result: ${result}.`);
		
		// Get our address as another test using the testReturnAddress()
		//  method.
		return contractInstance.methods.testReturnAddress().call();
	})
	.then(result => {
		console.log(`testReturnAddress() call result: ${result}.`);
		
		// Get the contract balance.
		return contractInstance.methods.getContractBalance().call();
	})
	 */

	// Array of test account public addresses.
	let aryTestAccounts = [
		"0xfF44E797E2EcDDd497f958B3F985e3f25Fc248a1",
		"0xd867c5512566ef75F797B31Dd623B450e43725Ff",
		"0xE9bd36ae910c229f44310E8A9B4FdEB0f9f686a5"
	];
	
	// Array of YouTube channel IDs we use for testing.
	let aryChannelIDs = [
		"UCqK_GSMbpiV8spgD3ZGloSw", // Coin Bureau
		"UCMtJYS0PrtiUwlk6zjGDEMA", // EllioTrades Crypto
		"UCObk_g1hQBy0RKKriVX_zOQ" // Netflix is a Jok
	];
	 
	console.log('=================== BEGIN: REPORT ===============');
	contractInstance.methods.getContractBalance().call()
	.then(result => {
		let str = `Current balance of Ether Band Battles contract: ${result}.`;
		console.log(str);
		
		// Get the balances for test accounts we use.
		return getMultipleBalances(aryTestAccounts);
	})
	.then(result => {
		if (!Array.isArray(result))
			throw new Error(errPrefix + `The result parameter value is not an array.`);
			
		let aryIdAndBalance = result;
			
		// Show all the addresses and balances.
		for (let ndx = 0; ndx < aryIdAndBalance.length; ndx++)
		{
			let idAndBalanceElement = aryIdAndBalance[ndx];
			
			if (!(idAndBalanceElement instanceof ID_And_Balance))
				throw new Error(errPrefix + `The value found at array index(${ndx}) is not an ID_And_Balance object.`);

			let str = idAndBalanceElement.toString();
			console.log(str);
		}
	
		return getMultipleEscrowAmounts(contractInstance, aryChannelIDs);
	})
	.then(result => {
		if (!Array.isArray(result))
			throw new Error(errPrefix + `The result parameter value is not an array.`);
			
		let aryIdAndBalance = result;
		
		// Show all the addresses and balances.
		for (let ndx = 0; ndx < aryIdAndBalance.length; ndx++)
		{
			let idAndBalanceElement = aryIdAndBalance[ndx];
			
			if (!(idAndBalanceElement instanceof ID_And_Balance))
				throw new Error(errPrefix + `The value found at array index(${ndx}) is not an ID_And_Balance object.`);

			let str = idAndBalanceElement.toString();
			console.log(str);
		}
	
	
		console.log('=================== END  : REPORT ===============');
		process.exit(0);
		return;
	})
	.catch(err => {
		let errMsg =
			errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
			
		console.log(`[ERROR: ${errMsg}] Error during promise -> ${errMsg}`);
		process.exit(1);
	});
}
catch (err)
{
	let errMsg =
		errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
		
	console.log(`[ERROR: ${errMsg}] Error during try/catch -> ${errMsg}`);
	process.exit(1);
} // try/catch