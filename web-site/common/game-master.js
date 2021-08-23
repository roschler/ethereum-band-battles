/**
 * This module contains the code that facilitates the game play logic performed by the server.
 */
var express = require("express");
const http_status_codes = require('http-status-codes');
const pubnub_lib = require('pubnub');

const common_routines = require('../common/common-routines');
const game_details_lib = require('../public/javascripts/game-objects/game-details');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');

const pubnub_support = require('../common/pubnub-support-server-side');
const redis_wrappers_lib = require('../common/redis-wrappers');
const video_details_lib = require('../public/javascripts/game-objects/video-details');
const extractAppEventIdFromObj = require('../public/javascripts/game-objects/app-events').extractAppEventIdFromObj;
const EnumValidateMeTypes = require('../public/javascripts/misc/validation').EnumValidateMeTypes;
const AppEventResult = require('../public/javascripts/game-objects/app-events').AppEventResult;


// Singleton pattern.
const gamemaster = new function()
{
	var self = this;
	
	/**
	 * This function returns a promise that returns an array of all the users
	 * 	whose videos have not been played yet (i.e. - are still queued for playback)
	 * 	for all the users that are playing the game with the given ID.
	 *
	 * @param {String} gameId - The desired game ID.
	 *
	 * @return {Array} - Returns an array of user detail objects whose video
	 * 	status field is set to queued..  If none are found, the array will be empty.
	 */
	this.getAllUsersWithQueuedVideos_promise = function(gameId)
	{
		let errPrefix = "(getAllVideosInGame_promise) ";
	
		// Parameter checks.
		if (misc_shared_lib.isEmptySafeString(gameId))
			throw new Error(errPrefix + "The game ID is empty.");
			
		let aryUsersFound = new Array();
		
		return redis_wrappers_lib.getAllUsers_promise(gameId)
		.then(function(redisResponse)
		{
			if (Array.isArray(redisResponse))
			{
				for (var userObjKey in redisResponse)
				{
					var userObj = redisResponse[userObjKey];
					
					if (userObj.videoStatus == video_details_lib.VideoDetailsConstants.VIDEO_STATE_QUEUED)
						aryUsersFound.push(userObj);
				}
			}
			
			return aryUsersFound;
		});
	}
	
	/**
	 * Use this method to build the payload that tells everyone to start playing the
	 * 	next video.
	 *
	 * @param {GameDetails} gameDetailsObj - The current game details object.
	 * @param {string} appEventId - A valid app event ID that either the client provides
	 *   when it creates a client side Ethereum transaction or the server provides when
	 * @param {UserDetails} userDetailsObj - The current user details object.
	 *
	 * @return {Object}
	 * 
	 * NOTE: See the _doCommonPayloadProcessing() method for an explanation of this
	 * 	method's gameDetailsObj and confirmAndCompleteObj parameters and return type.
	 */
	this.buildPayload_play_next_round = function(gameDetailsObj, appEventId, userDetailsObj)
	{
		var errPrefix = '(buildPayload_play_next_round) ';
		
		if (!userDetailsObj)
			throw new Error(errPrefix + 'The user details object is unassigned.');
			
		userDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
		
		if (!gameDetailsObj.videoIdCurrentlyPlaying || misc_shared_lib.isEmptySafeString(gameDetailsObj.videoIdCurrentlyPlaying))
			throw new Error(errPrefix + 'The field that tells us what video is currently playing is empty.');

		var retObj = self._doCommonPayloadProcessing(
			gameDetailsObj,
			appEventId,
			'buildPayload_play_next_round',
			game_details_lib.GameDetailsConstants.APP_EVENT_PLAY_NEXT_ROUND);
			
		// Add the updated user details object to the app event result object returned
		//  by the method that does the payload processing common to all payload
		//  builder methods.
		retObj.customDataObj.user_details_obj = userDetailsObj;
		
		return retObj;
		
		/* Old code
		return {
			game_master_task: game_details_lib.GameDetailsConstants.APP_EVENT_PLAY_NEXT_ROUND,
			user_details_obj: userDetailsObj
		}
		*/
	}
	
	/**
	 * Use this method to build the payload that tells everyone a new player was added
	 * 	to the game, indicating they have also paid their entry fee since the code
	 * 	that calls this method executes after the player's payment has been confirmed.
	 *
	 * @param {GameDetails} - The game details of the relevant game.
	 * @param {string} appEventId - A valid app event ID that either the client provides
	 *   when it creates a client side Ethereum transaction or the server provides when
	 * @param {UserDetails} - The user details of the new player added, now updated
	 * 	with new information.
	 *
	 * @return {Object}
	 *
	 * NOTE: See the _doCommonPayloadProcessing() method for an explanation of this
	 * 	method's gameDetailsObj and appEventId parameters and return type.
	 */
	this.buildPayload_new_player_added = function(gameDetailsObj, appEventId, userDetailsObj)
	{
		var errPrefix = '(buildPayload_new_player_added) ';
		
		var retObj = self._doCommonPayloadProcessing(
			gameDetailsObj,
			appEventId,
			'buildPayload_new_player_added',
			game_details_lib.GameDetailsConstants.APP_EVENT_NEW_PLAYER_ADDED);
			
		// Add the updated user details object to the app event result object returned
		//  by the method that does the payload processing common to all payload
		//  builder methods.
		retObj.customDataObj.user_details_obj = userDetailsObj;
		
		return retObj;
	}
	
	/**
	 * Use this method to build the payload that tells everyone the results of the game
	 * 	after the game is over.
	 *
	 * @param {GameDetails} gameDetailsObj - The current game details object.
	 * @param {string} appEventId - A valid app event ID that either the client provides
	 *   when it creates a client side Ethereum transaction or the server provides when
	 *
	 * @return {Object}
	 *
	 * NOTE: See the _doCommonPayloadProcessing() method for an explanation of this
	 * 	method's gameDetailsObj and appEventId parameters and return type.
	 */
	this.buildPayload_game_over = function(gameDetailsObj, appEventId)
	{
		var errPrefix = '(buildPayload_game_over) ';
		
		if (!gameDetailsObj)
			throw new Error(errPrefix + 'The game details object is unassigned.');
			
		if (!gameDetailsObj.aryWinners)
			throw new Error(errPrefix + 'The array of winners object in the game details object is unassigned.');

		var retObj = self._doCommonPayloadProcessing(
			gameDetailsObj,
			appEventId,
			'buildPayload_new_player_added',
			game_details_lib.GameDetailsConstants.APP_EVENT_GAME_OVER);
			
		return retObj;
		
		/*
		return {
			game_master_task: game_details_lib.GameDetailsConstants.APP_EVENT_GAME_OVER,
		}
		*/
	}

	/**
	 * Use this method to build the payload that tells everyone the newly created game
	 * 	is fully ready for playing (and can be started if desired).
	 *
	 * @param {GameDetails} gameDetailsObj - A valid game details object.
	 *
	 * @param {string} appEventId - A valid app event ID that either the client provides
	 *   when it creates a client side Ethereum transaction or the server provides when
	 *   it creates a server side transaction.
	 * @param {string} operationDesc - a short description of the operation, useful for logging
	 * 	and error reporting purposes.
	 * @param {string} taskName - The GameDetailsConstants label that represents the
	 * 	the task (app event type) this call is being made for.
	 *
	 * @return {AppEventResult} - returns an app event result object.
	 *
	 * 	@private
	 */

	this._doCommonPayloadProcessing = function(gameDetailsObj, appEventId, operationDesc, taskName) {
		let errPrefix = '(_doCommonPayloadProcessing) ';

		if (!gameDetailsObj)
			throw new Error(errPrefix + 'The Ethereum confirm and complete object is unassigned.');
		
		if (!(gameDetailsObj instanceof game_details_lib.GameDetails))
			throw new Error(errPrefix + 'The value in the gameDetailsObj parameter is not a GameDetails object.');
		
		// We request advanced validation because we need the smart contract game ID value.
		gameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
		
		if (typeof appEventId != 'string')
			throw new Error(errPrefix + 'The value in the appEventId parameter is not a string.');
			
		if (misc_shared_lib.isEmptySafeString(appEventId))
			throw new Error(errPrefix + 'The appEventId parameter is empty.');
		
		if (typeof operationDesc != 'string')
			throw new Error(errPrefix + 'The value in the operationDesc parameter is not a string.');
			
		if (misc_shared_lib.isEmptySafeString(operationDesc))
			throw new Error(errPrefix + 'The operation description is empty.');
		
		if (typeof taskName != 'string')
			throw new Error(errPrefix + 'The value in the taskName parameter is not a string.');
			
		if (misc_shared_lib.isEmptySafeString(taskName))
			throw new Error(errPrefix + 'The operation description is empty.');
		
		let appEventresultObj = new AppEventResult();
		
		// Transfer the app event ID from the confirm and complete object to the app event result object.
		appEventresultObj.appEventId = appEventId;
		
		// Tell the client which app event has just completed.
		appEventresultObj.customDataObj = new Object();
		appEventresultObj.customDataObj.game_master_task = taskName;
		
		// The client code needs the game ID the smart contract assigned to our game: idInSmartContract
		appEventresultObj.customDataObj.id_in_smart_contract = gameDetailsObj.idInSmartContract;
		
		// Payload built.
		return appEventresultObj;
	
	}
	
	/**
	 * Use this method to build the payload that tells everyone the newly created game
	 * 	is fully ready for playing (and can be started if desired).
	 *
	 * NOTE: See the _doCommonPayloadProcessing() method for an explanation of this
	 * 	method's gameDetailsObj and appEventId parameters and return type.
	 *
	 */
	this.buildPayload_new_game_is_ready = function(gameDetailsObj, appEventId)
	{
		let errPrefix = '(buildPayload_new_game_is_ready) ';
		
		return self._doCommonPayloadProcessing(
			gameDetailsObj,
			appEventId,
			'buildPayload_new_game_is_ready',
			game_details_lib.GameDetailsConstants.APP_EVENT_NEW_GAME_IS_READY);
	}
	
	/**
	 * Use this method to build the payload that contains an Ethereum transaction result.
	 *
	 * @param {EthereumTransactionResult_ebb} ethTransResult - A valid Ethereum transaction
	 * 	result object.
	this.buildPayload_ethereum_transaction_result = function(ethTransResult)
	{
		var errPrefix = '(buildPayload_play_next_round) ';
		
		if (!ethTransResult)
			throw new Error(errPrefix + 'The Ethereum transaction result object is unassigned.');
		
		if (!ethTransResult.gameDetailsObj)
			throw new Error(errPrefix + 'The Ethereum transaction result object contains an invalid or missing game details object.');
		
		return {
			game_master_task: game_details_lib.GameDetailsConstants.TASK_ETHEREUM_TRANSACTION_RESULT,
			ethereum_transaction_result_obj: ethTransResult
		}
	}
	 */
	
	/**
	 * Returns a promise that sends a text message to the given channel name using PubNub
	 * 	on behalf of this server acting as the game master.  It handles the return of a
	 * 	JSON response.  Note, the updated game details object is included with the message.
	 *
	 * REMEMBER!: The client side code expects the payload to have an EthereumTransactionResult
	 * 	object!  Otherwise it will throw an error.
	 *
	 * @param {Object|null} req - A valid Express request object.  If one is not provided, we
	 * 	assume the caller wants to handle any responses (i.e. - if it is NULL).
	 * @param {Object|null} res - A valid Express response object.  If one is not provided, we
	 * 	assume the caller wants to handle any responses (i.e. - if it is NULL).
	 * @param {Object} gameDetailsObj - A valid game details object.
	 * @param {Object} payload - The object to broadcast.
	 * @param {string} [simpleMessageText] - An optional simple text message to send.
	 *
	 * @return {Object} - Returns a promise that returns TRUE if the broadcast succeeded,
	 * 	FALSE if not.
	 *
	 */
	this.broadcastMessage_promise = function(req, res, gameDetailsObj, payload, simpleMessageText) {
		var errPrefix = '(broadcastMessage_promise) ';

		let bSendResponses = (res != null);
		
		if (!gameDetailsObj)
			throw new Error(errPrefix + 'The game details object is unassigned.');
		
		if (misc_shared_lib.isEmptySafeString(gameDetailsObj.channelName))
			throw new Error(errPrefix + 'The game details object has an empty channel name.');
			
		return new Promise(function(resolve, reject)
		{
			try
			{
				// Conform the simple message text parameter to NULL if it is empty or
				//  undefined.
				if (typeof simpleMessageText == 'undefined')
					simpleMessageText = null;
					
				const pubnubInstance = new pubnub_lib(
				{
					publishKey: pubnub_support.getPubNubPublishKeyFromEnvironment(),
					subscribeKey: pubnub_support.getPubNubSubscribeKeyFromEnvironment()
				});
				
				console.log(errPrefix + 'Broadcasting the message shown below to this PubNub channel: ' + gameDetailsObj.channelName);
				console.log(payload);
				
				var publishConfig = {
					channel : gameDetailsObj.channelName,
					message : {
						is_error: false,
						// Set the flag that tells the client side code to update their copy of the
						//  game details object with this one.
						isUpdatedGameDetailsObj: true,
						sender: game_details_lib.GameDetailsConstants.SENDER_NAME_GAMEMASTER,
						// We send back the latest copy of the game details object so all clients
						//  can sync their copy to the latest one.
						game_details_object: gameDetailsObj,
						payload: payload,
						simpleMessage: simpleMessageText
					}
				}
				
				pubnubInstance.publish(
					publishConfig,
					function(status, response)
					{
						if (status.hasOwnProperty('error') && misc_shared_lib.isTrueOrStrTrue(status.error)){
							let errMsg = errPrefix + 'The PubNub broadcast attempt failed.';
							
							console.warn()
							console.warn(status);
							
							if (bSendResponses)
								common_routines.returnStandardErrorObj(req, res, errMsg);
							
							// Resolve the promise with a FALSE result.
							resolve(false);
						}
						else
						{
							let errMsg = errPrefix + 'Broadcast succeeded, status and response objects shown below: ';
							
							console.log(errMsg);
							console.log(status, response);
							
							// Successful publish.  Don't return a successfulConfirmation response because we will cause
							//  an error when the route that triggered the broadcast tries to
							//  return it's own response.
							// common_routines.returnStandardSuccessJsonObj(req, res, errMsg);
							
							// Resolve the promise with a TRUE result.
							resolve(true);
						}
					});
			}
			catch(exc)
			{
				// Convert the exception to a promise rejection.
				common_routines.myRejectPromise(arguments.callee.name, exc.message, exc, resolve, reject);
			}
		});
	}

	/**
	 * Returns a promise that sends a message that specifically carries an Ethereum
	 * 	transaction result to the given channel name using PubNub on behalf of this
	 * 	server acting as the game master.  It does not return a response to anyone
	 * 	because this method is called by the server side monitor that waits for
	 * 	Ethereum transaction blocks to be mined.  In other words, this method
	 * 	is NOT called in the context of an Express route service a client
	 * 	web request and that is why it doesn't have Express request and
	 * 	response object parameters like broadcastMessage_promise() does.
	 *
	 * @param {EthereumTransactionResult_ebb} ethTransResult - An additional auxiliary object to broadcast.
	 *
	 * @return {Object} - Returns a promise that returns TRUE if the broadcast succeeded,
	 * 	FALSE if not.
	 *
	 */
	this.broadcastEthereumTransactionResult_promise = function(ethTransResult) {
		var errPrefix = '(broadcastEthereumTransactionResult_promise) ';
		
		if (!ethTransResult)
			throw new Error(errPrefix + 'The Ethereum transaction result object is unassigned.');
		
		if (!ethTransResult.gameDetailsObj)
			throw new Error(errPrefix + 'The Ethereum transaction result object contains an invalid or missing game details object.');
		
		if (misc_shared_lib.isEmptySafeString(ethTransResult.gameDetailsObj.channelName))
			throw new Error(errPrefix + 'The game details object has an empty channel name.');
			
		return new Promise(function(resolve, reject)
		{
			try
			{
				const pubnubInstance = new pubnub_lib(
				{
					publishKey: pubnub_support.getPubNubPublishKeyFromEnvironment(),
					subscribeKey: pubnub_support.getPubNubSubscribeKeyFromEnvironment()
				});
				
				// Build the message payload.
				let payload = self.buildPayload_ethereum_transaction_result(ethTransResult);
				
				console.log(errPrefix + 'Broadcasting the message shown below to this PubNub channel: ' + ethTransResult.gameDetailsObj.channelName);
				console.log(payload);
				
				var publishConfig = {
					channel : ethTransResult.gameDetailsObj.channelName,
					message : {
						is_error: false,
						isUpdatedGameDetailsObj: ethTransResult.isUpdatedGameDetailsObj,
						sender: game_details_lib.GameDetailsConstants.SENDER_NAME_GAMEMASTER,
						// We send back our copy of the game details object so the client side
						//  code can use it to see the state of the game details object at the
						//  time the Ethereum transaction associated with the transaction result
						// 	was submitted to the network.
						game_details_object: ethTransResult.gameDetailsObj,
						payload: payload,
						// We don't send a simple text message object.
						simpleMessage: null
					}
				}
				
				pubnubInstance.publish(
					publishConfig,
					function(status, response)
					{
						if (status.hasOwnProperty('error') && misc_shared_lib.isTrueOrStrTrue(status.error)){
							let errMsg = errPrefix + 'The PubNub broadcast attempt failed.';
							
							// We can't send a result back to the client because currently PubNub
							//  communications are failing.  Log the error nad move on.
							console.error(errMsg);
							console.error(status);
							
							// Resolve the promise with a FALSE result.
							resolve(false);
						}
						else
						{
							let errMsg = errPrefix + 'Broadcast succeeded, status and response objects shown below: ';
							
							console.log(errMsg);
							console.log(status, response);
							
							// Successful publish. Resolve the promise with a TRUE result.
							resolve(true);
						}
					});
			}
			catch(exc)
			{
				// Convert the exception to a promise rejection.
				common_routines.myRejectPromise(arguments.callee.name, exc.message, exc, resolve, reject);
			}
		});
	}
}();

module.exports = {
	gamemaster: gamemaster
}