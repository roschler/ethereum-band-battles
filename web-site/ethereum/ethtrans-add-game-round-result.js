/**
 * This file contains the code to execute the server side generated Ethereum transaction that adds
 *  a game round result to a game in the EtherBandBattles smart contract.
 */

const EnumEthereumTransactionType_ebb = require('../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
const common_routines = require("../common/common-routines");
// const defaultLoggingDetailsFunc = require('../ethereum/ethereum-state-machine').defaultLoggingDetailsFunc;
const EthereumGlobals = require('../ethereum/ethereum-globals').EthereumGlobals;
const EthTransConfirmAndComplete = require('../ethereum/confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthTransLifecycle = require('../ethereum/ethereum-state-machine').EthTransLifecyle;
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
const finalizeGame_promise = require('../ethereum/ethtrans-finalize-game').finalizeGame_promise;
const updateSSOGameDetailsGasUsed_promise = require('../common/redis-wrappers').updateSSOGameDetailsGasUsed_promise;

/**
 * This object is the data bag for the add game round result Ethereum transaction.
 *
 * @constructor
 */
function AddGameRoundResult_bag() {
	var self = this;
	
	/** @property {string|null} - A valid game ID for the game whose House public address was set. */
	this.gameId = null;
	
	/** @property {number|null} - The EtherBandBattlesManager's ID for the corresponding game. */
	this.idInSmartContract = null;
	
	/** @property {string} - The app event tracking ID for the make game transaction.
	 * 		(Created on the server side) */
	this.appEventId = null;
	
	/** @property {number|null} - The round number the game round result is for. */
	this.roundNumber = null;
	
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
		let errPrefix = '(AddGameRoundResult_bag::funcLogging) ';
		
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
		let methodName = 'AddGameRoundResult_bag::validateMe';
		let errPrefix = '(' + methodName + ') ';
		
		if (misc_shared_lib.isEmptySafeString(self.gameId))
			throw new Error(errPrefix + ' The game ID is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.idInSmartContract))
			throw new Error(errPrefix + ' The field that holds the game ID in the smart contract is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.appEventId))
			throw new Error(errPrefix + ' The app event ID is empty.');
			
		common_routines.validateAsIntegerGreaterThanZero(methodName, self.roundNumber)
	}
}

/**
 * This function takes an Ethereum transaction confirm and complete object and extracts the
 * 	data bag object from it.  It validates the object too.
 *
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum transaction
 * 	confirm object.
 *
 * @return {AddGameRoundResult_bag}
 */
function getAddGameRoundResult_bag(confirmAndCompleteObj) {
	let errPrefix = '(getAddGameRoundResult_bag) ';
	
	return getEthTransDataBag(
			'add game round result',
			confirmAndCompleteObj,
			AddGameRoundResult_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
				});
}

/**
 *  This is the Promise that should be executed before a call to the addGameRoundResult() method belonging to
 * 	the EtherBattleBandsManager contract is made.  It makes sure the smart contract sees the game as in
 * 	the PLAYING state before making the addGameRoundResult() call, otherwise that smart contract method
 * 	will fail because addGameRoundResult() calls can only be made on a game that is still in progress.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>} - Returns a promise that resolves to TRUE if the conditions
 * 	necessary to perform the addition of a game round result are in place now, FALSE if not.
 */
function prerequisiteCheckAddGameRoundResult_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'prerequisiteCheckAddGameRoundResult_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getAddGameRoundResult_bag(lifecycleObj.confirmAndCompleteObj);

			dataBag.validateMe();
			 
			// Get the current game state from the smart contact.  The getGameState_promise() validates the
			//  return for us.
			getGameState_promise(dataBag.idInSmartContract)
			.then(function(result) {
				let gameState = result;
				
				// If the game has advanced out of the PLAYING state than this is a serious error.
				if (gameState > EnumGameState.PLAYING)
					throw new Error(errPrefix + 'The game has advanced past the playing state before we could add one of the game round results.');
				
				// Are we in the PLAYING state yet?
				let bIsGameInPlayingState = (gameState == EnumGameState.PLAYING);

				// Resolve the promise with the value of bIsGamePlayingState as the result of this prerequisites check.
				resolve(bIsGameInPlayingState);
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
 *  This is the Promise that should be executed if a call to the addGameRoundResult() method belonging to
 * 	the EtherBattleBandsManager contract is completed.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function confirmAddGameRoundResult_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'confirmAddGameRoundResult_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getAddGameRoundResult_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			 
			// Call the EtherBandBattles smart contract method named getIsGameRoundResultPosted() using the
			//  current round number.
			contractInstance.methods.getIsGameRoundResultPosted(
				dataBag.idInSmartContract,
				dataBag.roundNumber).call()
			.then(function(result) {
				if (typeof result != 'boolean')
					throw new Error(errPrefix + 'The result of the getIsGameRoundResultPosted() call is not TRUE or is not boolean.');
					
				let bIsGameRoundResultPosted = result;

				// We must have a "success" property in our result object.  The reason for the duplicate
				//  is_game_round_result_posted property is to make the logs more informative.
				resolve(
					{ operationDesc: methodName, is_game_round_result_posted: bIsGameRoundResultPosted, success: bIsGameRoundResultPosted }
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
 * This is the con completion handler for the add game round result transaction.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onAddGameRoundResultCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onAddGameRoundResultCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getAddGameRoundResult_bag(lifecycleObj.confirmAndCompleteObj);
			
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
				// The game is over when the number of confirmed game round results is equal to
				//  total number of rounds in the game.  Get the server side only game details object.
				if (!redisResponse)
					throw new Error(errPrefix + 'Unable to find a server side only game details object using game iD: ' + gameDetailsObj.id);
				
				if (!(redisResponse instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the redisResponse parameter is not a GameDetailsServerSideOnly object.');
					
				gameDetailsServerSideOnlyObj = redisResponse;
				
				// Is the game over?
				if (gameDetailsServerSideOnlyObj.isGameOver()) {
					// Yes.  Initiate the make-payments process.
					return finalizeGame_promise(gameDetailsObj);
				}
				else
					// No. Just return TRUE.
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
			.then(ignoreResult =>
			{
				// Get the gas used for this transaction and update the server side only details object
				//  for this game with that value.
				let gasUsedGwei = lifecycleObj.wrappedResultOfGetTransactionReceiptCall.getGasUsedGwei();
				
				let historyMessage = 'The gas charged to the server for adding a game round result was: ' + gasUsedGwei.toString();
				
				// Add it to the Ethereum transaction history.
				lifecycleObj.addHistoryMessage(methodName, historyMessage);
				
				// This method updates the desired gas-used field in the server side only game details object and
				//	returns the updated server side only game details object.
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
 * @param {number} roundNumber - The round of play this game round result is for.
 * @param {string} formattedVideoId - The video ID of the video played in the current round,
 * 	formatted properly for a smart contract call.
 * @param {string} formattedChannelId - The channel ID of the video channel that the current
 * 	video belongs to, formatted properly for a smart contract call.
 * @param {string} ethPubAddrOfWinningUser - The Ethereum public address of the user that
 * 	won the round.
 * @param {string} bandPublicAddr - The Ethereum public address of the band that
 * 	owns the video (i.e. - The address associated with the video channel that owns the
 * 	current video).  
 *
 * SMART CONTRACT CALL: function addGameRoundResult(
 * 		uint256 _roundNum, uint256 _gameId, bytes32 _videoId, bytes32 _ownerId, address _winnerAddr, address _bandAddr)
 *
 * @return {Promise<any>}
 */
function addGameRoundResult_promise(
							gameDetailsObj,
							roundNumber,
							formattedVideoId,
							formattedChannelId,
							ethPubAddrOfWinningUser,
							bandPublicAddr) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'addGameRoundResult_promise';
			let errPrefix = '(' + methodName + ') ';
	
			// ---- VALIDATE PARAMETERS
			
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object parameter is unassigned.');
			if (!(gameDetailsObj instanceof GameDetails))
				throw new Error(errPrefix + 'The value in the gameDetailsObj parameter is not a GameDetails object.');
			
			gameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
			
			common_routines.validateAsIntegerGreaterThanZero(methodName, roundNumber);
			if (misc_shared_lib.isEmptySafeString(formattedVideoId))
				throw new Error(errPrefix + 'The formattedVideoId parameter is empty.');
			if (misc_shared_lib.isEmptySafeString(formattedChannelId))
				throw new Error(errPrefix + 'The formattedChannelId parameter is empty.');
			if (misc_shared_lib.isEmptySafeString(ethPubAddrOfWinningUser))
				throw new Error(errPrefix + 'The ethPubAddrOfWinningUser parameter is empty.');
			if (misc_shared_lib.isEmptySafeString(bandPublicAddr))
				throw new Error(errPrefix + 'The bandPublicAddr parameter is empty.');
				
			let housePublicAddr = solidity_helpers_misc.getHousePublicAddress();
			
			if (misc_shared_lib.isEmptySafeString(housePublicAddr))
				throw new Error(errPrefix + "The house public address is empty.");
			
			/**
			 * Create an Ethereum lifecycle object that sets the house public address for
			 *  the given game and then waits for the transaction to complete.
			 */
			let confirmAndComplete = new EthTransConfirmAndComplete();
			
			// An app event ID is not needed because the client side code does not take any follow-up actions.
			let appEventId = '(none)';
			
			// Store the necessary elements in the data bag.
			let dataBag = new AddGameRoundResult_bag();
			dataBag.gameId = gameDetailsObj.id;
			dataBag.idInSmartContract = gameDetailsObj.idInSmartContract;
			dataBag.appEventId = appEventId;
			// The confirmation check handler needs the round number.  See confirmAddGameRoundResult_promise().
			dataBag.roundNumber = roundNumber;
			dataBag.validateMe();
	
			confirmAndComplete.bag = dataBag;
			
			// UPDATE: You can not pass an address anymore that does not pass the address
			//  validation process, like address 0.  We used to use address 0 to represent bands
			//  that had not obtained an Ethereum address yet.  We now use the house address
			//  for the game for that purpose.  EDIT: Some people on Gitter/Solidity say that
			//  "0x00" should work.  Leaveing current method in place for now.
			let useBandPublicAddr = bandPublicAddr;
			
			if (bandPublicAddr == '0')
				useBandPublicAddr = housePublicAddr;
    
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
						return contractInstance.methods.addGameRoundResult(
							gameDetailsObj.idInSmartContract,
							roundNumber,
							formattedVideoId,
							formattedChannelId,
							ethPubAddrOfWinningUser,
							useBandPublicAddr);
					},
					prerequisiteCheckAddGameRoundResult_promise,
					confirmAddGameRoundResult_promise,
					onAddGameRoundResultCompletion_promise,
					null,
					EnumEthereumTransactionType_ebb.add_game_round_result
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
	addGameRoundResult_promise: addGameRoundResult_promise
}