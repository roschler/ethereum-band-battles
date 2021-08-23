/**
 * This route should be called when we have submitted the payment of a non-game creator's
 * 	entry fee to the Ethereum network and we are waiting for confirmation of that payment.
 */

var express = require("express");
const http_status_codes = require('http-status-codes');
const router = express.Router();

// const DelayedPromiseExecution = require('../../ethereum/delayed-promise-execution').DelayedPromiseExecution;
// const ethereum_transactions = require('../../process/ethereum-transactions');
// const EnumEthereumTransactionType_ebb = require('../../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
// const waitForEthTransactions = require('../../process/wait-for-ethereum-blocks.js').WaitForEthereumBlocks;
// const onAddPlayerSuccess_promise = require('../../common/on-success-event-handlers').onAddPlayerSuccess_promise;

// ---

const EnumEthereumTransactionType_ebb = require('../../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
const common_routines = require("../../common/common-routines");
const EthereumGlobals = require('../../ethereum/ethereum-globals').EthereumGlobals;
const EthTransConfirmAndComplete = require('../../ethereum/confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthTransLifecycle = require('../../ethereum/ethereum-state-machine').EthTransLifecyle;
const gamemaster_lib = require('../../common/game-master');
// const setHousePublicAddress_promise = require('../../ethereum/ethtrans-set-house-public-address').setHousePublicAddress_promise;
const EthereumTransactionManager = require('../../ethereum/ethereum-state-machine').EthereumTransactionManager;
const game_details_lib = require('../../public/javascripts/game-objects/game-details');
const GameDetails = require('../../public/javascripts/game-objects/game-details').GameDetails;
const user_details = require('../../public/javascripts/game-objects/user-details');
const UserDetails = require('../../public/javascripts/game-objects/user-details').UserDetails;
const misc_shared_lib = require('../../public/javascripts/misc/misc-shared');
const private_payment_details_lib = require('../../private-objects/private-payment-details');
const redis_wrappers_lib = require('../../common/redis-wrappers');
const routes_support = require('../../common/routes-support');
const EthPubAddrDetails = require('../../private-objects/ethpubaddr-details').EthPubAddrDetails;
const getEthTransDataBag = require('../../ethereum/ethtrans-data-bags').getEthTransDataBag;
const extractAppEventIdFromObj = require('../../public/javascripts/game-objects/app-events').extractAppEventIdFromObj;
const EnumGameState = require('../../common/solidity-helpers-misc').EnumGameState;
const GameDetailsServerSideOnly = require('../../common/game-details-server-side-only').GameDetailsServerSideOnly;
const updateSSOGameDetailsGasUsed_promise = require('../../common/redis-wrappers').updateSSOGameDetailsGasUsed_promise;

const EnumValidateMeTypes = require('../../public/javascripts/misc/validation').EnumValidateMeTypes;
// const FugoConstants_ebb = require('../../private-objects/fugo').FugoConstants_ebb;
const FugoObjects_ebb_sso = require('../../private-objects/fugo').FugoObjects_ebb_sso;

/**
 * Simple object to hold the data fields necessary for the add player Ethereum transaction.
 *
 * @constructor
 */
function AddPlayer_bag() {
	var self = this;
	
	/** @property {string} - The ID of the relevant game.
	 */
	this.gameId = null;
	
	/** @property {string} - The ID the smart contract assigned to the game.
	 */
	this.idInSmartContract = null;
	
	/** @property {string} - The ID of the user being added to the game.
	 */
	this.userId = null;
	
	/** @property {string} - The Ethereum public address tied to the user.
	 */
	this.ethereumPublicAddress = null;
	
	/** @property {string} - The app event ID passed in to the add player transaction.
	 * 		(Created on the client side) */
	this.appEventId = null;
	
	/** @property {string} - The transaction hash object for the transaction that paid for the
	 *		game creation fee.  The object will come from Metamask when the payment was made on the
	 *		client side if this is a client side created transaction.  Otherwise
	 *		it will be filled in by the Ethereum State Machine during the send
	 *		transaction STEP by taking it from the transaction hash object returned by the
	 *		Web3JS getTransaction() call.
	 */
	this.txHashObj = null;
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
		let errPrefix = '(AddPlayer_bag::funcLogging) ';
		
		if (!lifecycleObj)
			throw new Error(errPrefix + 'The lifecycle object is unassigned.');
			
		let logMsg =
			"Game Id("
			+ self.gameId
			+ "), Smart contract game Id("
			+ self.idInSmartContract
			+ "), New Player User Id("
			+ self.userId
			+ "), user Ethereum public address("
			+ self.ethereumPublicAddress
			+ ") -> App Event ID("
			+ self.appEventId
			+ ")  Metamask Tx hash("
			+ self.txHashObj.transactionHash
			+ ").";
			
		return logMsg;
	}

	
	/**
	 * Validate this object.
	 */
	this.validateMe = function()
	{
		let errPrefix = '(AddPlayer_bag::validateMe) ';
		
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
			
		if (!self.txHashObj)
			throw new Error(errPrefix + ' The transaction hash object from Metamask is empty.');
	}
}

/**
 * This function takes an Ethereum transaction confirm and complete object and extracts the
 * 	data bag object from it.  It validates the object too.
 *
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum transaction
 * 	confirm object.
 *
 * @return {AddPlayer_bag}
 */
function getAddPlayer_bag(confirmAndCompleteObj) {
	let errPrefix = '(getAddPlayer_bag) ';
	
		return getEthTransDataBag(
			'add player',
			confirmAndCompleteObj,
			AddPlayer_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
				});
}

//--------------------------- PROMISE: Confirm new player addition --------------------


/**
 * This function returns a promise that calls the smart contract method that
 * 	lets us know a new player has been successfully created.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function confirmPlayerAddition_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'confirmPlayerAddition_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getAddPlayer_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			// We get the number of games created so far in the contract as a pre-test.
			contractInstance.methods.getNumGamesCreated().call()
			.then(function(result) {
				let numGamesCreated = result;
				
				console.log(errPrefix + "The current number of games created reported by the smart contract is: " + numGamesCreated);
				
				// Execute the getIsPlayerInGame() contract method using ID of the game as the smart contract
				//  assigned to it, and the Ethereum public address of the relevant player.
				return contractInstance.methods.getIsPlayerInGame(dataBag.idInSmartContract, dataBag.ethereumPublicAddress).call();
			})
			.then(function(result) {
				if (typeof result != 'boolean')
					throw new Error(errPrefix + 'The result of the getIsPlayerInGame() call is not boolean.');
			
				// The result indicates whether or not the player is known to the game.
				let bIsNewPlayerInGame = result;
	
				resolve(
					// We must have a "success" property in our result object.
					//  NOTE: The reason for the duplicate "is_player_in_game" property is to
					//  	make the logs more informative.
					{ operationDesc: 'confirmPlayerAddition_promise', is_player_in_game: bIsNewPlayerInGame, success: bIsNewPlayerInGame }
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
/**
 * This is the Promise that should be executed if a call to the addPlayer() method belonging to
 * 	the EtherBattleBandsManager contract is successfully confirmed.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onAddPlayerCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onAddPlayerCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getAddPlayer_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			let console = process.console;
			
			// ============================ END  : Preamble ======================
			
			// ------------------------------ FUGO - Build the object that gets commonly used server side objects -------------------
   
			// Get fresh copies of the game details object and user details objects with advanced validation, and the user's
			//  Ethereum public address.
			let fugoObj = new FugoObjects_ebb_sso(
				dataBag.gameId,
				EnumValidateMeTypes.ADVANCED_VALIDATION,
				dataBag.userId,
				EnumValidateMeTypes.ADVANCED_VALIDATION,
				true);
				
			// Now execute the FUGO promise to actually get the desired objects.
			fugoObj.getObjects_promise()
			.then(result => {
				// getObjects_promise should resolve to TRUE if all went well.  Otherwise the promise should reject.
				//  The result check below is just for some extra insurance.
				if (result !== true)
					throw new Error(errPrefix + 'The result of the method that gets the frequently used game objects from Redis did not return TRUE.');
				
				// Mark the user as having a confirmed entry fee payment.
				fugoObj.userDetailsObj.isEntryFeePaidAndConfirmed = true;
				
				// Now update the user record in the user table with updated information.
				return redis_wrappers_lib.addUser_promise(dataBag.gameId, dataBag.userId, fugoObj.userDetailsObj)
			})
			.then(redisResponse =>
			{
				// TODO: Validate Redis response.
				// Get the gas used for this transaction and update the server side only details object
				//  for this game with that value.
				let gasUsedGwei = lifecycleObj.wrappedResultOfGetTransactionReceiptCall.getGasUsedGwei();
				
				let historyMessage = 'The gas charged to the user entering the game was: ' + gasUsedGwei.toString();
				
				// Add it to the Ethereum transaction history.
				lifecycleObj.addHistoryMessage(methodName, historyMessage);
				
				// This method updates the desired gas-used field in the server side only game details object and
				//	returns the updates server side only game details object.
				return updateSSOGameDetailsGasUsed_promise(
						dataBag.gameId,
						'ngcPlayersGasUsed',
						gasUsedGwei,
						lifecycleObj.confirmAndCompleteObj.isServerSideTransaction);
			})
			.then(result =>
			{
				if (!(result instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the result parameter is not a GameDetailsServerSideOnly object.');
				
				// Send a PubNub broadcast that tells everyone the game is now fully ready for
				//  playing.  The client expects the payload object to be an AppEventResult
				//  object.
				let broadcastPayload =
					gamemaster_lib.gamemaster.buildPayload_new_player_added(fugoObj.gameDetailsObj, dataBag.appEventId, fugoObj.userDetailsObj);
					
				// Broadcast the game is ready message.
				return gamemaster_lib.gamemaster.broadcastMessage_promise(
					// We set req and res parameters to NULL since we DON'T want to return a
					//  response.  Setting the house public address is a server side
					//  created Ethereum transaction and therefore therefore we are not in
					//  the execution context of handling an Express request.  (i.e. - there
					//  is no request or response objects.)
					null,
					null,
					fugoObj.gameDetailsObj,
					broadcastPayload,
					'The game is ready to be played.');
			})
			.then(ignoreResult => {
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

router.post('/wait-for-entry-fee-confirmation-api',function(req, res, next){
    try
    {
    	const errPrefix = '(wait-for-entry-fee-confirmation-api) ';
    	
		let console = process.console;

		// ---------------------- RECOVER THE GAME DETAILS OBJECT -------------
		   
    	let incomingGameDetailsObj = routes_support.recoverGameDetailsObjFromPostData(req);
    	incomingGameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);

		// ---------------------- RECOVER THE USER DETAILS OBJECT (New player being added) -------------
		   
    	let incomingUserDetailsObj = routes_support.recoverUserDetailsObjFromPostData(req);
    	incomingUserDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
    	
		// ---------------------- APP EVENT ID -------------
		
		// We should have gotten an app event ID for tracking purposes.
		if (!req.body.app_event_id)
			throw new Error('Missing app event ID.');
			
		let appEventId = req.body.app_event_id;
		
		if (misc_shared_lib.isEmptySafeString(appEventId))
			throw new Error('The app event ID is empty.');
			
		// ---------------------- TRANSACTION HASH FOR THE GAME CREATION PAYMENT (from Metamask) -------------
		
		// We should have gotten an app event ID for tracking purposes.
		if (!req.body.metamask_tx_hash_obj)
			throw new Error('Missing transaction hash from Metamask.');
			
		let txHashObj = req.body.metamask_tx_hash_obj;
		
		if (!txHashObj)
			throw new Error('The transaction hash object is empty.');

			
		// ------------------------------ FUGO - Build the object that gets commonly used server side objects -------------------
    	
    	// Get fresh copies of the game details object and user details objects with advanced validation, and the user's
    	//  Ethereum public address.
    	let fugoObj = new FugoObjects_ebb_sso(
    		incomingUserDetailsObj.gameId,
    		EnumValidateMeTypes.ADVANCED_VALIDATION,
    		incomingUserDetailsObj.id,
    		EnumValidateMeTypes.ADVANCED_VALIDATION,
    		true);
    		
    	// Now execute the FUGO promise to actually get the desired objects.
    	fugoObj.getObjects_promise()
    	.then(result => {
    		// getObjects_promise should resolve to TRUE if all went well.  Otherwise the promise should reject.
    		//  The result check below is just for some extra insurance.
    		if (result !== true)
    			throw new Error(errPrefix + 'The result of the method that gets the frequently used game objects from Redis did not return TRUE.');
    			
			// Is the game waiting for players?
			if (fugoObj.gameDetailsObj.state != EnumGameState.CREATED)
				// No.  Return an error.
				throw new Error(errPrefix + 'A request to wait for confirmation of the addition of a new player occurred while the game is not waiting for players: ' + gameId);
			
			/**
			 * Create an Ethereum lifecycle object to wait for the Ethereum transaction
			 * 	that was generated on the client side with Metamask.
			 *
			 */
			 
			let confirmAndComplete = new EthTransConfirmAndComplete();
			
			let dataBag = new AddPlayer_bag();
			
			dataBag.gameId = fugoObj.gameDetailsObj.id;
			dataBag.idInSmartContract = fugoObj.gameDetailsObj.idInSmartContract;
			dataBag.userId = fugoObj.userDetailsObj.id;
			dataBag.ethereumPublicAddress = fugoObj.ethPubAddrDetailsObj.ethereumPublicAddress;
			dataBag.appEventId = appEventId;
			dataBag.txHashObj = txHashObj;
			dataBag.validateMe();
			
			confirmAndComplete.bag = dataBag;
			
			confirmAndComplete.initialize(
					// FALSE because the transaction was not created by the server but was
					//  created on the client side.
					false,
					dataBag.funcLogging,
					// Because this transaction was created on the client side, we don't
					//  create the transaction, we just wait for it to be confirmed/mined.
					//	Therefore, we don't need a curried smart contract method function.
					null,
					null,
					confirmPlayerAddition_promise,
					onAddPlayerCompletion_promise,
					null,
					EnumEthereumTransactionType_ebb.game_creation
				);
			
			// Add the transaction to the transaction manager.
			EthereumTransactionManager.addTransaction(confirmAndComplete);
			
			// Just return a success message to the caller  The actual game creation tasks have
			//  been deferred to the transaction monitor.
			var objAuxArgs = {
				game_details_obj: fugoObj.gameDetailsObj,
				user_details_obj: fugoObj.userDetailsObj,
			}
			
			common_routines.returnStandardSuccessJsonObj(
				req,
				res,
				'Request to wait for the confirmation of a new player addition, successfully initiated.',
				objAuxArgs);
				
			return(true);
		})
		.catch(err =>
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] \'Error during the execution of the wait for entry fee confirmation request. Details -> ' + err.message);
			res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error prepare enter game api request.');
			return;
		});
		/*
		.then(function(result) {
			// Just return a success message to the caller  The actual game creation tasks have
			//  been deferred to the transaction monitor.
			var successObj = {
				is_error: false,
				game_details_obj: gameDetailsObj,
				user_details_obj: userDetailsObj,
				message: 'Request to wait for the confirmation of a new player addition successfully initiated.'
			}
			
			res.status(http_status_codes.OK).send(successObj);
		});
		*/
    }
    catch (err)
    {
        console.log('[ERROR: wait-for-entry-fee-confirmation-api] Details -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the wait for entry fee confirmation request.');
        return;
    } // try/catch

});

module.exports = router;
