/**
 * This route executes the request to start a game.
 */

var express = require("express");
var http_status_codes = require('http-status-codes');
var router = express.Router();

const common_routines = require("../../common/common-routines");
const misc_shared_lib = require('../../public/javascripts/misc/misc-shared');

const redis_wrappers_lib = require('../../common/redis-wrappers');
const video_details_lib = require('../../public/javascripts/game-objects/video-details');
const gamemaster_lib = require('../../common/game-master');
const private_payment_details_lib = require('../../private-objects/private-payment-details');
const EnumEthereumTransactionType_ebb = require('../../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;

const getEthTransDataBag = require('../../ethereum/ethtrans-data-bags').getEthTransDataBag;

const EthereumGlobals = require('../../ethereum/ethereum-globals').EthereumGlobals;
const EthTransConfirmAndComplete = require('../../ethereum/confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthTransLifecycle = require('../../ethereum/ethereum-state-machine').EthTransLifecyle;
const EthereumTransactionManager = require('../../ethereum/ethereum-state-machine').EthereumTransactionManager;
const getGameState_promise = require('../../ethereum/ethereum-ebb-helpers').getGameState_promise;

const EnumValidateMeTypes = require('../../public/javascripts/misc/validation').EnumValidateMeTypes;
const FugoObjects_ebb_sso = require('../../private-objects/fugo').FugoObjects_ebb_sso;
const EnumGameState = require('../../common/solidity-helpers-misc').EnumGameState;
const enumGameStateToString = require('../../common/solidity-helpers-misc').enumGameStateToString;
const updateSSOGameDetailsGasUsed_promise = require('../../common/redis-wrappers').updateSSOGameDetailsGasUsed_promise;
const GameDetailsServerSideOnly = require('../../common/game-details-server-side-only').GameDetailsServerSideOnly;


const winstonLogger = require('../../common/winston-logging-module').winstonLogger;

/**
 * Simple object to hold the data fields necessary for the start game Ethereum transaction.
 *
 * @constructor
 */
function StartGame_bag() {
	var self = this;
	
	/** @property {string} - The ID of the relevant game.
	 */
	this.gameId = null;
	
	/** @property {string} - The ID the smart contract assigned to the game.
	 */
	this.idInSmartContract = null;
	
	/** @property {string} - The ID of the user starting the game.
	 */
	this.userId = null;
	
	/** @property {string} - The Ethereum public address tied to the user.
	 */
	this.ethereumPublicAddress = null;
	
	/** @property {string} - The app event ID passed in to the start game transaction.
	 * 		(Created on the client side) */
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
		let errPrefix = '(StartGame_bag::funcLogging) ';
		
		if (!lifecycleObj)
			throw new Error(errPrefix + 'The lifecycle object is unassigned.');
			
		return "Game Id(" + self.gameId + "), Smart contract game Id(" + self.idInSmartContract + "), Game Creator User Id(" + self.userId + "), user Ethereum public address(" + self.ethereumPublicAddress + ") -> App Event ID(" + self.appEventId + ')';
	}
	
	/**
	 * Validate this object.
	 */
	this.validateMe = function()
	{
		let errPrefix = '(StartGame_bag::validateMe) ';
		
		if (misc_shared_lib.isEmptySafeString(self.gameId))
			throw new Error(errPrefix + ' The game ID is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.idInSmartContract))
			throw new Error(errPrefix + ' The ID assigned by the smart contract for the game is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.userId))
			throw new Error(errPrefix + ' The user ID is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.ethereumPublicAddress))
			throw new Error(errPrefix + ' The Ethereum public address for the user is empty.');
			
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
 * @return {StartGame_bag}
 */
function getStartGame_bag(confirmAndCompleteObj) {
	let errPrefix = '(getStartGame_bag) ';
	
		return getEthTransDataBag(
			'start game',
			confirmAndCompleteObj,
			StartGame_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
				});
}

//--------------------------- PROMISE: Confirm new player addition --------------------

/**
 * This function returns a promise that calls the smart contract method that
 * 	tells us what state a particular game currently is in to make sure the
 * 	game is in the PLAYING state (i.e. - it has been "started").
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function confirmStartGame_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'confirmStartGame_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getStartGame_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			// We get the number of games created so far in the contract as a pre-test.
			contractInstance.methods.getNumGamesCreated().call()
			.then(function(result) {
				let numGamesCreated = result;
				
				console.log(errPrefix + "The current number of games created reported by the smart contract is: " + numGamesCreated);
				
				// Execute the getGameState() contract method using the ID of the game as the smart contract
				//  assigned to it.
				// return contractInstance.methods.getGameState(dataBag.idInSmartContract).call();
				return getGameState_promise(dataBag.idInSmartContract);
			})
			.then(function(result) {
				if (typeof result != 'number')
					throw new Error(errPrefix + 'The result of the getGameState() call is not a number.');
			
				// The result indicates whether or not the game is in play, indicating it has been started.
				let gameState = result;
				let bGameIsInStartedState = (gameState == EnumGameState.PLAYING);
	
				resolve(
					// We must have a "success" property in our result object.
					//  NOTE: The reason for the "game_is_in_started_state" property is to
					//  	make the logs more informative.
					{
						operationDesc: 'confirmStartGame_promise',
						game_state: gameState,
						game_is_in_started_state: bGameIsInStartedState,
						success: bGameIsInStartedState
					}
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
 * This is the Promise that should be executed if a call to the StartGame() method belonging to
 * 	the EtherBattleBandsManager contract is successfully confirmed.
 *
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onStartGameCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onStartGameCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getStartGame_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			let console = process.console;
			
			// ============================ END  : Preamble ======================
			
			// Get the gas used for this transaction and update the server side only details object
			//  for this game with that value.
			let gasUsedGwei = lifecycleObj.wrappedResultOfGetTransactionReceiptCall.getGasUsedGwei();
			
			let historyMessage = 'The gas charged to the server starting the game was: ' + gasUsedGwei.toString();
			
			// Add it to the Ethereum transaction history.
			lifecycleObj.addHistoryMessage(methodName, historyMessage);
			
			// This method updates the desired gas-used field in the server side only game details object and
			//	returns the updates server side only game details object.
			updateSSOGameDetailsGasUsed_promise(
					dataBag.gameId,
					null, /// We pass NULL because we only want to accumulate the gas paid by the server, nothing else.
					gasUsedGwei,
					lifecycleObj.confirmAndCompleteObj.isServerSideTransaction)
			.then(result =>
			{
				if (!(result instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the result parameter is not a GameDetailsServerSideOnly object.');
				
				// Just write a log message reporting the fact the smart contract shows
				//  the game in the PLAYING state now.
				let logMsg =
					"The game with ID('"
					+ dataBag.gameId
					+ "') and smart contract ID('"
					+ dataBag.idInSmartContract
					+ "') is officially in the PLAYING state now on the Ethereum network.";
	
				winstonLogger.log('info',  logMsg);
				
				// Return a success object.
				resolve(
					{ operationDesc: lifecycleObj.confirmAndCompleteObj.operationDesc, success: true }
				);
			})
			.catch(function(err)
			{
			   // Reject the promise with the error.
			   reject(err);
			});
		}
		catch(err)
		{
		   // Reject the promise with the error.
		   reject(err);
		}
	});
}

// ======================================= POST REQUEST HANDLER ==========================

router.post('/start-game-api',function(req,res, next){
   	const errPrefix = '(start-game-api) ';
    
    try
    {
		const console = process.console;
		
		// ---------------------- game ID -------------
		
		// We expect to find a game ID.
    	if (typeof req.body.gameId == 'undefined')
    		throw new Error('Missing game ID.');
    		
    	let incomingGameId = req.body.gameId;
    	
    	if (misc_shared_lib.isEmptySafeString(incomingGameId))
    		throw new Error('The game ID is empty.');
    		
		// ---------------------- user ID -------------
		
		// We expect to find a user ID.
    	if (typeof req.body.userId == 'undefined')
    		throw new Error('Missing user ID.');
    		
    	let incomingUserId = req.body.userId;
    	
    	if (misc_shared_lib.isEmptySafeString(incomingUserId))
    		throw new Error('The user ID is empty.');
    		
		// ---------------------- app event ID -------------
		
		// We should have gotten an app event ID for tracking purposes.
		if (!req.body.app_event_id)
    		throw new Error('Missing app event ID.');
    		
    	let appEventId = req.body.app_event_id;

		// ----
		
    	// Find the game details object using the game ID provided.
    	// let gameDetailsObj = null;
    	
    	let firstUserWithQueuedVideoObj = null;
    	let aryAllUsers = null;
    	let gameDetailsServerSideOnlyObj = null;
    	let bResponseRequired = true;
		let contractInstance = EthereumGlobals.ebbContractInstance;
		let confirmAndComplete = null;
    	
		// ------------------------------ FUGO - Build the object that gets commonly used server side objects -------------------
    	
    	// Get fresh copies of the game details object and user details objects with advanced validation, and the user's
    	//  Ethereum public address.
    	let fugoObj = new FugoObjects_ebb_sso(
    		incomingGameId,
    		EnumValidateMeTypes.ADVANCED_VALIDATION,
    		incomingUserId,
    		EnumValidateMeTypes.ADVANCED_VALIDATION,
    		true);
    		
    	// Now execute the FUGO promise to actually get the desired objects.
    	fugoObj.getObjects_promise()
    	.then(result => {
    		// getObjects_promise should resolve to TRUE if all went well.  Otherwise the promise should reject.
    		//  The result check below is just for some extra insurance.
    		if (result !== true)
    			throw new Error(errPrefix + 'The result of the method that gets the frequently used game objects from Redis did not return TRUE.');
			
			// Now get a list of all the users so we can check their entry fee payment status.
			return redis_wrappers_lib.getAllUsers_promise(fugoObj.gameDetailsObj.id);
		})
		.then(function(redisResponse)
		{
			redis_wrappers_lib.validateRedisResponseAsArray(
				redisResponse, errPrefix + 'The response to our request for all the users in the game returned an invalid response.', true);
			
			// Save a reference to the array.
			aryAllUsers = redisResponse;
			
			// The smart contract MUST have the game set to the STARTED game state. Therefore, we make
			// 	a call to the getGameState() contract method to get the current game state.
			return getGameState_promise(fugoObj.gameDetailsObj.idInSmartContract);
		})
		.then(function(result) {
			// The getGameState_promise() method will validate the result from the smart
			//  contract call.  We just do a simple check to make sure we got something back.
			if (!result)
				throw new Error(errPrefix + 'The result of the getGameState_promise() call is unassigned.');
		
			// The result indicates whether or not the game is in the CREATED state, indicated it
			// 	was created successfully, but has not progressed to a successive game state.
			let gameState = result;
			
			if (gameState != EnumGameState.CREATED) {
				// Add a log message to the logs being used for Ethereum transactions specifically
				//	about this.
				let errMsg =
					errPrefix +
					'Unable to start game ID('
					+ fugoObj.gameDetailsObj.id
					+ ') because it is not in the CREATED state. '
					+ 'Currently it is in game state: '
					+ enumGameStateToString(gameState);
					
				winstonLogger.log('error', errMsg);
			}
			
			// Now get all the payment details records.
			return redis_wrappers_lib.getAllPrivatePayments_promise(fugoObj.gameDetailsObj.id);
		})
		.then(function(redisResponse)
		{
			// Check the environment to see if we are checking for entry fee payments.
			if (private_payment_details_lib.isIgnoringEntryFeePayments())
				console.log('WARNING: Entry fees are currently being ignored due to the current environment variable settings.');
			else
			{
				redis_wrappers_lib.validateRedisResponseAsArray(redisResponse, 'The response to our request for all the payment detail records in the game returned an invalid response.', true);
			
				// Make sure every user has paid their entry fee.
				let aryPaymentForEntryFee = redisResponse;
				
				let aryUsersNotPaidYet = new Array();
				
				for (var ndx = 0; ndx < aryAllUsers.length; ndx++)
				{
					/*
					TODO: Currently NOT using the payment details Redis set.  Instead, simply relying on the
					isEntryFeePaidAndConfirmed field in the user details object as proof of payment.
					
					let theUserDetailsObj = aryAllUsers[ndx];

					// Check if there is a payment record for this user and if it shows they have paid.
					let paymentRec = lodash_lib.find(aryPaymentForEntryFee, { userId: theUserDetailsObj.uuid});
					if (!paymentRec || paymentRec.isEntryNotPaid() )
						aryUsersNotPaidYet.push(theUserDetailsObj);
					*/

					// If the user has not paid their entry fee yet, or it has not been confirmed yet, add
					//  them to the unpaid users array.
					if (aryAllUsers[ndx].isEntryFeePaidAndConfirmed !== true)
						aryUsersNotPaidYet.push(aryAllUsers[ndx]);
				}
				
				if (aryUsersNotPaidYet.length > 0)
				{
					// Return the modified game details object along with a success result object.
					let objAuxArgs = {
						array_of_unpaid_users: aryUsersNotPaidYet,
					}
					
					let errMsg = 'The game can not be started yet because some users have not paid their entry fee.';
					
					common_routines.returnStandardErrorObj(
						req,
						res,
						errMsg,
						// We show the error to the user so they know that some users have not paid yet.
						true,
						// We return an HTTP OK so the client knows it is not a catastrophic error.
						http_status_codes.OK,
						objAuxArgs);
						
					// Let the code that follows us know we have already sent a response to the client.
					bResponseRequired = false;
					
					throw new Error(errMsg);
				}
			}
			
			// Everybody has paid.  Record the number of users in the game with the server side only
			//  game details object.
			return redis_wrappers_lib.getGameDetailsServerSideOnly_promise(fugoObj.gameDetailsObj.id);
		})
		.then(function(redisResponse) {
			if (!redisResponse)
				throw new Error(errPrefix + 'Unable to find a server side only game details object using game iD: ' + fugoObj.gameDetailsObj.id);
			
			gameDetailsServerSideOnlyObj = redisResponse;
			
			// Lock in the number of rounds in the game using the count of users, now that we are starting the game.
			gameDetailsServerSideOnlyObj.totalNumberOfRounds = aryAllUsers.length;
			
			console.log(
				errPrefix
				+ "Number of rounds in game with ID('"
				+ gameDetailsServerSideOnlyObj.gameId
			 	+ "that is now starting is: "
			 	+ gameDetailsServerSideOnlyObj.totalNumberOfRounds);
			
			// Update the modified server side only game details object with Redis.
			return redis_wrappers_lib.addGameDetailsServerSideOnly_promise(gameDetailsServerSideOnlyObj.gameId, gameDetailsServerSideOnlyObj);
		}).then(function(redisResponse) {
			// TODO: Check redisResponse
			
			// Now get a list of all the videos submitted to the game.
			return gamemaster_lib.gamemaster.getAllUsersWithQueuedVideos_promise(fugoObj.gameDetailsObj.id);
		})
		.then(function(redisResponse){
			// TODO: Check redisResponse
			
			console.log(errPrefix + 'Redis response to our getAllUsersWithQueuedVideos_promise() call: ' + redisResponse.toString());
			console.log(errPrefix + 'Using game ID: ' + fugoObj.gameDetailsObj.id);
			
			redis_wrappers_lib.validateRedisResponseAsArray(redisResponse, 'The response from the get all queued videos in the game returned an invalid response.', true);
			
			// Save a reference to the user details object selected for video playback, the
			//  first one found.
			firstUserWithQueuedVideoObj = redisResponse[0];
			
			// Mark the user's video as no longer queued.
			//	TODO: Later, make this more robust by waiting for a 'playing' report from all the
			//		client video players.
			firstUserWithQueuedVideoObj.videoStatus = video_details_lib.VideoDetailsConstants.VIDEO_STATE_PLAYING;
			
			// Update the user details record with the modifications we made to it.
			return redis_wrappers_lib.addUser_promise(fugoObj.gameDetailsObj.id, firstUserWithQueuedVideoObj.uuid, firstUserWithQueuedVideoObj);
		})
		.then(function(redisResponse)
		{
			// TODO: Check redisResponse

			// Update the game details object field that tracks the video currently playing.
			//  current round.
			fugoObj.gameDetailsObj.videoIdCurrentlyPlaying =
				firstUserWithQueuedVideoObj.videoIdSubmitted;
			// Same for the field that tracks the title of the video currently playing.
			fugoObj.gameDetailsObj.videoTitleSubmitted = firstUserWithQueuedVideoObj.videoTitleSubmitted;
			// Set the game state to PLAYING.
			fugoObj.gameDetailsObj.state = EnumGameState.PLAYING;
			
			// Update Redis with the modified game details object.
			return redis_wrappers_lib.addGame_promise(fugoObj.gameDetailsObj.id, fugoObj.gameDetailsObj);
		})
		.then(function(redisResponse)
		{
			// Did the add game request succeed?
			if (redisResponse !=  1)
			{
				// TODO: Really need to figure out a better system-wide handling mechanism
				//  for the Redis response calls.  For some reason, the user ID appears to
				//  be the same between games, leading to add requests ending up being
				//  replace requests and thus a Redis response that is not 1.
				
				// No.  Return an error.
				// throw new Error(errPrefix + 'User add request failed');
			
				console.log(errPrefix + "Response from addUser_promise was not 1");
			}
			
			/**
			 * Create an Ethereum lifecycle object to wait for the Ethereum transaction
			 * 	that was generated on the client side with Metamask.
			 *
			 */
			confirmAndComplete = new EthTransConfirmAndComplete();
			
			let dataBag = new StartGame_bag();
			
			dataBag.gameId = fugoObj.gameDetailsObj.id;
			dataBag.idInSmartContract = fugoObj.gameDetailsObj.idInSmartContract;
			dataBag.userId = fugoObj.userDetailsObj.id;
			dataBag.ethereumPublicAddress = fugoObj.ethPubAddrDetailsObj.ethereumPublicAddress;
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
						return contractInstance.methods.startGame(fugoObj.gameDetailsObj.idInSmartContract);
					},
					null,
					confirmStartGame_promise,
					onStartGameCompletion_promise,
					null,
					EnumEthereumTransactionType_ebb.start_game
				);
			
			// Add the transaction to the transaction manager.
			EthereumTransactionManager.addTransaction(confirmAndComplete);
			
			// Just return a success message to the caller  The actual game creation tasks have
			//  been deferred to the transaction monitor.
			var objAuxArgs = {
				game_details_obj: fugoObj.gameDetailsObj,
			}
			
			common_routines.returnStandardSuccessJsonObj(
				req,
				res,
				'Request to wait for the confirmation of a game being started, successfully initiated.',
				objAuxArgs);
				
			// Let the code that follows know that we have sent a response to the client.
			bResponseRequired = false;
				
			// Broadcast the request to start the first round of play immediately without waiting for
			//  the start-game Ethereum transaction to be mined/confirmed.
			let broadcastPayload =
				gamemaster_lib.gamemaster.buildPayload_play_next_round(fugoObj.gameDetailsObj, dataBag.appEventId, firstUserWithQueuedVideoObj);
			
			return gamemaster_lib.gamemaster.broadcastMessage_promise(
				null,
				null, // We don't want the broadcast method to try to send any responses.
				fugoObj.gameDetailsObj,
				broadcastPayload,
				'Start the first round by playing a new video.');
		})
		.then(function(result)
		{
			 return(true);
		})
		.catch(function(err)
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during start game object request (promise). Details -> ' + err.message);
			
			if (bResponseRequired)
				res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during start game request.');
			return;
		});
    }
    catch (err)
    {
        console.log('[ERROR: ' + errPrefix + '] Details -> ' + err.message);
       	res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the start game object request (try/catch).');
        return;
    } // try/catch

});

module.exports = router;
