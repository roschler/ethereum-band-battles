/**
 * This module contains helper functions to help with variaous tasks related to the
 * 	EtherBandBattles manager contractsmart .
 */

const misc_shared_lib = require('../public/javascripts/misc/misc-shared');

const EthereumGlobals = require('./ethereum-globals').EthereumGlobals;
const EnumGameState = require('../common/solidity-helpers-misc').EnumGameState;
const enumGameStateToString = require('../common/solidity-helpers-misc').enumGameStateToString;
const isValidGameState = require('../common/solidity-helpers-misc').isValidGameState;

/**
 * This function conforms a result value to a numeric value.  The incoming result
 * 	value may be of type "number" or "string".  All other types will result
 * 	in an error being thrown.
 *
 * @param {number|string} result - The result value to conform to a number.
 *
 * @return {number}
 */
function conformResultToNumber(result) {
	let errPrefix = '(conformResultToNumber) ';
	
	let retVal = null;

	if (typeof result == 'undefined')
		throw new Error(errPrefix + 'The result parameter is undefined.');
		
	if (typeof result == null)
		throw new Error(errPrefix + 'The result parameter is unassigned.');
		
	if (typeof result == 'number')
		retVal = result;
		
	if (typeof result == 'string') {
		// Try to parse the string result into a number.  This is the expected
		//  return format from the smart contract.
		try {
			retVal = parseInt(result)
		}
		catch(err) {
			let strConformedErrMsg = misc_shared_lib.conformErrorObjectMsg(err);
		
			// Could not parse the string result as a number.  Reject this promise.
			let errMsg =
				'Unable to parse the string result from the smart contract as a number.  Details: '
				+ ' : '
				+ strConformedErrMsg;
				
			throw new Error(errMsg);
		}
	}
	
	return retVal;
}

/**
 * This function validates a smart contract based game ID.
 *
 * @param {number} idInSmartContract - The smart contract game ID to inspect.
 */
function validateIdInSmartContract(idInSmartContract) {
	let errPrefix = '(validateIdInSmartContract) ';
	
	if (!idInSmartContract)
		throw new Error(errPrefix + 'The ID in smart contract parameter is missing.');
	
	if (typeof idInSmartContract != 'number')
		throw new Error(errPrefix + 'The ID in smart contract parameter is not a number.');
	
	if (typeof idInSmartContract < 0)
		throw new Error(errPrefix + 'The ID in smart contract parameter is negative.');
	
	if (typeof idInSmartContract == 0)
		throw new Error(errPrefix + 'The ID in smart contract parameter is zero.  A valid game ID is 1 or greater.');
}

/**
 * This function calls the get game state method in the smart contract and returns
 * 	the result as an EnumGameState value.
 *
 * @return {Promise<any>}
 */
function getGameState_promise(idInSmartContract) {
	let errPrefix = '(getGameState_promise) ';
	
	return new Promise(function(resolve, reject) {
		try
		{
			validateIdInSmartContract(idInSmartContract);

			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			// The smart contract MUST have the game set to the STARTED game state. Therefore, we make
			// 	a call to the getGameState() contract method to get the current game state.
			contractInstance.methods.getGameState(idInSmartContract).call()
			.then(function(result) {
				let enGameState = conformResultToNumber(result);
				
				// Validate the game state received.
				if (!isValidGameState(enGameState))
					throw new Error('Invalid game state received from the smart contract. ');
				
				// Resolve the promise with the game state received from the smart contract.
				resolve(enGameState);
			})
			.catch(function(err)
			{
				// Convert the error to a promise rejection.
				let errMsg =
					errPrefix + conformErrorObjectMsg(err);
				
				reject(errMsg + '  - promise');
			});
		}
		catch(err)
		{
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);
			
			reject(errMsg + '  - try/catch');
		}
	});
}

/** This function returns a promise that calls the smart contract method that
 * 	gets the smart contract game ID for a particular game.  The ID is
 * 	returned in numeric format.
 *
 * @param {string} requestNonceFormatted - The formatted request nonce used
 * 	during the create game call to the smart contract.
 *
 * @return {Promise<number>}
 */
function getGameId_promise(requestNonceFormatted) {
	return new Promise(function(resolve, reject) {
		try
		{
			let errPrefix = '(getGameId_promise) ';
			
			if (misc_shared_lib.isEmptySafeString(requestNonceFormatted))
				throw new Error(errPrefix + 'The formatted request nonce is empty.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;

				// Execute the getGameId() contract method using the request nonce that was
				//  used during the makeGame() call.
			contractInstance.methods.getGameId(requestNonceFormatted).call()
			.then(function(result) {
				// Result should be the game ID in string format.
				let idInSmartContract = conformResultToNumber(result);

				// Resolve the
				resolve(idInSmartContract);
			})
			.catch(function(err)
			{
				// Reject the promise with the error object.
				reject(err);
			});
		}
		catch(err)
		{
			// Reject the promise with the error object.
			reject(err);
		}
	});
}
module.exports = {
	conformResultToNumber: conformResultToNumber,
	getGameId_promise: getGameId_promise,
	getGameState_promise: getGameState_promise
}