/**
 * This module contains code that creates the various promises needed to execute
 * 	the Ethereum transactions we need.
 *
 * NOTE: This is the OLD/LEGACY CODE for handling Ethereum transactions, before
 * 	we created the new framework.
 *
 */
// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

const common_routines = require('../common/common-routines');
const ebbDetails = require('../common/contract-details').EtherBandBattlesManager_details;
const misc_shared_lib = require ('../public/javascripts/misc/misc-shared');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
const EnumEthereumTransactionType_ebb = require('../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
// const ethereum_transactions = require('../process/ethereum-transactions');



/**
 * This SERVER side function executes preamble code that is common to all the confirmation functions.
 *
 * @param {string} errPrefix - The desired error prefix to use when throwing an error
 * 	if an error occurs.
 * @param {Object} gameDetailsObj - A valid game details object.
 *
 * @return {Object} - Returns an instance of the EtherBandBattlesManager contract at the
 * 	 the address the contract is deployed at for the network ID associated with the game
 * 	 details object.
 */
function ethConfirmCommon_server_side(errPrefix, gameDetailsObj) {
	if (!gameDetailsObj)
		throw new Error(errPrefix + 'The game details object is unassigned.');
	
	// What is the target Ethereum network?
	let ethereumNetworkId = gameDetailsObj.ethereumNetworkId;
	
	if (ethereumNetworkId == solidity_helpers_misc.EnumEthereumNetwork.NOTSET)
		throw new Error(errPrefix + 'The ethereum network ID is not set.');
		
	// We must have the request nonce used during the makeGame() contract
	//  method call.
	if (common_routines.isEmptyString(gameDetailsObj.requestNonceFormatted))
		throw new Error(errPrefix + 'The formatted request nonce in the game details object is empty.');
	
	// TODO: Note, we are assuming the use of the account 0 in the target network
	//  client wallet.  Is this a valid assumption and is there a more robust
	//  way to make sure all the elements used here belong to the same
	//  account?
	let theWeb3ProviderUrl = solidity_helpers_misc.getWeb3ProviderUrl(ethereumNetworkId);
	
	web3.setProvider(new web3.providers.HttpProvider(theWeb3ProviderUrl));
	
	// Get the last deployment address for the EtherBandBattlesManager contract
	//	on the target network.
	let contractDeployedAt = ebbDetails.findDeployedAt(ethereumNetworkId);
	
	// Now build an instance of the contract and return it.
	// web3, enEthereumNetworkId, options = {}, bErrorIfNotFound = true
	let contractInstance = ebbDetails.getContractInstance_server_side(web3, gameDetailsObj.ethereumNetworkId);
	
	console.log(errPrefix + 'USING CONTRACT ADDRESS: ' + contractInstance._address);

	return contractInstance;
}

/**
 * This object curries the game details and user details objects provided with the constructor so that
 * 	you can create a promise that calls that Ethereum confirmation
 * 	method for the addPlayer() contract method.  This allows you to delay
 * 	completely the execution of this call until it is truly needed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 * @param {UserDetails} userDetailsObj - A valid user details object.
 * @param {string} ethereumTransactionTrackingId - The ID that was assigned by us to
 * 	track the Ethereum transaction that created a new game.
 *
 * @constructor
 */
function EBB_ConfirmAddPlayer_promise_builder(gameDetailsObj, userDetailsObj, ethereumTransactionTrackingId)
{
	var self = this;
	
	let errPrefix = '(EBB_ConfirmMakeGame_promise_builder) ';
	
	if (!gameDetailsObj)
		throw new Error(errPrefix + 'The game details object is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(ethereumTransactionTrackingId))
		throw new Error(errPrefix + 'The Ethereum transaction ID is empty.');
		
	// Make sure we have a valid smart contract game ID.
	if (gameDetailsObj.idInSmartContract < 1)
		throw new Error(errPrefix + 'Invalid smart contract game ID: ' + gameDetailsObj.idInSmartContract);

	/** @property {GameDetails} - A valid game details object. */
	this.gameDetailsObj = gameDetailsObj;
	
	/** @property {UserDetails} - A valid user details object. */
	this.userDetailsObj = userDetailsObj;
	
	/**
	 * This method uses the game details and user details objects that were provided at the
	 * 	the time of this object's construction to create a promise that
	 * 	will call the smart contract method that checks to see if a user
	 * 	exists in a particular game yet.
	 *
	 * @return {Promise<EthereumTransactionResult_ebb>}
	 */
		
	this.buildPromise = function()
	{
		return new Promise(function(resolve, reject) {
			let errPrefix = '(EBB_ConfirmAddPlayer_promise_builder::buildPromise) ';
			
			let contractInstance = ethConfirmCommon_server_side(errPrefix, self.gameDetailsObj);
			
			// Execute the getIsPlayerInGame() contract method using the request nonce that was
			//  used during the makeGame() call.
			contractInstance.methods.getIsPlayerInGame(
				self.gameDetailsObj.idInSmartContract,
				self.userDetailsObj.ethereumPublicAddress).call()
			.then(function(result) {
				// Result should be TRUE or FALSE indicating whether or not the given
				//  game has a record of the player being in the game.
				let bIsPlayerInGame = result;
	
				// Resolve the promise with the successfulConfirmation or failure of our
				// 	transaction confirmation attempt and the given game details object
				// 	embedded in a EthereumTransactionResult_ebb	object.
				//
				//
				// Build a transaction result for this promise.  We set the
				//  flag that tells the client side code whether or not to update their
				//  copy of the user details object from the one we're storing in the
				//  the transaction result to TRUE.  We do this because the on-success
				//  promise (if any) may have updated the user details object with
				//	important information.
				let ethTransResult =
					new EthereumTransactionResult(
						EnumEthereumTransactionType_ebb.add_player,
						self.gameDetailsObj,
						bIsPlayerInGame,
						self.userDetailsObj,
						true,
						ethereumTransactionTrackingId);
				
				// Save the result.
				ethTransResult.ethereumResult = result;
				resolve(ethTransResult);
			})
			.catch(function(err)
			{
				// Reject the promise with the error object.
				reject(err);
			});
		});
	}
}

/**
 * This object curries the game details object and the round number provided with the constructor so that
 * 	you can create a promise that calls that Ethereum confirmation
 * 	method for the addGameRoundResult() contract method.  This allows you to delay
 * 	completely the execution of this call until it is truly needed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 * @param {number} roundNumber - The round number to check on.
 * @param {string} ethereumTransactionTrackingId - The ID that was assigned by us to
 * 	track the Ethereum transaction that created a new game.
 *
 * @constructor
 */
function EBB_ConfirmAddGameRoundResult_promise_builder(gameDetailsObj, roundNumber, ethereumTransactionTrackingId)
{
	var self = this;
	
	let errPrefix = '(EBB_ConfirmAddGameRoundResult_promise_builder) ';
	
	if (!gameDetailsObj)
		throw new Error(errPrefix + 'The game details object is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(ethereumTransactionTrackingId))
		throw new Error(errPrefix + 'The Ethereum transaction ID is empty.');
		
	// Make sure we have a valid smart contract game ID.
	if (gameDetailsObj.idInSmartContract < 1)
		throw new Error(errPrefix + 'Invalid smart contract game ID: ' + gameDetailsObj.idInSmartContract);
		
	// Make sure we have a valid round number.
	if (!roundNumber || roundNumber < 1)
		throw new Error(errPrefix + 'Invalid round number: ' + roundNumber);
	

	/** @property {GameDetails} - A valid game details object. */
	this.gameDetailsObj = gameDetailsObj;
	
	/** @property {number} - A valid round number for the desired game. */
	this.roundNumber = roundNumber;
	
	/**
	 * This method uses the game details object that was provided at the
	 * 	the time of this object's construction to create a promise that
	 * 	will call the smart contract method that checks to see if a
	 * 	particular game round result was added to the smart contract's
	 * 	storage for the desired game.
	 *
	 * @return {Promise<EthereumTransactionResult_ebb>}
	 */
		
	this.buildPromise = function()
	{
		return new Promise(function(resolve, reject) {
			let errPrefix = '(EBB_ConfirmAddGameRoundResult_promise_builder::buildPromise) ';
			
			let contractInstance = ethConfirmCommon_server_side(errPrefix, self.gameDetailsObj);
			
			// Execute the getIsGameRoundResultPosted() contract method using the request nonce that was
			//  used during the makeGame() call.
			contractInstance.methods.getIsGameRoundResultPosted(
				self.gameDetailsObj.idInSmartContract,
				self.roundNumber).call()
			.then(function(result) {
				// Result should be TRUE or FALSE indicating whether or not the given
				//  game has a record of a game round result for the given round number.
				let bIsGameRoundResultRecorded = result;
	
				// Resolve the promise with the successfulConfirmation or failure of our
				// 	transaction confirmation attempt and the given game details object
				// 	embedded in a EthereumTransactionResult_ebb	object.
				//
				//
				// Build a transaction result for this promise.  We set the
				//  flag that tells the client side code whether or not to update their
				//  copy of the user details object from the one we're storing in the
				//  the transaction result to TRUE.  We do this because the on-success
				//  promise (if any) may have updated the user details object with
				//	important information.
				let ethTransResult =
					new EthereumTransactionResult(
						EnumEthereumTransactionType_ebb.add_player,
						self.gameDetailsObj,
						bIsGameRoundResultRecorded,
						roundNumber,
						false,
						ethereumTransactionTrackingId);
				
				// Save the result.
				ethTransResult.ethereumResult = result;
				resolve(ethTransResult);
			})
			.catch(function(err)
			{
				// Reject the promise with the error object.
				reject(err);
			});
		});
	}
}

/**
 * This object curries the game details object provided with the constructor so that
 * 	you can create a promise that calls that Ethereum confirmation
 * 	method for the makeGame() contract method.  This allows you to delay
 * 	completely the execution of this call until it is truly needed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 * @param {string} ethereumTransactionTrackingId - The ID that was assigned by us to
 * 	track the Ethereum transaction that created a new game.
 *
 * @constructor
 */
function EBB_ConfirmMakeGame_promise_builder(gameDetailsObj, ethereumTransactionTrackingId)
{
	var self = this;
	
	let errPrefix = '(EBB_ConfirmMakeGame_promise_builder) ';
	
	if (!gameDetailsObj)
		throw new Error(errPrefix + 'The game details object is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(ethereumTransactionTrackingId))
		throw new Error(errPrefix + 'The Ethereum transaction ID is empty.');

	/** @property {GameDetails} - A valid game details object. */
	this.gameDetailsObj = gameDetailsObj;
	
	/**
	 * This method uses the game details object that was provided at the
	 * 	the time of this object's construction to create a promise that
	 * 	will call the smart contract method that checks to see if a game
	 * 	ID exists yet for the request nonce associated with the game details
	 * 	object.
	 *
	 * @return {Promise<EthereumTransactionResult_ebb>}
	 */
		
	this.buildPromise = function()
	{
		return new Promise(function(resolve, reject) {
			try
			{
				let errPrefix = '(EBB_ConfirmMakeGame_promise_builder::buildPromise) ';
				
				let contractInstance = ethConfirmCommon_server_side(errPrefix, self.gameDetailsObj);
				
				// We get the number of games created so far in the contract as a pre-test.
				contractInstance.methods.getNumGamesCreated().call()
				.then(function(result) {
					let numGamesCreated = result;
					
					console.log(errPrefix + "The current number of games created reported by the smart contract is: " + numGamesCreated);
					
					// Execute the getGameId() contract method using the request nonce that was
					//  used during the makeGame() call.
					return contractInstance.methods.getGameId(gameDetailsObj.requestNonceFormatted).call()
				})
				.then(function(result) {
					// Result should be the game ID.  A zero result indicates that the
					//  image of the smart contract that contains the newly created game
					// 	has not been written to the blockchain yet.
					let bNewGameIsReady = result > 0;
		
					// Resolve the promise with the successfulConfirmation or failure of our
					// 	transaction confirmation attempt and the given game details object
					// 	embedded in a EthereumTransactionResult_ebb	object.
					//
					// Build a transaction result for this promise.  We set the
					//  flag that tells the client side code whether or not to update their
					//  copy of the game details object from the one we're storing in the
					//  the transaction result to TRUE.  We do this because the on-success
					//  promise (if any) may have updated the game details object with
					//	important information.
					let ethTransResult =
						new EthereumTransactionResult(
							EnumEthereumTransactionType_ebb.game_creation,
							gameDetailsObj,
							bNewGameIsReady,
							null,
							true,
							ethereumTransactionTrackingId);
					
					// Save the result.
					ethTransResult.ethereumResult = result;
					resolve(ethTransResult);
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
}

/**
 * This object curries the game details object provided with the constructor so that
 * 	you can create a promise that calls that Ethereum confirmation
 * 	method for the makePayments() contract method.  This allows you to delay
 * 	completely the execution of this call until it is truly needed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 * @param {UserDetails} userDetailsObj - A valid user details object.
 * @param {string} ethereumTransactionTrackingId - The ID that was assigned by us to
 * 	track the Ethereum transaction that created a new game.
 *
 * @constructor
 */
function EBB_ConfirmMakePayments_promise_builder(gameDetailsObj, ethereumTransactionTrackingId)
{
	var self = this;
	
	let errPrefix = '(EBB_ConfirmMakePayments_promise_builder) ';
	
	if (!gameDetailsObj)
		throw new Error(errPrefix + 'The game details object is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(ethereumTransactionTrackingId))
		throw new Error(errPrefix + 'The Ethereum transaction ID is empty.');
		
	// Make sure we have a valid smart contract game ID.
	if (gameDetailsObj.idInSmartContract < 1)
		throw new Error(errPrefix + 'Invalid smart contract game ID: ' + gameDetailsObj.idInSmartContract);

	/** @property {GameDetails} - A valid game details object. */
	this.gameDetailsObj = gameDetailsObj;
	
	/**
	 * This method uses the game details and user details objects that were provided at the
	 * 	the time of this object's construction to create a promise that
	 * 	will call the smart contract method that checks to see if a user
	 * 	exists in a particular game yet.
	 *
	 * @return {Promise<EthereumTransactionResult_ebb>}
	 */
		
	this.buildPromise = function()
	{
		return new Promise(function(resolve, reject) {
			let errPrefix = '(EBB_ConfirmMakeGame_promise_builder::buildPromise) ';
			
			let contractInstance = ethConfirmCommon_server_side(errPrefix, self.gameDetailsObj);
			
			// Execute the getGameState() contract method using the correct game ID.
			contractInstance.methods.getGameState(
				self.gameDetailsObj.idInSmartContract).call()
			.then(function(result) {
				// Result should be the current game state.  If the state is GAME_OVER
				//  then the payments have been made or put into escrow by the
				//  smart contract for the target game.
				let bIsPaymentComplete = (result == solidity_helpers_misc.EnumGameState.GAME_OVER);
	
				// Resolve the promise with the successfulConfirmation or failure of our
				// 	transaction confirmation attempt and the given game details object
				// 	embedded in a EthereumTransactionResult_ebb	object.
				//
				//
				// Build a transaction result for this promise.  We set the
				//  flag that tells the client side code whether or not to update their
				//  copy of the user details object from the one we're storing in the
				//  the transaction result to TRUE.  We do this because the on-success
				//  promise (if any) may have updated the user details object with
				//	important information.
				let ethTransResult =
					new EthereumTransactionResult(
						EnumEthereumTransactionType_ebb.finalize_game,
						self.gameDetailsObj,
						bIsPaymentComplete,
						self.userDetailsObj,
						true,
						ethereumTransactionTrackingId);
				
				// Save the result.
				ethTransResult.ethereumResult = result;
				resolve(ethTransResult);
			})
			.catch(function(err)
			{
				// Reject the promise with the error object.
				reject(err);
			});
		});
	}
}

module.exports = {
	EBB_ConfirmAddGameRoundResult_promise_builder: EBB_ConfirmAddGameRoundResult_promise_builder,
	EBB_ConfirmAddPlayer_promise_builder: EBB_ConfirmAddPlayer_promise_builder,
	EBB_ConfirmMakeGame_promise_builder: EBB_ConfirmMakeGame_promise_builder,
	EBB_ConfirmMakePayments_promise_builder: EBB_ConfirmMakePayments_promise_builder,
	ethConfirmCommon: ethConfirmCommon_server_side
};