/**
 * This route accepts incoming requests to create a new game.
 *
 *
 * NOTE: Payment flow for creating a game:
 *
 * - The client helps the customize the game
 * - When the user clicks on create game the client does NOT call this
 * 	route directly.  Instead it triggers a Metamask payment
 */

// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

var express = require("express");
var http_status_codes = require('http-status-codes');
var router = express.Router();
// v4 for "random" uuid creation mode.

// const ethereum_transactions = require('../../process/ethereum-transactions');
// const ebbDetails = require('../../common/contract-details').EtherBandBattlesManager_details;
const EnumEthereumTransactionType_ebb = require('../../ethereum/ethereum-globals').EnumEthereumTransactionType_ebb;
const common_routines = require("../../common/common-routines");
// const defaultLoggingDetailsFunc = require('../../ethereum/ethereum-state-machine').defaultLoggingDetailsFunc;
const EthereumGlobals = require('../../ethereum/ethereum-globals').EthereumGlobals;
// const EthereumGlobalConstants = require('../../ethereum/ethereum-globals').EthereumGlobalConstants;
const EthTransConfirmAndComplete = require('../../ethereum/confirm-and-complete-objects').EthTransConfirmAndComplete;
const EthTransLifecycle = require('../../ethereum/ethereum-state-machine').EthTransLifecyle;
const setHousePublicAddress_promise = require('../../ethereum/ethtrans-set-house-public-address').setHousePublicAddress_promise;
const EthereumTransactionManager = require('../../ethereum/ethereum-state-machine').EthereumTransactionManager;
const game_details_lib = require('../../public/javascripts/game-objects/game-details');
const GameDetails = require('../../public/javascripts/game-objects/game-details').GameDetails;
const GameDetailsServerSideOnly = require('../../common/game-details-server-side-only').GameDetailsServerSideOnly;
const UserDetails = require('../../public/javascripts/game-objects/user-details').UserDetails;
const misc_shared_lib = require('../../public/javascripts/misc/misc-shared');
const private_payment_details_lib = require('../../private-objects/private-payment-details');
const redis_wrappers_lib = require('../../common/redis-wrappers');
const updateServerSideOnlyDetailsField_promise = require('../../common/redis-wrappers').updateServerSideOnlyDetailsField_promise;
const updateSSOGameDetailsGasUsed_promise = require('../../common/redis-wrappers').updateSSOGameDetailsGasUsed_promise;
const routes_support = require('../../common/routes-support');
// const user_details_lib = require('../../public/javascripts/game-objects/user-details');
// const waitForEthTransactions = require('../../process/wait-for-ethereum-blocks.js').WaitForEthereumBlocks;
const getEthTransDataBag = require('../../ethereum/ethtrans-data-bags').getEthTransDataBag;
const getGameId_promise = require('../../ethereum/ethereum-ebb-helpers').getGameId_promise;
const EnumGameState = require('../../common/solidity-helpers-misc').EnumGameState;

const EnumValidateMeTypes = require('../../public/javascripts/misc/validation').EnumValidateMeTypes;
const FugoConstants_ebb = require('../../private-objects/fugo').FugoConstants_ebb;
const FugoObjects_ebb_sso = require('../../private-objects/fugo').FugoObjects_ebb_sso;

/**
 * Simple object to hold the data fields necessary for the make game Ethereum transaction.
 *
 * @constructor
 */
function MakeGame_bag() {
	var self = this;
	
	/** @property {GameDetails} - The temporary game details object we create for the
	 * 		make game Ethereum transaction.
	 */
	this.tempGameDetailsObj = null;
	/** @property {GameDetails} - The temporary user details object we create for the
	 * 		make game Ethereum transaction.  The user in this case is the game creator.
	 */
	this.tempUserDetailsObj = null;
	
	/** @property {string} - The app event ID passed in to the make game transaction.
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
		let errPrefix = '(MakeGame_bag::funcLogging) ';
		
		if (!lifecycleObj)
			throw new Error(errPrefix + 'The lifecycle object is unassigned.');
			
		let logMsg =
			"Game Id(" 
			+ self.tempGameDetailsObj.id
			+ "), Game Creator User Id(" 
			+ self.tempUserDetailsObj.id
			+ "), -> App Event ID(" 
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
		let errPrefix = '(MakeGame_bag::validateMe) ';
		
		if (!self.tempGameDetailsObj)
			throw new Error(errPrefix + ' The temporary game details object is unassigned.');
			
		if (!self.tempUserDetailsObj)
			throw new Error(errPrefix + ' The temporary user details object is unassigned.');
			
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
 * @return {Object}
 */
function getMakeGame_bag(confirmAndCompleteObj) {
	let errPrefix = '(getMakeGame_bag) ';
	
	return getEthTransDataBag(
			'make game',
			confirmAndCompleteObj,
			MakeGame_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
					
					// Validate the contained temporary game and user details objects. Do advanced validation
					//  for the user object since we must have their public address at this point.  Don't do
					//  advanced validation for the game details object because we don't have the smart contract's
					//	game ID for the current game yet.
					bag.tempGameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
					bag.tempUserDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
					
					// However, we do need to make sure we have a formatted request nonce since we will need
					//  it for the confirmation call that checks to see if the make game transaction created
					//  on the client side has been confirmed/mined yet.
					if (misc_shared_lib.isEmptySafeString(bag.tempGameDetailsObj.requestNonceFormatted))
						throw new Error(errPrefix + 'The request nonce for the game is empty.');
				});
}

/**
 * This function extracts the temporary game and user details objects from a confirm and complete
 * 	object, and extracts the contract instance object to.  All objects are validated.
 *
 * @param {EthTransConfirmAndComplete} - confirmAndCompleteObj A valid confirm and complete object.
 *
 * @return {GameUserContractInstanceBag}
function getPrerequisiteObjectsFromBag_confirm_make_game(confirmAndCompleteObj) {
	let errPrefix = '(getPrerequisiteObjectsFromBag_confirm_make_game) ';
	
	if (!(confirmAndCompleteObj instanceof EthTransConfirmAndComplete))
		throw new Error(errPrefix + 'The confirm and complete object is unassigned or not the right object type.');
	
	let retObj = new GameUserContractInstanceBag();
	
	if (!confirmAndCompleteObj)
		throw new Error(errPrefix + 'The confirm and complete object is unassigned.');
		
	// Retrieve the game details object from the data bag.
	retObj.gameDetailsObj = confirmAndCompleteObj.getPropFromBagByName(EthereumGlobalConstants.BAG_PROP_TEMP_GAME_DETAILS_OBJ);
	retObj.gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
	
	// Retrieve the user details object from the data bag.
	retObj.userDetailsObj = confirmAndCompleteObj.getPropFromBagByName(EthereumGlobalConstants.BAG_PROP_TEMP_USER_DETAILS_OBJ);
	retObj.userDetailsObj.validateMe();
	
	retObj.contractInstance = confirmAndCompleteObj.contractHelperObj.contractInstance;
	if (!retObj.contractInstance)
		throw new Error(errPrefix + 'The contract instance found in the confirm and complete object is unassigned.');
		
	return retObj;
}
*/

//--------------------------- PROMISE: Confirm game creation --------------------

/**
 * This function returns a promise that calls the smart contract method that
 * 	lets us know the game has been successfully created.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<Object>}
 */
function confirmGameCreation_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'confirmGameCreation_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getMakeGame_bag(lifecycleObj.confirmAndCompleteObj);
			
			let requestNonceFormatted = dataBag.tempGameDetailsObj.requestNonceFormatted;
			
			// Execute the getGameId() contract method using the request nonce that was
			//  used during the makeGame() call.
			getGameId_promise(requestNonceFormatted)
			.then(function(result) {
				// Result should be the game ID.  A zero result indicates that the
				//  image of the smart contract that contains the newly created game
				// 	has not been written to the blockchain yet.
				let bNewGameIsReady = result > 0;
	
				resolve(
					// We must have a "success" property in our result object.
					//  NOTE: The reason for the duplicate "is_game_ready" property is to
					//  	make the logs more informative.
					{ operationDesc: methodName, is_game_ready: bNewGameIsReady, success: bNewGameIsReady }
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

//--------------------------- PROMISE: On completion handler --------------------

/**
 *  This is the Promise that should be executed if a call to the makeGame() method belonging to
 * 	the EtherBattleBandsManager contract is completed.
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onMakeGameCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onMakeGameCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let dataBag = getMakeGame_bag(lifecycleObj.confirmAndCompleteObj);
			
			dataBag.validateMe();
			
			let console = process.console;

			// ============================ END  : Preamble ======================
			
			// Use the provided game ID that was created by the game creator client code.
			// Change the game state to that of waiting for players.
			dataBag.tempGameDetailsObj.state = EnumGameState.CREATED;
			
			// Ask the smart contract for its game ID, so we can update our game details object.
			// Execute the getGameId() contract method using the request nonce that was
			//  used during the makeGame() call.
			getGameId_promise(dataBag.tempGameDetailsObj.requestNonceFormatted)
			.then(function(result) {
				// Result should be the game ID.  A zero result indicates that the
				//  image of the smart contract that contains the newly created game
				// 	has not been written to the blockchain yet.  All game IDs must
				//  be greater than 0.  Negative values indicate some kind of a strange problem.
				if (result < 0)
					throw new Error(errPrefix + "Invalid game ID returned by the smart contract using our game's request nonce.  Returned value is negative.");
					
				// We should never get a 0 value back since confirmGameCreation_promise() should not succeed
				//  until a value greater than 0 is returned by the smart contract.
				if (result == 0)
					throw new Error(errPrefix + "Invalid game ID returned by the smart contract using our game's request nonce.  Returned value is negative.");
					
				// Update our game ID object.
				dataBag.tempGameDetailsObj.idInSmartContract = result;
				
				// Execute a Redis query to add the game.
				return redis_wrappers_lib.addGame_promise(
					dataBag.tempGameDetailsObj.id,
					dataBag.tempGameDetailsObj)
			})
			.then(function(redisResponse){
				// TODO: Validate Redis response.
				console.log(errPrefix + 'Successfully saved game details object using ID: ' + dataBag.tempGameDetailsObj.id);
				
				// Now add the user.  Mark them (i.e. - the game creator) as having paid their entry fee too.
				dataBag.tempUserDetailsObj.isEntryFeePaidAndConfirmed = true;
				
				return redis_wrappers_lib.addUser_promise(
					dataBag.tempGameDetailsObj.id,
					dataBag.tempUserDetailsObj.uuid,
					dataBag.tempUserDetailsObj);
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
				privatePaymentObj.userId = dataBag.tempUserDetailsObj.uuid;
				
				console.log(
					errPrefix
					+ "Adding private payment object for game ID and user ID: \n"
					+ dataBag.tempGameDetailsObj.id
					+ '\n'
					+ dataBag.tempUserDetailsObj.uuid);
				
				return redis_wrappers_lib.addPrivatePayment_promise(
					dataBag.tempGameDetailsObj.id,
					dataBag.tempUserDetailsObj.uuid, privatePaymentObj);
			})
			.then(redisResponse =>
			{
				// TODO: Validate Redis response.
				// Get the gas used for this transaction and update the server side only details object
				//  for this game with that value.
				let gasUsedGwei = lifecycleObj.wrappedResultOfGetTransactionReceiptCall.getGasUsedGwei();
				
				let historyMessage = 'The gas charged to the game creator for creating the game was: ' + gasUsedGwei.toString();
				
				// Add it to the Ethereum transaction history.
				lifecycleObj.addHistoryMessage(methodName, historyMessage);
				
				// This method updates the desired gas-used field in the server side only game details object and
				//	returns the updates server side only game details object.
				return updateSSOGameDetailsGasUsed_promise(
						dataBag.tempGameDetailsObj.id,
						'gameCreatorGasUsed',
						gasUsedGwei,
						lifecycleObj.confirmAndCompleteObj.isServerSideTransaction);
			})
			.then(function(result){
				if (!(result instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the result parameter is not a GameDetailsServerSideOnly object.');
				
				// ------------------------ SET HOUSE PUBLIC ADDRESS --------------------
				
				// Now that the game has been created it is time to create the server side generated
				//  Ethereum transaction that sets the Ethereum public address.  Pass along the
				//  app event ID the client gave us so we can send it back when this new
				//  Ethereum transaction completes successfully.
				return setHousePublicAddress_promise(dataBag.tempGameDetailsObj.id, dataBag.appEventId);
			}).then(function (ignoreResult) {
				resolve(
					{ operationDesc: methodName, success: true }
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

router.post('/wait-for-game-creation-api',function(req,res, next){
   	let bResponseRequired = true;
    
    try
    {
    	var errPrefix = '(wait-for-game-creation-api) ';

		// ---------------------- RECOVER THE GAME DETAILS OBJECT -------------
		    	
    	let incomingGameDetailsObj = routes_support.recoverGameDetailsObjFromPostData(req);
    	incomingGameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);

		// ---------------------- RECOVER THE USER DETAILS OBJECT (Game Creator) -------------
		    	
    	let userDetailsObj = routes_support.recoverUserDetailsObjFromPostData(req);
    	userDetailsObj.validateMe();
    	
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

    	// ----------------- OVERRIDE THE GAME DETAILS OBJECTS WITH THE SERVER SIDE IMAGES ---------------
    	
    	// We need to fetch the game details object stored in Redis to get the request nonce (and later
    	//  possibly other modifications made to that object on the server side that the client is
    	//  unaware of.  We do not fetch the user details object because the incoming object is the
    	//  first fully initialized instance of the game creator user that the server has seen at this
    	//  point.
    	
    	// ------------------------------ FUGO - Build the object that gets commonly used server side objects -------------------
    	
    	// Get the game details object with simple validation, but not the user details object or the user's
    	//  Ethereum public address.
    	let fugoObj = new FugoObjects_ebb_sso(
    		incomingGameDetailsObj.id,
    		EnumValidateMeTypes.SIMPLE_VALIDATION,
    		FugoConstants_ebb.ID_DO_NOT_GET_OBJECT,
    		EnumValidateMeTypes.DO_NOT_VALIDATE,
    		false);
    		
    	// Now execute the FUGO promise to actually get the desired objects.
    	fugoObj.getObjects_promise()
    	.then(result => {
    		// getObjects_promise should resolve to TRUE if all went well.  Otherwise the promise should reject.
    		//  The result check below is just for some extra insurance.
    		if (result !== true)
    			throw new Error(errPrefix + 'The result of the method that gets the frequently used game objects from Redis did not return TRUE.');
    	
			/*
			redis_wrappers_lib.getGame_promise(incomingGameDetailsObj.id)
			.then(result => {
				if (!(result instanceof GameDetails))
					throw new Error('The object returned by the Redis get game call is not a game details object.');
					
				gameDetailsObj = result;
			*/
			
			/**
			 * Create an Ethereum lifecycle object to wait for the Ethereum transaction
			 * 	that was generated on the client side with Metamask.  The on-success
			 * 	handler for this object must set the house public address address for the
			 * 	game or the smart contract startGame() call will.  Therefore, the startGame()
			 * 	call should also have a game creation confirmed/mined call as a prerequisite
			 * 	function.
			 *
			 */
			 
			let confirmAndComplete = new EthTransConfirmAndComplete();
			
			// Store the game details object in the data bag since we don't want to store that
			//  object into Redis until we know the Ethereum transaction to make the game
			//  succeeded.  Normally we would store just the ID.
			
			// Same for the user details object (game creator).
			let dataBag = new MakeGame_bag();
			
			dataBag.tempGameDetailsObj = fugoObj.gameDetailsObj;
			dataBag.tempUserDetailsObj = userDetailsObj;
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
					confirmGameCreation_promise,
					onMakeGameCompletion_promise,
					null,
					EnumEthereumTransactionType_ebb.game_creation
				);
			
			// Add the transaction to the transaction manager.
			EthereumTransactionManager.addTransaction(confirmAndComplete);
			
			// Just return a success message to the caller  The actual game creation tasks have
			//  been deferred to the transaction monitor.
			let objAuxArgs = {
				game_details_obj: incomingGameDetailsObj,
				user_details_obj: userDetailsObj,
			}
			
			bResponseRequired = false;
			
			common_routines.returnStandardSuccessJsonObj(
				req,
				res,
				'Game creation transaction successfully submitted to the Ethereum network.  Waiting for confirmation.',
				objAuxArgs);
				
			return(true);
		})
		.catch(err =>
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during wait for game creation request (promise). Details -> ' + err.message);
			
			if (bResponseRequired)
				res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error prepare enter game api request.');
			return;
		});
	}
    catch (err)
    {
        console.log('[ERROR: wait-for-game-creation-api] Details -> ' + err.message);
		if (bResponseRequired)
        	res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the wait for game creation request.');
        return;
    } // try/catch
});

module.exports = router;
