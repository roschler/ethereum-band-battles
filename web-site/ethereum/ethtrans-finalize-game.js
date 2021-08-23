/**
 * This file contains the code to execute the server side generated Ethereum transaction that tells the
 * 	EtherBandBattles smart contract to finalize a particular game.
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
const GamePaymentsSummary = require('../common/game-details-server-side-only').GamePaymentsSummary;
const getGameState_promise = require('../ethereum/ethereum-ebb-helpers').getGameState_promise;
const EnumGameState = require('../common/solidity-helpers-misc').EnumGameState;
const getGamePaymentsSummary_promise = require('./ebb-getter-call-support').getGamePaymentsSummary_promise;
const updateSSOGameDetailsGasUsed_promise = require('../common/redis-wrappers').updateSSOGameDetailsGasUsed_promise;
const updateServerSideOnlyDetailsField_promise = require('../common/redis-wrappers').updateServerSideOnlyDetailsField_promise;

/**
 * This object is the data bag for the finalize game Ethereum transaction.
 *
 * @constructor
 */
function FinalizeGame_bag() {
	var self = this;
	
	/** @property {string|null} - A valid game ID for the game whose House public address was set. */
	this.gameId = null;
	
	/** @property {number|null} - The EtherBandBattlesManager's ID for the corresponding game. */
	this.idInSmartContract = null;
	
	/** @property {string} - The app event tracking ID for the make game transaction.
	 * 		(Created on the server side) */
	this.appEventId = null;
	
	/** @property {string} - The reference date/time that is used as the "start date"
	 *		when computing the total round trip time it took for the payment to
	 *		get paid (i.e. - the payment transaction is confirmed/mined), starting
	 *		at the time it was scheduled during the finalizeGame() call.
	 */
	this.paymentStartTimestamp = null;
	
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
		let errPrefix = '(FinalizeGame_bag::funcLogging) ';
		
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
		let methodName = 'FinalizeGame_bag::validateMe';
		let errPrefix = '(' + methodName + ') ';
		
		if (misc_shared_lib.isEmptySafeString(self.gameId))
			throw new Error(errPrefix + ' The game ID is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.idInSmartContract))
			throw new Error(errPrefix + ' The field that holds the game ID in the smart contract is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.appEventId))
			throw new Error(errPrefix + ' The app event ID is empty.');
		
		if (typeof self.paymentStartTimestamp == 'undefined'
				|| self.paymentStartTimestamp == null
				|| self.paymentStartTimestamp == 0)
			throw new Error(errPrefix + ' The payment start time is empty or 0.');
	}
}

/**
 * This function takes an Ethereum transaction confirm and complete object and extracts the
 * 	data bag object from it.  It validates the object too.
 *
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum transaction
 * 	confirm object.
 *
 * @return {FinalizeGame_bag}
 */
function getFinalizeGame_bag(confirmAndCompleteObj) {
	let errPrefix = '(getFinalizeGame_bag) ';
	
	return getEthTransDataBag(
			'finalize game',
			confirmAndCompleteObj,
			FinalizeGame_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
				});
}


/**
 *  This is the Promise that should be executed before a call to the finalizeGame() method belonging to
 * 	the EtherBattleBandsManager contract is made.  It makes sure that all the game round results
 * 	have been successfully posted to the smart contract and that those transactions have been
 * 	confirmed/mined, otherwise the smart contract will reject the finalize game call.
 *
/**
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>} - Returns a promise that resolves to TRUE if the conditions
 * 	necessary to finalize a game are in place now, FALSE if not.
 */
function prerequisiteCheckFinalizeGame_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'prerequisiteCheckFinalizeGame_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getFinalizeGame_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			// Get the current game state from the smart contact.  The getGameState_promise() validates the
			//  return for us.
			getGameState_promise(dataBag.idInSmartContract)
			.then(function(result) {
				let gameState = result;
				
				// If the smart contract sees the game as having advanced out of the PLAYING state than this is
				// 	a serious error.
				if (gameState > EnumGameState.PLAYING)
					throw new Error(errPrefix + 'The game has advanced past the playing state before we could add one of the game round results.');
					
				// If the smart contract doesn't see that the game is in the PLAYING state yet, then it may be
				//  because of lengthy delays in the Ethereum network.  We do not hold up the game for
				//  Ethereum transactions to be confirmed/mined once the game has been created in the
				//  smart contract, otherwise the players could suffer tedious delays during game play.
				let bIsGameInPlayingState = (gameState == EnumGameState.PLAYING);
				
				// Do not call the getIsGameReadyToBeFinalized() method if the smart contract does not
				//  see the game as being in the PLAYING state yet, or the call will REVERT.
				if (bIsGameInPlayingState)
					// Execute the promise that calls the EtherBandBattles smart contract method named()
					// 	to see if the game is ready to be finalized (i.e. - All game round results have
					// 	been successfully posted to the smart contract for the current game, and those
					// 	transactions have been confirmed/mined.
					return contractInstance.methods.getIsGameReadyToBeFinalized(dataBag.idInSmartContract).call();
				else
					// The smart contract does not see the game as in the PLAYING state yet.  Let the next block
					// 	know that we are not ready yet to call the smart contract'sddd ads asdfd c ~# =finalizeGame() method.
					return false;
			})
			.then(function(result) {
				if (typeof result != 'boolean')
					throw new Error(errPrefix + 'The result of the previous THEN block and possibly the getIsGameRoundResultPosted() call is not TRUE or is not boolean.');
					
				let bIsGameReadyToBeFinalized = result;
				
				// Resolve the promise with the value of bIsGameReadyToBeFinalized as the result of this prerequisites check.
				resolve(bIsGameReadyToBeFinalized);
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
 *  This is the Promise that should be executed if a call to the finalizeGame() method belonging to
 * 	the EtherBattleBandsManager contract is made to confirm that the transaction has been
 * 	confirmed/mined successfully.  The confirmation check's logic is based on checking if the
 * 	solidity shows the game has being in the GAME_OVER state, since that is the state the
 * 	finalizeGame() method in the smart contract sets the game to.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function confirmFinalizeGame_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'confirmFinalizeGame_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getFinalizeGame_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			// Get the current game state.
			getGameState_promise(dataBag.idInSmartContract)
			.then(function(result) {
				if (typeof result != 'number')
					throw new Error(errPrefix + 'The result of the getGameState() call is not a number.');
			
				let gameState = result;
				let bIsGameOver = (gameState == EnumGameState.GAME_OVER);
	
				// We must have a "success" property in our result object.
				//
				//  NOTE: The reason for the "game_is_over" property is to
				//  	make the logs more informative.
				resolve(
					{
						operation_desc: methodName,
						game_is_over: bIsGameOver,
						success: bIsGameOver
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
 * This is the on-completion handler for the finalize game transaction.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onFinalizeGameCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onFinalizeGameCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getFinalizeGame_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			// ------------- IS THE GAME OVER? -----------
			let gameDetailsObj = null;
			let gameDetailsServerSideOnlyObj = null;
			let gamePaymentsSummaryObj = null;
			
			// Get a fresh copy of the game object using the given game ID.
			redis_wrappers_lib.getGame_promise(dataBag.gameId)
			.then( result => {
				if (!(result instanceof GameDetails))
					throw new Error(errPrefix + "The result of the Redis get game call was invalid for game ID: " + dataBag.gameId);
					
				gameDetailsObj = result;
				
				// Get the game payments summary from the smart contract.
				return getGamePaymentsSummary_promise(gameDetailsObj);
			})
			.then(result =>
			{
				if (!(result instanceof GamePaymentsSummary))
					throw new Error(errPrefix + 'The value in the result parameter is not a GamePaymentsSummary object.');
					
				gamePaymentsSummaryObj = result;
			
				// Get the gas used for this transaction and update the server side only details object
				//  for this game with that value.
				let gasUsedGwei = lifecycleObj.wrappedResultOfGetTransactionReceiptCall.getGasUsedGwei();
				
				let historyMessage = 'The gas charged to the server for finalizing the game was: ' + gasUsedGwei.toString();
				
				// Add it to the Ethereum transaction history.
				lifecycleObj.addHistoryMessage(methodName, historyMessage);
				
				// This method updates the desired gas-used field in the server side only game details object and
				//	returns the updates server side only game details object.
				return updateServerSideOnlyDetailsField_promise(
						gameDetailsObj.id,
						// Update the game payments summary field with what we got back from the smart contract.
						'gamePaymentsSummary',
						gamePaymentsSummaryObj,
						gasUsedGwei,
						lifecycleObj.confirmAndCompleteObj.isServerSideTransaction);
			})
			.then(result =>
			{
				if (!(result instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the result parameter is not a GameDetailsServerSideOnly object.');
					
				gameDetailsServerSideOnlyObj = result;
					
				// Resolve the promise with a success tuple.  We must have a "success" property in our result object.
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
 * SMART CONTRACT CALL: function finalizeGame(uint256 _gameId)
 *
 * @return {Promise<any>}
 */
function finalizeGame_promise(gameDetailsObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'finalizeGame_promise';
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
			let dataBag = new FinalizeGame_bag();
			dataBag.gameId = gameDetailsObj.id;
			dataBag.idInSmartContract = gameDetailsObj.idInSmartContract;
			dataBag.appEventId = appEventId;
			// We pass in the approximate time the game payments are considered
			//	"scheduled" (now) to the smart contract finalizeGame() call.
			//	In reality, the payment is considered "scheduled" when this
			//	Ethereum transaction gets confirmed/mined because that is when
			//	the game payments are ACTUALLY scheduled.  But this serves as
			//	a "good enough" value, especially when you consider that the
			//	time to get the block mined is part of the duration involved in
			//	the round trip that starts now, and ends when the payment is
			//	actually claimed and confirmed/mined.
			dataBag.paymentStartTimestamp = Date.now();

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
						return contractInstance.methods.finalizeGame(dataBag.paymentStartTimestamp, dataBag.idInSmartContract);
					},
					prerequisiteCheckFinalizeGame_promise,
					confirmFinalizeGame_promise,
					onFinalizeGameCompletion_promise,
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
	finalizeGame_promise: finalizeGame_promise
}