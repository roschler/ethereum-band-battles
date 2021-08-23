/**
 * This module contains the code that tells the EtherBandBattles contract to pay a game participant, player or
 * 	band member.
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
const gamemaster_lib = require('../common/game-master');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const private_payment_details_lib = require('../private-objects/private-payment-details');
const redis_wrappers_lib = require('../common/redis-wrappers');
const XRefEbbGameIdToServerId = require('../common/redis-wrappers').XRefEbbGameIdToServerId;
const routes_support = require('../common/routes-support');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
const ebbDetails = require('../common/contract-details').EtherBandBattlesManager_details;
// v4 for "random" uuid creation mode.
const uuidv4 = require('uuid/v4');
const winstonLogger = require('../common/winston-logging-module').winstonLogger;
const getEthTransDataBag = require('../ethereum/ethtrans-data-bags').getEthTransDataBag;
const extractAppEventIdFromObj = require('../public/javascripts/game-objects/app-events').extractAppEventIdFromObj;
const web3utils_lib = require('web3-utils');
const EBB_PaymentDetailsRecord = require('./payment-details-record').EBB_PaymentDetailsRecord;
const EnumPaymentType = require('../common/solidity-helpers-misc').EnumPaymentType;
const PaymentMadeRecord = require('../common/payment-made-record').PaymentMadeRecord;
const GameDetailsServerSideOnly = require('../common/game-details-server-side-only').GameDetailsServerSideOnly;

// This global variable tracks how many payments have been submitted to the Ethereum network
//  that are yet to be confirmed/mined.
var g_NumPaymentsWaitingToBeMined = 0;

/**
 * This object is the data bag for the claim payment Ethereum transaction.
 *
 * @constructor
 */
function ClaimPayment_bag() {
	var self = this;
	
	/** @property {string} - The app event tracking ID for the make game transaction.
	 * 		(Created on the server side) */
	this.appEventId = null;
	
	/** @property {EBB_PaymentDetailsRecord} - The payment details received from the smart contract for the
	 * 	next pending payment to process
	 */
	this.paymentDetailsObj = null;
	
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
		let errPrefix = '(ClaimPayment_bag::funcLogging) ';
		
		if (!lifecycleObj)
			throw new Error(errPrefix + 'The lifecycle object is unassigned.');

		return
			'The address of the of the payee to receive payment is( '
			+ self.paymentDetailsObj.payeeAddr
			+ ') for the amount of (Gwei): '
			+ self.paymentDetailsObj.paymentAmountGwei;
	}

	/**
	 * Validate this object.
	 */
	this.validateMe = function()
	{
		let methodName = 'ClaimPayment_bag::validateMe';
		let errPrefix = '(' + methodName + ') ';
		
		if (misc_shared_lib.isEmptySafeString(self.appEventId))
			throw new Error(errPrefix + ' The app event ID is empty.');
			
		if (!(self.paymentDetailsObj instanceof EBB_PaymentDetailsRecord))
			throw new Error(errPrefix + ' The payment details object is unassigned or an invalid type.');
			
		self.paymentDetailsObj.validateMe();
	}
}

/**
 * This function takes an Ethereum transaction confirm and complete object and extracts the
 * 	data bag object from it.  It validates the object too.
 *
 * @param {EthTransConfirmAndComplete} confirmAndCompleteObj - A valid Ethereum transaction
 * 	confirm object.
 *
 * @return {ClaimPayment_bag}
 */
function getClaimPayment_bag(confirmAndCompleteObj) {
	let errPrefix = '(getClaimPayment_bag) ';
	
	return getEthTransDataBag(
			'claim payment',
			confirmAndCompleteObj,
			ClaimPayment_bag,
			(bag) =>
				{
					// Validate the bag.
					bag.validateMe();
				});
}

/**
 * This is the on-completion handler for the claim payment transaction.  Currently t
 * 	just adds a message to the
 *
 * @param {EthTransLifecycle} lifecycleObj - A reference to the lifecycle object for the
 * 	current Ethereum transaction.
 *
 * @return {Promise<EthTransLifecycle>}
 */
function onClaimPaymentCompletion_promise(lifecycleObj) {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'onClaimPaymentCompletion_promise';
			let errPrefix = '(' + methodName + ') ';
			
			// Decrement the count of payments still waiting to be mined/confirmed.
			g_NumPaymentsWaitingToBeMined--;
			
			if (g_NumPaymentsWaitingToBeMined < 0)
			{
				let warningMsg =
					errPrefix
					+ 'The variable that tracks the number of payments still waiting to be mined/confirmed '
					+ 'ended up with a negative value after decrementing it.  Resetting to 0.';
					
				console.warn(warningMsg);
				
				g_NumPaymentsWaitingToBeMined = 0;
			}
			else {
				console.log(errPrefix + 'Number of payments waiting to be mined/confirmed: ' + g_NumPaymentsWaitingToBeMined.toString());
			}
			
			if (!(lifecycleObj instanceof EthTransLifecycle))
				throw new Error(errPrefix + 'The lifecycle object is unassigned or is not of type EthTransLifecycle.');
				
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			let dataBag = getClaimPayment_bag(lifecycleObj.confirmAndCompleteObj);
			dataBag.validateMe();
			
			let strPaymentType = solidity_helpers_misc.enumPaymentTypeToString(dataBag.paymentDetailsObj.paymentType)
			
			// Add a history message.
			
			let historyMessage =
				'Payment completed of type('
				+ strPaymentType
				+ ') to address('
				+ dataBag.paymentDetailsObj.payeeAddr
				+ ') for the amount in Gwei of('
				+ dataBag.paymentDetailsObj.paymentAmountGwei.toString()
				+ ').';
			
			// Add a history message about this event.
			lifecycleObj.addHistoryMessage(lifecycleObj.stepName, historyMessage);
			
			let xrefGameIdObj = null;
			let gameDetailsObj = null;
			let gameDetailsServerSideOnlyObj = null;
			
			// Use the smart contract game ID to get our game ID.
			redis_wrappers_lib.getXRefEbbGameIdToServerId_promise(dataBag.paymentDetailsObj.idInSmartContract)
			.then(redisResponse =>
		  	{
				if (!redisResponse)
					throw new Error(
						errPrefix
						+ 'Redis could not find a game ID XREF object with the smart contract game ID: '
						+ dataBag.paymentDetailsObj.idInSmartContract);
				if (!(redisResponse instanceof XRefEbbGameIdToServerId))
					throw new Error(errPrefix + 'The value in the redisResponse parameter is not a XRefEbbGameIdToServerId object.');
					
				xrefGameIdObj = redisResponse;
				
				// Validate it.
				xrefGameIdObj.validateMe();
				
				// Now get out game details object with it.
				return redis_wrappers_lib.getGame_promise(xrefGameIdObj.gameId);
			})
			.then(redisResponse => {
				if (!redisResponse)
					throw new Error(errPrefix + 'Redis could not find a game details object with the game ID: ' + xrefGameIdObj.gameId);
				if (!(redisResponse instanceof GameDetails))
					throw new Error(errPrefix + 'The value in the redisResponse parameter is not a GameDetails object.');
					
				gameDetailsObj = redisResponse;
				
				// Get the server side details for the game associated with this payment.
				return redis_wrappers_lib.getGameDetailsServerSideOnly_promise(gameDetailsObj.id);
			})
			.then(redisResponse => {
				if (!redisResponse)
					throw new Error(errPrefix + 'Redis could not find a server side only game details object with the game ID: ' + gameDetailsObj.id);
				if (!(redisResponse instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the redisResponse parameter is not a GameDetailsServerSideOnly object.');
					
				gameDetailsServerSideOnlyObj = redisResponse;

				// Was this a payment to the House?
				if (dataBag.paymentDetailsObj.paymentType == EnumPaymentType.HOUSE) {
					// --------------- HOUSE PAYMENT MADE -----------
					
					// Validate the House payee address and payment amount to the House matches
					//  what we expect.
					
					// Make sure the address in the payment details object matches the one stored in the
					//  server side only game details object.
					if (dataBag.paymentDetailsObj.payeeAddr != gameDetailsServerSideOnlyObj.houseAddr) {
						let errMsg =
							errPrefix
							+ 'The payee address found in the payment details('
							dataBag.paymentDetailsObj.payeeAddr
							+ ') which should be the House address does not match the House address field of the server side only game details object: '
							gameDetailsServerSideOnlyObj.houseAddr;
							
						throw new Error(errMsg);
					}
					
					// Make sure the payment made matches the amount the smart contract reported for
					//  total House payment(s) when we received the game payments summary from it
					//	when the game was finalized.
					if (dataBag.paymentDetailsObj.paymentAmountGwei != gameDetailsServerSideOnlyObj.gamePaymentsSummary.totalHousePayment) {
						let errMsg =
							errPrefix
							+ 'The actual payment made to the House address('
							dataBag.paymentDetailsObj.paymentAmountGwei.toString()
							+ ') does not match the amount the smart contract reports it scheduled for the House: '
							gameDetailsServerSideOnlyObj.gamePaymentsSummary.totalHousePayment.toString();
							
						throw new Error(errMsg);
					}
				}
				
				// Get the gas used for this transaction and update the server side only details object
				//  for this game with that value.
				let gasUsedGwei = lifecycleObj.wrappedResultOfGetTransactionReceiptCall.getGasUsedGwei();
				
				let historyMessage =
					'The gas charged to the server for making a "('
					+ strPaymentType
					')" payment was: ' + gasUsedGwei.toString();
				
				// Add it to the Ethereum transaction history.
				lifecycleObj.addHistoryMessage(methodName, historyMessage);
				
				// Accumulate the gas used by the server in making payments to the field we have for that.
				return redis_wrappers_lib.updateSSOGameDetailsGasUsed_promise(
					gameDetailsObj.id,
					null, // We only want to accumulate the gas used figure into the total server payments for gas.
					gasUsedGwei,
					lifecycleObj.confirmAndCompleteObj.isServerSideTransaction);
			})
			.then(redisResponse =>
			{
				// TODO: Validate RedisResponse.
				
				// Now build a PaymentMadeRecord to act as a record of the payment being made that we store in
				//  Redis.
				let paymentMadeRecord = new PaymentMadeRecord();
				
				// Fill in the fields.  Note, the "id" and "paymentSourceId" fields are filled in
				//  by the object's constructor.
				paymentMadeRecord.dtCreated = new Date(dataBag.paymentDetailsObj.clientReferenceTimestamp);
				// The context is an EtherBandBattlesManager game.
				paymentMadeRecord.paymentContextId = "EtherBandBattlesManager";
				// If the payment was to the house, then this field should be NULL.  If it was to a
				//  player or a band we set it to the video ID the payment is associated with.
				paymentMadeRecord.paymentResourceId = dataBag.paymentDetailsObj.videoId;
				paymentMadeRecord.payeeAddr = dataBag.paymentDetailsObj.payeeAddr;
				paymentMadeRecord.paymentAmountGwei = dataBag.paymentDetailsObj.paymentAmountGwei;
				// Assign the reference timestamp we gave to the smart contract when the game was
				//  finalized and returned to us in the payment details object when we asked for the
				//  next payment to make to the "start" timestamp for the payment round trip.
				paymentMadeRecord.startTimestamp = dataBag.paymentDetailsObj.clientReferenceTimestamp;
				// We use the current date/time as the "end" time stamp since we consider the payment
				//  completed now.
				paymentMadeRecord.endTimestamp = new Date();
				
				// Add a history message for this payment that shows the full duration of the
				//  payment round trip in seconds.
				let durationSecs = paymentMadeRecord.getPaymentRoundTripTime_milliseconds() / 1000;
				
				let historyMessage_2 =
					"Full round trip time for the payment from the time the game was finalized until the payment was made and confirmed on the network in seconds: "
					+ durationSecs.toString()
					+ '.';
					
				lifecycleObj.addHistoryMessage(lifecycleObj.stepName, historyMessage);

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
function claimNextPayment_promise() {
	return new Promise(function(resolve, reject) {
		try
		{
			let methodName = 'claimNextPayment_promise';
			let errPrefix = '(' + methodName + ') ';
	
			// ----
			
			// Ask the smart contract how many pending payments there are for the entire contract.
			let contractInstance = EthereumGlobals.ebbContractInstance;
			
			contractInstance.methods.getNextPendingPaymentDetails(g_NumPaymentsWaitingToBeMined).call()
			.then(function(result) {
				
				// The result should be a tuple containing the payment details.  Convert it to the
				//  Javascript object we created for that purpose.
				let paymentDetailsObj = EBB_PaymentDetailsRecord.initializeFromObj(result);
				
				if (paymentDetailsObj.idInSmartContract === "0") {
					// Empty tuple result returned by the getNextPendingPaymentDetails()
					//  call.  This means that there aren't any payments pending.  Just
					//	do nothing.
					//
					// NOTE: This can happen when the system restarts after a crash.
					//	There is a chance that one or more payment transactions may
					//	may have been submitted to the Ethereum network before the
					//	server crashed, that have not been confirmed mined yet.
					//	Therefore, we are without the help of the offset parameter
					//  maintained by the server during normal operations.  (i.e. -
					// 	the offset we pass to the smart contract when requesting the
					//	next pending payment details, to skip the payments that
					//	are currently waiting to be confirmed/mined.
					console.log(
						errPrefix
						+ 'Got an empty tuple result from getNextPendingPaymentDetails() smart contract method.  Exiting');
				} else {
					// Build a transaction that makes a call to the EtherBandBattles smart contract's
					//  claimPayment method and submit it to the Ethereum state machine.
					
					/**
					 * Create an Ethereum lifecycle object that tells the smart contract to pay
					 * 	the given payee (the contract knows the payee amount) then waits for the
					 * 	transaction to complete.
					 */
					let confirmAndComplete = new EthTransConfirmAndComplete();
					
					// We do NOT create our own app event ID for this server side created transaction.  Instead
					//  we carry over the one given to the make game Ethereum transaction since the client
					//  will need to see it when we publish the "new game is ready" notification via PubNub.
					
					// Store the necessary elements in the data bag.
					let dataBag = new ClaimPayment_bag();
					dataBag.appEventId = '(none)';
					dataBag.paymentDetailsObj = paymentDetailsObj;
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
							//  desired house address.  The smart contract knows the
							//  payment amount so we don't send it.
							(contractInstance) =>
							{
								// We pass the game ID and the  video ID along with the payee address so the
								// 	EtherBandBattlesManager smart contract can find the payment in the
								//	pending payments list.  We were given this information when we called
								//	the contract's getNextPendingPaymentDetails() method.
								
								// Format the video ID as a bytes 32.
								let formattedVideoId = web3utils_lib.fromAscii(paymentDetailsObj.videoId);
								
								return contractInstance.methods.claimPayment(
									paymentDetailsObj.idInSmartContract,
									formattedVideoId,
									paymentDetailsObj.payeeAddr);
							},
							null,
							// We rely on the raw transaction check event handler to validate
							//  the success of the payment.  If the block containing the
							//  payment request to the smart contract was confirmed/mined
							//	and confirmed/mined successfully, then the payment
							//	succeeded.
							null,
							onClaimPaymentCompletion_promise,
							null,
							EnumEthereumTransactionType_ebb.make_payments
						);
						
					// Add the transaction to the transaction manager.
					EthereumTransactionManager.addTransaction(confirmAndComplete);
					
					// Increment the count of payments waiting to be mined/confirmed.
					g_NumPaymentsWaitingToBeMined++;
					
					console.log(errPrefix + 'Number of payments waiting to be mined/confirmed: ' + g_NumPaymentsWaitingToBeMined.toString());
				}
				
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
	claimNextPayment_promise: claimNextPayment_promise
}