/**
 * This module contains all the server side on-success event handlers that are fired after
 * 	confirmation of an Ethereum transaction is received.
 *
 * NOTE: This is the OLD/LEGACY CODE for handling Ethereum transactions, before
 * 	we created the new framework.
 *
 */

const redis_wrappers_lib = require('./redis-wrappers');
const DelayedPromiseExecution = require('../ethereum/delayed-promise-execution').DelayedPromiseExecution;
const ethereum_transactions = require('../process/ethereum-transactions');
const game_details_lib = require('../public/javascripts/game-objects/game-details');
const private_payment_details_lib = require('../private-objects/private-payment-details');
const GameDetailsServerSideOnly = require('./game-details-server-side-only').GameDetailsServerSideOnly;
const gamemaster_lib = require('./game-master');
const ethereum_server_side_only = require('../private-objects/ethereum-server-side-only');
const waitForEthTransactions = require('../process/wait-for-ethereum-blocks.js').WaitForEthereumBlocks;
const EnumEthereumTransactionType_ebb = require('../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
const EnumGameState = require('../../common/solidity-helpers-misc').EnumGameState;

/**
 * This method executes the finalizeGame() smart contract method.  This method
 * 	calculates the payment amounts to the players and the bands.  It does not
 * 	make any actual payments.  That happens later.  The game will be set to
 * 	the GAME_OVER state when the smart contract call completes (and is
 * 	confirmed/mined).
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 *
 * @return {Promise<Object>} - Returns a JSON object with the
 * 	final details of the request.
 */
function finalizeGame_promise(gameDetailsObj)
{
	return new Promise(function(resolve, reject) {
	
		let errPrefix = "(finalizeGame_promise) ";
		
		try {
			ethereum_server_side_only.doServerSideSignedTransaction_promise(
				gameDetailsObj.id,
				'finalize game',
				(contractInstance) => {
					// Return the code needed to make the makePayments() smart contract method.
					return contractInstance.methods.makePayments(gameDetailsObj.idInSmartContract);
				})
			.then(result => {
				// The result should be the Ethereum transaction hash for our makePayments()
				//  method call.
				let txHash = result;
				
				console.log(errPrefix + "Transaction hash received for our makePayments() smart contract call: " + txHash);
				
				// Resolve the promise with the transaction hash.
				return txHash;
			})
			.then(function(ignoreTxHash)
			{
				// We don't need an Ethereum transaction ID because the client takes action
				//  upon the PubNub broadcast we make when we get confirmation of the
				//  makePayments() call transaction.
				let ethereumTransactionTrackingId = "(none)";
				
				// Add a transaction waiter for the transaction to our Ethereum transaction monitor.
				waitForEthTransactions.addWaiterForTransaction(
					gameDetailsObj,
					new ethereum_transactions.EBB_ConfirmMakePayments_promise_builder(gameDetailsObj, ethereumTransactionTrackingId),
					new DelayedPromiseExecution(onMakePaymentsSuccess_promise, [gameDetailsObj]),
					null,
					ethereumTransactionTrackingId,
					EnumEthereumTransactionType_ebb.finalize_game);
		
				// Return a successfulConfirmation result object with the updated game details object.
				let retJsonObj = {
						is_error: false,
						game_details_obj: gameDetailsObj,
						message: 'Make payments call submitted to the Ethereum network.  Waiting for confirmation.'
					};
					
				resolve(retJsonObj);
			})
			.catch( err => {
				reject(errPrefix + err);
			});
		}
		catch(err) {
			reject(errPrefix + err);
		};
	});
}

/**
 *  This is the Promise that should be executed if a call to the makeGame() method belonging to
 * 	the EtherBattleBandsManager contract is successfully confirmed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 * @param {UserDetails} userDetailsObj - A valid user details object.
 *
 * @return {Promise<any>}
 */
function onMakeGameSuccess_promise(gameDetailsObj, userDetailsObj)
{
	return new Promise(function(resolve, reject) {
		try
		{
			let errPrefix = '(onMakeGameSuccess_promise) ';
			
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object is unassigned.');
				
			// Validate it.
			gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
			
			if (!userDetailsObj)
				throw new Error(errPrefix + 'The user details object is unassigned.');
				
			// Validate the user details object.
			userDetailsObj.validateMe();
			
			let console = process.console;
			
			// Use the provided game ID that was created by the game creator client code.
			let gameId = gameDetailsObj.id;
			
			// Change the game state to that of waiting for players.
			gameDetailsObj.state = EnumGameState.CREATED;
			
			// Store the game details object in Redis using the given ID.
			
			// Ask the smart contract for its game ID, so we can update our game details object.
			let contractInstance = ethereum_transactions.ethConfirmCommon(errPrefix, gameDetailsObj);
			
			// Execute the getGameId() contract method using the request nonce that was
			//  used during the makeGame() call.
			contractInstance.methods.getGameId(gameDetailsObj.requestNonceFormatted).call()
			.then(function(result) {
				// The result should contain the smart contract's ID for our game.  All game IDs must
				//  be greater than 0.
				if (result < 1)
					throw new Error(errPrefix + "Invalid game ID returned by the smart contract using our game's request nonce.");
					
				// Update our game ID object.
				gameDetailsObj.idInSmartContract = result;
				
				// Execute a Redis query to add the game.
				return redis_wrappers_lib.addGame_promise(gameId, gameDetailsObj)
			})
			.then(function(redisResponse){
				// TODO: Validate Redis response.
				// The earlier call to prepare-for-game-payment-api would have created a game object already.
				// if (redisResponse !=  1)
				//	throw new Error(errPrefix + 'Game creation request failed');
				
				console.log(errPrefix + 'Successfully saved game details object using ID: ' + gameId);
				
				// Now add the user.
				return redis_wrappers_lib.addUser_promise(gameId, userDetailsObj.uuid, userDetailsObj);
			})
			.then(function(redisResponse){
				// TODO: Validate Redis response.
				// Did the add user request succeed?
				// if (redisResponse !=  1)
				//	throw new Error(errPrefix + 'Unable to create user record for the game creator');
				
				// Add a payment details record for the user.  The initial status will
				//  be 'pending' by default.
				// TODO: Are we still using this field?  If not, should we, and is the user's
				//  status being upgraded (and broadcasted) once we are notified that their
				//  payment has been confirmed by the Ethereum network?
				let privatePaymentObj = new private_payment_details_lib.PaymentForEntryFee();
				privatePaymentObj.userId = userDetailsObj.uuid;
				
				console.log(
					errPrefix
					+ "Adding private payment object for game ID and user ID: \n"
					+ gameDetailsObj.id
					+ '\n'
					+ userDetailsObj.uuid);
				
				return redis_wrappers_lib.addPrivatePayment_promise(gameId, userDetailsObj.uuid, privatePaymentObj);
			})
			.then(function(redisResponse){
				// TODO: Restore this once the problem with pre-existing objects is solved.
				// Did the add private payment request succeed?
				//if (redisResponse !=  1)
				//	throw new Error(errPrefix + 'Unable to create an entry fee payment record for the game creator');
				
				console.log(errPrefix + 'Successfully saved game details object using ID: ' + gameId);
				resolve(true);
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

/**
 *  This is the Promise that should be executed if a call to the makeGame() method belonging to
 * 	the EtherBattleBandsManager contract is successfully confirmed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 *
 * @return {Promise<any>}
 */
function onMakePaymentsSuccess_promise(gameDetailsObj)
{
	return new Promise(function(resolve, reject) {
		try
		{
			let errPrefix = '(onMakePaymentsSuccess_promise) ';
			
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object is unassigned.');
				
			// Validate it.
			gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
			
			let console = process.console;
			
			// Use the provided game ID that was created by the game creator client code.
			let gameId = gameDetailsObj.id;
			
			// Change the game state to that of being completed.
			gameDetailsObj.state = game_details_lib.GameDetailsConstants.GAME_PHASE_COMPLETED;
			
			// Store the game details object in Redis using the given ID.
			
			// Execute a Redis query.
			redis_wrappers_lib.addGame_promise(gameId, gameDetailsObj)
			.then(function(redisResponse){
				console.log(errPrefix + 'Successfully saved game details object using ID: ' + gameId);
				
				return (redisResponse);
			})
			.then(function(ignore){
				console.log(errPrefix + 'Game successfully completed with payments made or escrowed for game ID: ' + gameId);
				resolve(true);
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

/**
 *  This is the Promise that should be executed if a call to the startGame() method belonging to
 * 	the EtherBattleBandsManager contract is successfully confirmed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 * @param {UserDetails} firstUserWithQueuedVideoObj - The user whose video we are going to play first.
 *
 * @return {Promise<any>}
 */
function onStartGameSuccess_promise(gameDetailsObj, firstUserWithQueuedVideoObj)
{
	return new Promise(function(resolve, reject) {
		try
		{
			let errPrefix = '(onStartGameSuccess_promise) ';
			
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object is unassigned.');
				
			// Validate it.
			gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
			
			if (!firstUserWithQueuedVideoObj)
				throw new Error(errPrefix + 'The user details object is unassigned.');
				
			// Validate the user details object.
			firstUserWithQueuedVideoObj.validateMe();
			
			let console = process.console;
			
			// Use the provided game ID that was created by the game creator client code.
			let gameId = gameDetailsObj.id;
			
			// Change the game state to that of "playing".
			gameDetailsObj.state = EnumGameState.PLAYING;
			
			console.log(errPrefix + "The following game ID was set to the playing state: " + gameDetailsObj.id);
			
			// Store the game details object in Redis using the given ID.
			
			// Execute a Redis query.
			redis_wrappers_lib.addGame_promise(gameId, gameDetailsObj)
			.then(function(redisResponse){
				console.log(errPrefix + 'Successfully saved game details object using ID: ' + gameId);
			})
			.then(function(redisResponse)
			{
				// Broadcast the request to start the first round of play.
				let broadcastPayload =
					gamemaster_lib.gamemaster.buildPayload_play_next_round(gameDetailsObj, firstUserWithQueuedVideoObj);
				
				return gamemaster_lib.gamemaster.broadcastMessage_promise(
					null,
					null, // We don't want the broadcast method to try to send any responses.
					gameDetailsObj,
					broadcastPayload,
					'Start the first round by playing a new video.');
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

/**
 * This is the Promise that should be executed if a call to the addPlayer() method belonging to
 * 	the EtherBattleBandsManager contract is successfully confirmed.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 * @param {UserDetails} userDetailsObj - A valid user details object.
 *
 * @return {Promise<any>}
 */
function onAddPlayerSuccess_promise(gameDetailsObj, userDetailsObj)
{
	return new Promise(function(resolve, reject) {
		let errPrefix = '(onAddPlayerSuccess_promise) ';
		
		try
		{
			// >>>>> The Ethereum transaction revolving around the add player request we
			//  were created to service has been confirmed.
			
			// Mark the user as having a confirmed entry fee payment.
			userDetailsObj.isEntryFeePaidAndConfirmed = true;
			
			// Now add the user to the user table since we know they have paid their entry fee
			//  and that payment has been written to the blockchain.
			redis_wrappers_lib.addUser_promise(gameDetailsObj.id, userDetailsObj.uuid, userDetailsObj)
			.then(function(redisResponse)
			{
				// Did the user add request succeed?
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
				
				//  Done.  Resolve the promise with a successfulConfirmation message.
				var successObj = {
					is_error: false,
					game_details_obj: gameDetailsObj,
					user_details_obj: userDetailsObj,
					message: 'User added to game successfully after confirmation of their Ethereum payment.'
				}
				
				// To see where the PubNub broadcast is made that tells everyone that the
				// 	target user has successfully paid their entry fee and that their entry
				// 	fee payment is confirmed. See the EBB_ConfirmAddPlayer_promise_builder
				//	object.
				
				// Resolve the promise with the result.
				resolve(successObj);
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

// ------------

/**
 * This is the Promise that should be executed if a call to the addGameRoundResult() method belonging to
 * 	the EtherBattleBandsManager contract is successfully confirmed.  Note, once all the rounds
 * 	of play has been completed, THIS promise initiates the Ethereum transaction to begin
 * 	payment processing.
 *
 * @param {GameDetails} gameDetailsObj - A valid game details object.
 *
 * @return {Promise<any>}
 */
function onAddGameRoundResultSuccess_promise(gameDetailsObj)
{
	return new Promise(function(resolve, reject) {
		let errPrefix = '(onAddGameRoundResultSuccess_promise) ';
		
		try
		{
			// >>>>> The Ethereum transaction revolving around the add game round result request we
			//  were created to service has been confirmed.
			
			// ------------- IS THE GAME OVER? -----------
			
			let gameDetailsServerSideOnlyObj = null;
			
			// The game is over when the number of confirmed game round results is equal to
			//  total number of rounds in the game.  Get the server side only game details object.
			redis_wrappers_lib.getGameDetailsServerSideOnly_promise(gameDetailsObj.id)
				.then (function(redisResponse) {
				if (!redisResponse)
					throw new Error(errPrefix + 'Unable to find a server side only game details object using game iD: ' + gameDetailsObj.id);
					
				gameDetailsServerSideOnlyObj = redisResponse;
				
				// Is the game over?
				if (gameDetailsServerSideOnlyObj.isGameOver())
					// Yes.  Initiate the make-payments process.
					return finalizeGame_promise(gameDetailsObj);
				else
				{
					// No.  Increment the count of completed rounds of play and update the server
					//  side game details object with Redis.
					return redis_wrappers_lib.addGameDetailsServerSideOnly_promise(
						gameDetailsServerSideOnlyObj.gameId, gameDetailsServerSideOnlyObj);
				}
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

module.exports = {
	onAddPlayerSuccess_promise: onAddPlayerSuccess_promise,
	onAddGameRoundResultSuccess_promise: onAddGameRoundResultSuccess_promise,
	onMakeGameSuccess_promise: onMakeGameSuccess_promise,
	onMakePaymentsSuccess_promise: onMakePaymentsSuccess_promise,
	onStartGameSuccess_promise: onStartGameSuccess_promise
}
