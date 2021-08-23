/**
 * This file contains the code to execute the server side generated Ethereum transaction that tests the
 * 	EtherBandBattles smart contract function that returns a tuple for test purposes.
 *
 * ABANDONED:  Leaving code here in case we need a SEND transaction tester later.
 */

const EnumEthereumTransactionType_ebb = require('../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
const common_routines = require("../common/common-routines");
// const defaultLoggingDetailsFunc = require('../ethereum/ethereum-state-machine').defaultLoggingDetailsFunc;
const EthereumGlobals = require('../ethereum/ethereum-globals').EthereumGlobals;
const EthTransConfirmAndComplete = require('../ethereum/confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthTransLifecycle = require('../../ethereum/ethereum-state-machine').EthTransLifecyle;
const EthereumTransactionManager = require('../ethereum/ethereum-state-machine').EthereumTransactionManager;
const game_details_lib = require('../public/javascripts/game-objects/game-details');
const GameDetails = require('../public/javascripts/game-objects/game-details').GameDetails;
const UserDetails = require('../public/javascripts/game-objects/user-details').UserDetails;
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
const EnumValidateMeTypes = require('../public/javascripts/misc/validation').EnumValidateMeTypes;
const GameDetailsServerSideOnly = require('../common/game-details-server-side-only').GameDetailsServerSideOnly;
const getGameState_promise = require('../ethereum/ethereum-ebb-helpers').getGameState_promise;
const EnumGameState = require('../common/solidity-helpers-misc').EnumGameState;

/**
 * This object is the data bag for the finalize game Ethereum transaction.
 *
 * @constructor
 */
function TestReturnTuple_bag() {
	var self = this;
	
	/** @property {string|null} - A valid game ID for the game whose House public address was set. */
	this.gameId = null;
	
	/** @property {number|null} - The EtherBandBattlesManager's ID for the corresponding game. */
	this.idInSmartContract = null;
	
	/** @property {string} - The app event tracking ID for the make game transaction.
	 * 		(Created on the server side) */
	this.appEventId = null;
	
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
		let errPrefix = '(TestReturnTuple_bag::funcLogging) ';
		
		if (!lifecycleObj)
			throw new Error(errPrefix + 'The lifecycle object is unassigned.');
			
		let gameId = self.gameId;
		let idInSmartContract = self.idInSmartContract;
		let ethTransId = self.appEventId;

		return "Game Id(" + gameId + "), Game Id in smart contract(" + idInSmartContract + "), -> Transaction ID(" + ethTransId + ')';
	}

	/**
	 * Validate this object.
	 */
	this.validateMe = function()
	{
		let methodName = 'TestReturnTuple_bag::validateMe';
		let errPrefix = '(' + methodName + ') ';
		
		if (misc_shared_lib.isEmptySafeString(self.gameId))
			throw new Error(errPrefix + ' The game ID is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.idInSmartContract))
			throw new Error(errPrefix + ' The field that holds the game ID in the smart contract is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.appEventId))
			throw new Error(errPrefix + ' The app event ID is empty.');
	}
}

/**
 * This function takes an Ethereum transaction confirm and complete object and extracts the
 * 	data bag object from it.  It validates the object too.
 *
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum transaction
 * 	confirm object.
 *
 * @return {TestReturnTuple_bag}
 */
function getTestReturnTuple_bag(confirmAndCompleteObj) {
	let errPrefix = '(getTestReturnTuple_bag) ';
	
	return getEthTransDataBag(
			'finalize game',
			confirmAndCompleteObj,
			TestReturnTuple_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
				});
}
			
/**
 * The confirm check always resolves immediately TRUE because the TestReturnTupleTuple() function doesn't have a
 * 	significant effect on the smart contract.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function confirmTestReturnTuple_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'confirmTestReturnTuple_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getTestReturnTuple_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();

			resolve(true);
		}
		catch(err)
		{
			// Reject the promise with the error object.
			reject(err);
		}
	});
}

/**
 * This is the on-completion handler for the finalize game transaction.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onTestReturnTupleCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onTestReturnTupleCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getTestReturnTuple_bag(lifecycleObj.confirmAndCompleteObj);
			dataBag.validateMe();
			
			// ------------- IS THE GAME OVER? -----------
			let gameDetailsObj = null;
			let gameDetailsServerSideOnlyObj = null;
			
			// Get a fresh copy of the game object using the given game ID.
			redis_wrappers_lib.getGame_promise(dataBag.gameId)
			.then( result => {
				if (!(result instanceof GameDetails))
					throw new Error(errPrefix + "The result of the Redis get game call was invalid for game ID: " + dataBag.gameId);
					
				gameDetailsObj = result;
				
				return redis_wrappers_lib.getGameDetailsServerSideOnly_promise(gameDetailsObj.id)
			})
			.then(redisResponse => {
			
				// TODO: Just return TRUE for now.  Later, this is where we should kick off the process
				//  that actually makes the payments.
				return true;
				
				/*
				// Send a PubNub broadcast that tells everyone the game is now fully ready for
				//  playing.  The client expects the payload object to be an AppEventResult
				//  object.
				let appEventId = extractAppEventIdFromObj('ethtrans-add-game-round-result', confirmAndCompleteObj.bag);
				
				let broadcastPayload =
					gamemaster_lib.gamemaster.buildPayload_new_game_is_ready(gameDetailsObj, appEventId);
					
				// Broadcast the game is ready message.
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
				*/
			})
			.then(ignoreResult => {
				// We must have a "success" property in our result object.
				resolve(
					{ operationDesc: methodName, success: true }
				);
			})
			.catch(err => {
				// Reject the promise with the error object.
				reject(err);
			});
		}
		catch(err) {
			// Reject the promise with the error object.
			reject(err);
		}
	});
}

/**
 * This method creates a promise that prepares the transaction that adds a game round result
 * 	to the EtherBandBattles smart contract.
 * @param {GameDetails} gameDetailsObj - A valid game details object.  (Note, we don't
 * 	take the ID and do a fresh Redis retrieval in case we are called from code that
 * 	has made changes to the game details object, but doesn't want to save those changes
 * 	yet until they know this method and others succeeded).
 * SMART CONTRACT CALL: function testReturnTuple(uint256 _gameId)
 *
 * @return {Promise<any>}
 */
function testReturnTuple_promise(gameDetailsObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'testReturnTuple_promise';
			let errPrefix = '(' + methodName + ') ';
	
			// ---- VALIDATE PARAMETERS
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object parameter is unassigned.');
			
			gameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
			
			/**
			 * Create an Ethereum lifecycle object that sets the house public address for
			 *  the given game and then waits for the transaction to complete.
			 */
			let confirmAndComplete = new EthTransConfirmAndComplete();
			
			// An app event ID is not needed because the client side code does not take any follow-up actions.
			let appEventId = '(none)';
			
			// Store the necessary elements in the data bag.
			let dataBag = new TestReturnTuple_bag();
			dataBag.gameId = gameDetailsObj.id;
			dataBag.idInSmartContract = gameDetailsObj.idInSmartContract;
			dataBag.appEventId = appEventId;
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
						return contractInstance.methods.testReturnTuple(dataBag.idInSmartContract);
					},
					null,
					confirmTestReturnTuple_promise,
					onTestReturnTupleCompletion_promise,
					null,
					EnumEthereumTransactionType_ebb.finalize_game
				);
				
			// Add the transaction to the transaction manager.
			EthereumTransactionManager.addTransaction(confirmAndComplete);
			
			resolve(true);
			
			/*
			})
			.catch(err =>
			{
				// Reject the promise with the error object.
				reject(err);
			});
			*/
		}
		catch(err)
		{
			// Reject the promise with the error object.
			reject(err);
		}
	});
}

module.exports = {
	testReturnTuple_promise: testReturnTuple_promise
}