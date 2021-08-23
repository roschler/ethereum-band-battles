/** This module contains a promise and supporting code that sets the House public address
 * on the EtherBandBattles contract for the given game ID.
 */

const EnumEthereumTransactionType_ebb = require('../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
const common_routines = require("../common/common-routines");
// const defaultLoggingDetailsFunc = require('../ethereum/ethereum-state-machine').defaultLoggingDetailsFunc;
const EthereumGlobals = require('../ethereum/ethereum-globals').EthereumGlobals;
const EthereumGlobalConstants = require('../ethereum/ethereum-globals').EthereumGlobalConstants;
const EthTransConfirmAndComplete = require('../ethereum/confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthTransLifecycle = require('../ethereum/ethereum-state-machine').EthTransLifecyle;
const EthereumTransactionManager = require('../ethereum/ethereum-state-machine').EthereumTransactionManager;
const game_details_lib = require('../public/javascripts/game-objects/game-details');
const GameDetails = require('../public/javascripts/game-objects/game-details').GameDetails;
const UserDetails = require('../public/javascripts/game-objects/user-details').UserDetails;
// const updateServerSideOnlyDetailsField_promise = require('../common/redis-wrappers').updateServerSideOnlyDetailsField_promise;
const updateSSOGameDetailsGasUsed_promise = require('../common/redis-wrappers').updateSSOGameDetailsGasUsed_promise;
const GamePaymentsSummary = require('../common/game-details-server-side-only').GamePaymentsSummary;
const getGamePaymentsSummary_promise = require('../ethereum/ebb-getter-call-support').getGamePaymentsSummary_promise;
const gamemaster_lib = require('../common/game-master');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const private_payment_details_lib = require('../private-objects/private-payment-details');
const redis_wrappers_lib = require('../common/redis-wrappers');
const routes_support = require('../common/routes-support');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
const ebbDetails = require('../common/contract-details').EtherBandBattlesManager_details;
// v4 for "random" uuid creation mode.
const uuidv4 = require('uuid/v4');
const winstonLogger = require('../common/winston-logging-module').winstonLogger;
const getEthTransDataBag = require('../ethereum/ethtrans-data-bags').getEthTransDataBag;
const extractAppEventIdFromObj = require('../public/javascripts/game-objects/app-events').extractAppEventIdFromObj;
const GameDetailsServerSideOnly = require('../common/game-details-server-side-only').GameDetailsServerSideOnly;
const updateServerSideOnlyDetailsField_promise = require('../common/redis-wrappers').updateServerSideOnlyDetailsField_promise;

/**
 * This object is the data bag for the set house public address Ethereum transaction.
 *
 * @constructor
 */
function SetHousePublicAddress_bag() {
	var self = this;
	
	/** @property {string} - The app event tracking ID for the make game transaction.
	 * 		(Created on the server side) */
	this.appEventId = null;
	
	/** @property {string|null} - A valid game ID for the game whose House public address was set. */
	this.gameId = null;
	
	/** @property {number|null} - The EtherBandBattlesManager's ID for the corresponding game. */
	this.gameIdInSmartContract = null;
	
	/** @property {string} - The house public address that the game is using. */
	this.houseAddr = null;
	
	/**
	 * This function will be called by the Ethereum transaction manager when logging details about
	 * 	the Ethereum transaction this data bag represents is required.
	 *
	 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object whose transaction we are
	 * 	associated with.
	 *
	 * @return {string}
	 */
	this.funcLogging = function(lifecycleObj){
		let errPrefix = '(SetHousePublicAddress_bag::funcLogging) ';
		
		if (!lifecycleObj)
			throw new Error(errPrefix + 'The lifecycle object is unassigned.');

		let ethTransId = self.appEventId;

		return "Game Id(" + self.gameId + "), Game Id in smart contract(" + self.gameIdInSmartContract + "), House public address used(" + self.houseAddr + ") -> Transaction ID(" + ethTransId + ')';
	}

	/**
	 * Validate this object.
	 */
	this.validateMe = function()
	{
		let errPrefix = '(SetHousePublicAddress_bag::validateMe) ';
		
		if (misc_shared_lib.isEmptySafeString(self.gameId))
			throw new Error(errPrefix + ' The game ID is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.gameIdInSmartContract))
			throw new Error(errPrefix + ' The field that holds the game ID in the smart contract is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.appEventId))
			throw new Error(errPrefix + ' The app event ID is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.houseAddr))
			throw new Error(errPrefix + ' The House address is empty is empty.');
	}
}

/**
 * This function takes an Ethereum transaction confirm and complete object and extracts the
 * 	data bag object from it.  It validates the object too.
 *
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum transaction
 * 	confirm object.
 *
 * @return {SetHousePublicAddress_bag}
 */
function getSetHousePublicAddress_bag(confirmAndCompleteObj) {
	let errPrefix = '(getSetHousePublicAddress_bag) ';
	
	return getEthTransDataBag(
			'set house public address',
			confirmAndCompleteObj,
			SetHousePublicAddress_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
				});
}

/**
 *  This is the Promise that should be executed if a call to the setHousePublicAddress() method belonging to
 * 	the EtherBattleBandsManager contract is completed.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function confirmSetHousePublicAddress_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'confirmSetHousePublicAddress_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getSetHousePublicAddress_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			 
			// Call the EtherBandBattles method that tells us if the house address has been set.
			contractInstance.methods.getIsHouseAddrSet(dataBag.gameIdInSmartContract).call()
			.then(function(result) {
				let bIsHousePublicAddressSet = result;

				// We must have a "success" property in our result object.  The reason for the duplicate
				//  is_house_public_address_set property is to make the logs more informative.
				resolve(
					{ operationDesc: methodName, is_house_public_address_set: bIsHousePublicAddressSet, success: bIsHousePublicAddressSet }
				);
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

/**
 * This is the con completion handler for the set House public address transaction.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onSetHousePublicAddressCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onSetHousePublicAddressCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getSetHousePublicAddress_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			let gameDetailsObj = null;
				
			// Get a fresh copy of the game object using the given game ID.
			redis_wrappers_lib.getGame_promise(dataBag.gameId)
			.then( redisResponse => {
				if (!(redisResponse instanceof GameDetails))
					throw new Error(errPrefix + "The result of the Redis get game details call was invalid.");
					
				gameDetailsObj = redisResponse;

				return true;
			})
			.then(ignoreResult =>
			{
				// TODO: Validate Redis response.
				// Get the gas used for this transaction and update the server side only details object
				//  for this game with that value.
				let gasUsedGwei = lifecycleObj.wrappedResultOfGetTransactionReceiptCall.getGasUsedGwei();
				
				let historyMessage = 'The gas charged to the server for setting the house address was: ' + gasUsedGwei.toString();
				
				// Add it to the Ethereum transaction history.
				lifecycleObj.addHistoryMessage(methodName, historyMessage);
				
				// This method updates the desired gas-used field in the server side only game details object and
				//	returns the updates server side only game details object.
				return updateSSOGameDetailsGasUsed_promise(
						gameDetailsObj.id,
						null, // We pass NULL because we only want to accumulate the gas paid by the server, nothing else.
						gasUsedGwei,
						lifecycleObj.confirmAndCompleteObj.isServerSideTransaction);
			})
			.then(result =>
			{
				if (!(result instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the result parameter is not a GameDetailsServerSideOnly object.');
					
				console.log(`House public address successfully set to: ${dataBag.houseAddr}.`);
					
				// Send a PubNub broadcast that tells everyone the house public address has been
				//  set for the current game.
				let appEventId = extractAppEventIdFromObj('ethtrans-set-house-public-address', lifecycleObj.confirmAndCompleteObj.bag);
				
				let broadcastPayload =
					gamemaster_lib.gamemaster.buildPayload_new_game_is_ready(gameDetailsObj, appEventId);
					
				// Broadcast message.
				return gamemaster_lib.gamemaster.broadcastMessage_promise(
					// We set req and res parameters to NULL since we DON'T want to return a
					//  response.  Setting the house public address is a server side
					//  created Ethereum transaction and therefore therefore we are not in
					//  the execution context of handling an Express request.  (i.e. - there
					//  is no request or response objects.)
					null,
					null,
					gameDetailsObj,
					broadcastPayload,
					'The game is ready to be played.');
			})
			.then( ignoreResult => {
				// We must have a "success" property in our result object.
				resolve(
					{ operationDesc: 'onSetHousePublicAddressCompletion_promise', success: true }
				);
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

/**
 * This method creates a promise that prepares the transaction that sets the House public
 * 	address for the desired game and then adds that transaction to our Ethereum transaction
 * 	framework.
 *
 * @param {string} gameId - The server side game ID for the desired game.
 * @param {string} appEventIdFromMakeGameTransaction - The app event ID the client provided
 * 	to the make game transaction.  We must pass this back to the client with the "new
 * 	game is ready" notification we publish via PubNub once this promise resolves
 * 	successfully.
 *
 * @return {Promise<any>}
 */
function setHousePublicAddress_promise(gameId, appEventIdFromMakeGameTransaction) {
	return new Promise(function(resolve, reject) {
		try
		{
			let errPrefix = '(setHousePublicAddress_promise) ';
	
			// ----
			
			if (misc_shared_lib.isEmptySafeString(gameId))
				throw new Error(errPrefix + 'The game ID is empty.');
				
			if (misc_shared_lib.isEmptySafeString(appEventIdFromMakeGameTransaction))
				throw new Error(errPrefix + 'The app event ID from the make game operation is empty.');
				
			let gameDetailsObj = null;
				
			// Get a fresh copy of the game object using the given game ID.
			redis_wrappers_lib.getGame_promise(gameId)
			.then( result => {
				if (!(result instanceof GameDetails))
					throw new Error(errPrefix + "The result of the Redis get game call was invalid.");
					
				gameDetailsObj = result;
				
				// Sanity check.
				if (gameId != gameDetailsObj.id)
					throw new Error(errPrefix
						+ "Game ID mismatch.  Input parameter("
						+ gameId
						+ "), "
						+ "ID found in game details object: "
						+ gameDetailsObj.id);
				
				let housePublicAddr = solidity_helpers_misc.getHousePublicAddress();
				
				if (misc_shared_lib.isEmptySafeString(housePublicAddr))
					throw new Error(errPrefix + "The house public address is empty.");
				
				/**
				 * Create an Ethereum lifecycle object that sets the house public address for
				 *  the given game and then waits for the transaction to complete.
				 */
				let confirmAndComplete = new EthTransConfirmAndComplete();
				
				// We do NOT create our own app event ID for this server side created transaction.  Instead
				//  we carry over the one given to the make game Ethereum transaction since the client
				//  will need to see it when we publish the "new game is ready" notification via PubNub.
				
				// Store the necessary elements in the data bag.
				let dataBag = new SetHousePublicAddress_bag();
				dataBag.gameId = gameDetailsObj.id;
				dataBag.gameIdInSmartContract = gameDetailsObj.idInSmartContract;
				dataBag.appEventId = appEventIdFromMakeGameTransaction;
				dataBag.houseAddr = housePublicAddr;
				dataBag.validateMe();
		
				confirmAndComplete.bag = dataBag;
		
				confirmAndComplete.initialize(
						// TRUE because the transaction was created by the server and NOT
						//  created on the client side.
						true,
						dataBag.funcLogging,
						// Create a curried function to make the actual smart contract
						//  method call that set's the house address, using the ID
						//	of the desired game (smart contract game ID) and the
						//  desired house address.
						(contractInstance) =>
						{
							return contractInstance.methods.setHouseAddress(gameDetailsObj.idInSmartContract, housePublicAddr);
						},
						null,
						confirmSetHousePublicAddress_promise,
						onSetHousePublicAddressCompletion_promise,
						// There is no prerequisite check function because this function is not
						//  called until the game has been confirmed as being successfully
						//	created.
						null,
						EnumEthereumTransactionType_ebb.set_house_public_address
					);
					
				// Add the transaction to the transaction manager.
				EthereumTransactionManager.addTransaction(confirmAndComplete);
				
				// Store the House public address in the server side only game details object.
				return updateServerSideOnlyDetailsField_promise(
					gameDetailsObj.id,
					'houseAddr',
					housePublicAddr);
			})
			.then(result =>
			{
				resolve(true);
			})
			.catch(err =>
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
	setHousePublicAddress_promise: setHousePublicAddress_promise
}