// Javascript page support code for the create game view.

let errPrefix = 'create-game-page-support';

// Despite this being client side code, we reference this server side module
//  so that Browserify can put it into our bundle.
const solidity_helpers_misc = require('../../../common/solidity-helpers-misc');
const ebbDetails = require('../../../common/contract-details').EtherBandBattlesManager_details;
const web3_helpers = require('../misc/web3-helpers');
const common_routines = require('../../../common/common-routines');
const AppEventTracker = require('../ethereum/ethereum-transaction-tracker').AppEventTrackerManager;
const AppObject = require('../app-object').AppObject;
const youtubeSupport = require('../../../common/youtube-api-support').YouTubeSupport;
const reconstitute_lib = require('../game-objects/reconstituteGameObjects');
const web3utils_lib = require('web3-utils');

// const wait_for_ethereum_blocks = require('../../../process/wait-for-ethereum-blocks.js')
const GameDetails = require('../game-objects/game-details').GameDetails;
const GameDetailsConstants = require('../game-objects/game-details').GameDetailsConstants;
const UserDetails = require('../game-objects/user-details').UserDetails;
const UserDetailsConstants = require('../game-objects/user-details').UserDetailsConstants;
const VideoBookmarkDetails = require('../game-objects/video-bookmark-details').VideoBookmarkDetails;

const EnumValidateMeTypes = require('../misc/validation').EnumValidateMeTypes;
// const isValidValidateMeType = require('../misc/validation').isValidValidateMeType;

// URLS to the API.
const urlGetGameDetailApi = 'get-game-object-api';
const urlPrepareForEnterGameApi = 'prepare-for-enter-game-api';
const urlPrepareForGamePaymentApi = 'prepare-for-game-payment-api';
const urlSetEthereumPublicAddressApi = 'set-ethereum-public-address-api';
const urlStartGameApi = 'start-game-api';
const urlSubmitVideoLocationChoiceApi = 'submit-choice-api';
const urlWaitForGameCreationApi = 'wait-for-game-creation-api';
const urlWaitForEntryFeeConfirmationApi = 'wait-for-entry-fee-confirmation-api';

// The value we use ofr the app event ID when one is not required because
//  we don't take any follow-up action on the client side when any Ethereum
//  transactions the server might track or create as part of the relevant
//  operation.
const NO_APP_EVENT_ID_REQUIRED = '(none)';

// Browserify friendly include of Web3 module.
// const Web3 = require('web3');

// const localWeb3 = new Web3(Web3.currentProvider);
// const localWeb3 = new Web3(Web3.givenProvider);

// The Web3 provider URL should have been given to us by the server.
//if (!g_AppConfig.web3_provider_url)
//throw new error(errPrefix + 'The Web3 web provider URL is not set.');
// const localWeb3 = new Web3(g_AppConfig.web3_provider_url);

// Last video player state in case an operation needs to restore it after pausing the video, etc.
let g_LastVideoPlayerState = null;

// Public address just for test purposes.
let g_EthereumTestAddress = "0x72002BE46ECDe9747896D63524e42B87ee15642e";

// When the user marks a video location during game play, that value will be put here.
let g_VideoLocationChosen = 0;

// If TRUE, then we are configured for handling an enter game request, otherwise it's a
//  create game request.
let g_IsEnterGameFlagSet = false;

let g_EthTransSentTimerSecs = 0;
let g_ethTransSentTimerInterval = null;

// The URL arguments that were passed to this web page.
let g_urlArgs = null;

/**
 * This function returns TRUE if we do have at this time a game details object in the
 * 	global app object and that object has a non-empty ID field.
 *
 * @return {boolean}
 */
function isGlobalGameIdAvailableYet() {
	if (!global.appObject.gameDetailsObj)
		return false;
		
	if (misc_shared_lib.isEmptySafeString(global.appObject.gameDetailsObj.id))
		return false;
		
	return true;
}

/**
 * Stops the Ethereum transaction sent timer.
 */
function clearEthTransSentTimer() {
	clearInterval(g_ethTransSentTimerInterval);
	
	// Hide the timer.
	$('#page-title-timer-div').hide();
}

/**
 * Shows the countdown timer next to the page title and starts the timer.
 *
 * @param {number} numSecs - Number of seconds to start the countdown with.
 */
function startEthTransSentTimer(numSecs = 60) {
	if (numSecs < 1)
		throw new Error(errPrefix + 'The number of seconds to countdown is invalid: ' + numSecs);
		
	g_EthTransSentTimerSecs = numSecs;
	
	$('#page-title-timer-div').removeClass('hidden');
	$('#page-title-timer-div').show();
	
	// Start the timer.
	g_ethTransSentTimerInterval = setInterval(
		() =>
		{
			g_EthTransSentTimerSecs--;
			
			if (g_EthTransSentTimerSecs < 1)
				clearEthTransSentTimer();
				
			$('#page-title-timer-div').text('-> ' + g_EthTransSentTimerSecs + ' seconds...');
			
			
		}, 1000);
}

/**
 * This function should be called before every smart contract method call done on
 * 	the client side.  It checks to see if the Metamask is currently connected to the
 * 	Ethereum network the server desires.  As a side effect, if Metamask is currently
 * 	connected to the wrong network, it presents an alert to the user to fix the
 * 	problem and retry the operation.
 *
 * @param {number} currentEthNetworkId - The Ethereum network ID reported by Metamask
 * 	as being the one it is currently connected  to.
 * @param {string} currentOperation - A short helpful phrase to add to the alert
 * 	box message that describes the smart contract method/operation that is being attempted.
 *
 * @return {boolean} - Returns TRUE if Metamask is connected to the Ethereum network
 * 	the server desires.  FALSE if not.
 */
function checkSelectedEthereumNetwork(currentEthNetworkId, currentOperation)
{
	let errPrefix = '(checkSelectedEthereumNetwork) ';
	
	if (!currentEthNetworkId)
		throw new Error(errPrefix + 'The current Ethereum network ID is not set.');
		
	if (currentEthNetworkId != g_AppConfig.ethereum_network_id)
	{
		let currentEthNetworkName = solidity_helpers_misc.ethereumNetworkIdToString(currentEthNetworkId);
		let desiredEthNetworkName = solidity_helpers_misc.ethereumNetworkIdToString(g_AppConfig.ethereum_network_id);
		
		alert(
			"Metamask is currently connected to the "
			+ currentEthNetworkName
			+ " network.  Please activate Metamask and switch to the "
			+ desiredEthNetworkName
			+ " network, exit, and then try "
			+ currentOperation
			+ " again.");
			
		return false;
	}
	
	// Metamask is currently connected to the desired Ethereum network.
	return true;
}
/**
 * Navigate to the search for videos page.
 */
function doNavigateToVideoSearchPage()
{
	var currentUrl = new URL(document.location.href).origin;
	var searchForVideosUrl = new URL('./search-for-videos', currentUrl);
	
	if (g_IsEnterGameFlagSet) {
		// ----------------- ENTER GAME MODE -------------------
		
		// We must have a game ID if we are in enter game mode.
		if (!g_urlArgs[AuxGameConstants.URL_ARG_GAME_ID])
		{
			alert('The game ID is missing.  Please contact the system administrator.');
			return;
		}
		
		// Pass the game ID to the search for videos page as a URL argument so it can pass it back to us.
		searchForVideosUrl.searchParams.set(AuxGameConstants.URL_ARG_GAME_ID, g_urlArgs[AuxGameConstants.URL_ARG_GAME_ID])
		searchForVideosUrl.searchParams.set(AuxGameConstants.URL_ARG_ENTER_GAME, 'true');
	}
	else {
		// ----------------- CREATE GAME MODE -------------------
		
		// We may not have a game details object yet if it's a brand new game.
		if (isGlobalGameIdAvailableYet())
			// We have obtained a global game ID at this point. Pass it to the search for videos page
			//  as a URL argument so it can pass it back to us.
			searchForVideosUrl.searchParams.set(AuxGameConstants.URL_ARG_GAME_ID, global.appObject.gameDetailsObj.id);
	}

	window.location.href = searchForVideosUrl.href;
}

/**
 * This method returns a promise that submits the user's choice for the video location they marked
 * 	during game play.
 *
 * @param {Object} youTubeVideoDetails - The details for the YouTube video currently
 * 	loaded in the player.
 *
 * @return {Promise}
 */
function doSubmitVideoLocationChoice_promise(youTubeVideoDetails)
{
	var errPrefix = '(doSubmitVideoLocationChoice_promise) ';
	
	return new Promise(function(resolve, reject) {
		try
		{
			if (!youTubeVideoDetails)
				throw new Error(errPrefix + 'The YouTube video details are unassigned.');
				
			var currentUserObj = global.appObject.getCurrentUserObj();
			var gameDetailsObj = global.appObject.gameDetailsObj;
		
			// Build a new video bookmark.
			var newVideoBookmark = new VideoBookmarkDetails();
			
			newVideoBookmark.gameId = global.appObject.gameDetailsObj.id;
			newVideoBookmark.videoId = youtubeSupport.youtubePlayer.videoId;
			newVideoBookmark.videoTitle = youTubeVideoDetails.title;
			newVideoBookmark.userId = currentUserObj.id;
			newVideoBookmark.startPoint = g_VideoLocationChosen;
			newVideoBookmark.comment = 'Video location chosen by ' + currentUserObj.screenName;
			
			// Validate it.
			newVideoBookmark.validateMe();
			
			let postParamsObj = {};
			
			postParamsObj.game_details_obj = gameDetailsObj;
			postParamsObj.user_details_obj = currentUserObj;
			postParamsObj.video_bookmark_details_obj = newVideoBookmark;
			postParamsObj.app_event_id = NO_APP_EVENT_ID_REQUIRED;
			
			// ----------------------------- API: client side game payment made ---------------------
			
			// Ask the server to submit the desired video choice.
			let xhrRequest = xhrPost_promise(urlSubmitVideoLocationChoiceApi, postParamsObj);
			
			xhrRequest
			.then(function(progressEvent) {
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				if (checkServerReturnForError(urlSubmitVideoLocationChoiceApi, result))
					// Reject the promise with the error message.  The operation failed.
					reject(result.message);
				
				// Update the global game details object with the modified one. TRUE means do not
				//  validate the object after reconstituting it because we are building it
				//  right now.
				let updatedGameDetailsObj =
					reconstitute_lib.reconstituteGameDetailsObject(result.game_details_obj, EnumValidateMeTypes.ADVANCED_VALIDATION);
					
				// Store the updated game details object where everyone can find it.
				global.appObject.gameDetailsObj = updatedGameDetailsObj;
				
				// Update all form elements that show the game details in read-only form.
				global.appObject.updateGameDetailsElements();


			})
			.catch(function(err) {
				// Stop the timer.
				clearEthTransSentTimer();
				
				console.error(errPrefix + err.message + "  - promise");
				
				reject(err);
			})
		}
		catch (err)
		{
			// Stop the timer.
			clearEthTransSentTimer();
			
			alert(err.message);
			console.error(errPrefix + err.message + "  - try block");
		}
	});
}

/**
 *
 * This is the generic method that rebuilds an object of a certain type from a plain
 * 	JSON Object returned by the server.
 *
 * @param {Object} response - The object returned by a call to the server.
 * @param {string} operationDesc - A simple description of the operation.  Used for
 * 	logging purposes.
 * @param objOfType - The type name of the object to create.  It must have a parameterless
 * 	constructor.
 * @param {string} propName - The name of the property in the server response object that
 * 	contains the object in plain JSON format.
  * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object. The default is advanced validation.  See the EnumValidateMeTypes enumeration for details.
 **/
function recoverObjectFromServerResponse(response, operationDesc, objOfType, propName, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION) {
	let methodName = 'recoverGameDetailsObjFromServerResponse'; 
	let errPrefix = '(' + methodName + ') ';
	
	if (typeof response == 'undefined' || response == null)
		throw new Error(errPrefix + ' The response object is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(operationDesc))
		throw new Error(errPrefix + ' The operation description is empty.');
		
	if (misc_shared_lib.isEmptySafeString(propName))
		throw new Error(errPrefix + ' The property name is empty.');

	// Check for an error response.
	if (response.hasOwnProperty('error') && misc_shared_lib.isTrueOrStrTrue(response.error))
	{
		let errMsg = operationDesc + ' failed, please contact the server administrator.';
		'Invalid response from server during ' + operationDesc + ', please contact the server administrator.'
		
		throw new Error(errPrefix + errMsg);
	}
	
	if (!response.hasOwnProperty(propName))
	{
		let errMsg = 'Invalid response from server during ' + operationDesc + ', please contact the server administrator.'
		alert(errMsg);
		throw new Error(errPrefix + errMsg);
	}
	
	// If the operation succeeded the server will return the update game object.
	let plainJsonObj = response[propName];
	
	return reconstitute_lib.reconstituteObjectOfType(methodName, plainJsonObj, objOfType, validationType);
}

/**
 * This method recovers a game details object passed back from the server
 * 	in plain JSON object format, if the API call that generated that response
 * 	returns one.
 *
 * @param {Object} response - The JSON object returned from the server in response
 * 	to an API request on our part.
 * @param {string} operationDesc - The operation type that was attempted.  Used
 * 	for building error messages.
 *
 * @return {Object} - A validated Game Details object or an error message
 * 	will be thrown if a problem occurred.  A suitable error message will be
 * 	shown to the user too in some cases.
 */
function recoverGameDetailsObjFromServerResponse(response, operationDesc)
{
	var errPrefix = '(recoverGameDetailsObjFromServerResponse) ';
	
	return recoverObjectFromServerResponse(response, operationDesc, GameDetails, GameDetailsConstants.PROP_NAME_GAME_DETAILS_OBJECT);
}

/**
 * This method recovers a user details object passed back from the server
 * 	in plain JSON object format, if the API call that generated that response
 * 	returns one.
 *
 * @param {Object} response - The JSON object returned from the server in response
 * 	to an API request on our part.
 * @param {string} operationDesc - The operation type that was attempted.  Used
 * 	for building error messages.
 *
 * @return {Object} - A validated User Details object or an error message
 * 	will be thrown if a problem occurred.  A suitable error message will be
 * 	shown to the user too in some cases.
 */
function recoverUserDetailsObjFromServerResponse(response, operationDesc)
{
	var errPrefix = '(recoverUserDetailsObjFromServerResponse) ';
	
	return recoverObjectFromServerResponse(response, operationDesc, UserDetails, UserDetailsConstants.PROP_NAME_USER_DETAILS_OBJECT);
}

/**
 * Saves the current game details to the user's cookie storage.
 *
 * @param {Object} gameDetailObj - The game details to save.
 */
function saveGameDetails(gameDetailObj)
{
	var errPrefix = '(' + arguments.callee.name + ') ';

	if (typeof gameDetailObj != 'object')
		throw new Error(errPrefix + 'Invalid game details object.');

    setCookieValue(GameDetailsConstants.PROP_NAME_GAME_DETAILS_OBJECT, JSON.stringify(gameDetailObj));
}

/**
 * Restore the most recently used game details found in the user's cookie
 *  store if any.
 */
function restoreGameDetails()
{
	var strGameDetailsObj = getCookieValue(GameDetailsConstants.PROP_NAME_GAME_DETAILS_OBJECT);
	
	if (!goog.string.isEmptySafe(strGameDetailsObj) && strGameDetailsObj != "null")
	{
		var bandDonationPercentageSlider = $("input.band-donation-percentage-slider").slider();

		var gameDetailsObj = JSON.parse(strGameDetailsObj);
		
		// Reload the input fields from the game details object.
		$('#game-title-input').val(gameDetailsObj.titleForGame);
		$('#entry-fee-input').val(gameDetailsObj.entryFee);
		// $('#ethereum-public-address-input').val(gameDetailsObj.gameCreatorEthereumPublicAddress);
		bandDonationPercentageSlider.slider('setValue', gameDetailsObj.bandDonationPercentage);
		// $('#band-donation-percentage-input').val(gameDetailsObj.bandDonationPercentage);
		$('#game-title-input').val(gameDetailsObj.titleForGame);
		$('#chat-room-name-input').val(gameDetailsObj.screenName);
	}
}

/**
 * Saves the current user details to the user's cookie storage.
 *
 * @param {Object} userDetailsObj - The user details to save.
 */
function saveUserDetails(userDetailsObj)
{
	var errPrefix = '(saveUserDetails) ';

	if (typeof userDetailsObj != 'object')
		throw new Error(errPrefix + 'Invalid user details object.');

    setCookieValue('user_details_obj', JSON.stringify(userDetailsObj));
}

/**
 * Restore the most recently used user details found in the user's cookie
 *  store if any.
 */
function restoreUserDetails()
{
	var strUserDetailsObj = getCookieValue('user_details_obj');
	
	if (!goog.string.isEmptySafe(strUserDetailsObj) && strUserDetailsObj != "null")
	{
		var userDetailsObj = JSON.parse(strUserDetailsObj);
		
		// Reload the input fields from the user details object.
		// $('.user-ethereum-public-address').val(userDetailsObj.ethereumPublicAddress);
		$('.screen-name').val(userDetailsObj.screenName);

		// Do not load the video found in the user details object if there already is a
		//  video in the player, otherwise we will override the video that may have
		//  been passed to us via the video search page.
		if (goog.string.isEmptySafe(youtubeSupport.youtubePlayer.videoId))
		{
			// Nothing in the player.  Use what we found in storage.
			youtubeSupport.youtubePlayer.load(userDetailsObj.videoIdSubmitted, false);
		}
	}
}

/**
 * Returns a promise that triggers a Metamask payment for the user to pay for
 * 	the creation of the current game and then executes that Ethereum
 * 	transaction on the Ethereum network.
 *
 * NOTE: This client side method executes the EtherBandBattlesManger makeGame()
 * 	smart contract method.  That does not happen on the server.
 *
 * @param {Object} gameDetailsObj - A valid game details object.
 * @param {Object} userDetailsObj - A valid user object.
 *
 * @return {Promise} - The result of the promise if successful is the
 * 	updated game details object.
 *
 */
function doPayForGame_promise(gameDetailsObj, userDetailsObj)
{
	var errPrefix = '(doPayForGame_promise) ';
	
	return new Promise(function(resolve, reject)
	{
		try {
			// Clear the online user's list or we will get duplicate users.
			global.appObject.clearOnlineUsersList();
			
			// We recreate the Web3 object with each interaction, in case the user changed networks
			//  via Metamask.
			// let localWeb3 = new Web3(Web3.givenProvider);
			
			// Make sure the Web3.js object has been defined and get a
			//  reference to the local Web3 provider.
			let localWeb3 = web3_helpers.web3AndMetamaskCheck();
			
			if (typeof gameDetailsObj == 'undefined' || gameDetailsObj == null)
				throw new Error(errPrefix + 'The game details object is unassigned.');
	
			if (typeof userDetailsObj == 'undefined' || userDetailsObj == null)
				throw new Error(errPrefix + 'The current user details object is unassigned.');
				
			// FALSE means don't check the fields we don't have values for yet because we
			//  haven't created them yet.
			gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
			userDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
				
			// --------------- BEGIN: Variables needed across THEN blocks -----------
			
			// The modified game details object returned by the server when we call the
			//  API method that prepares a game details object for a Metamask transaction.
			let updatedGameDetailsObj = null;
			let updateduserDetailsObj = null;
			let aryAccounts = null;
			let accountBalance = 0;
			let callMakeGame = null;
			let entryFeeAsWei = null;
			let usePublicAddr = null;
			let estimatedGas = 0;
			let txHashForGameCreationPaymentObj = null;
			
			// --------------- END  : Variables needed across THEN blocks -----------
			
			// Initialize PubNub using the given game details object and user details object.
			//  We must do this now since we rely on the PubNub to receive Ethereum transaction
			//  confirmations from the server.
			global.appObject.pubnubClient.initializePubNub(gameDetailsObj, userDetailsObj);

			localWeb3.eth.getAccounts()
			.then(function (result)
			{
				aryAccounts = result;
				
				if (common_routines.isArrayAndNotEmpty(aryAccounts))
				{
					// Get the account balance.
					return localWeb3.eth.getBalance(aryAccounts[0]);
				}
				else
				{
					console.log("The JSON RPC response to our accounts query was not an array: ");
					console.log(aryAccounts);
					console.log("Is the target Ethereum network running and are you using the correct URL and HTTP/HTTPS protocol? (e.g. - Ganache)");
					throw new Error(
						errPrefix
						+ "Invalid Ethereum accounts array found.\n\nPlease activate Metamask and make sure you are\nlogged in and have selected your desired payment account");
				}
			})
			.then(function(result)
			{
				accountBalance = result;
				
				// Get the current network ID.
				return localWeb3.eth.net.getId();
			})
			.then(function(result) {
				result = solidity_helpers_misc.conformEthereumNetworkId(errPrefix, result);
				
				// Check to see if Metamask is connected to the Ethereum network the server desires.
				if (!checkSelectedEthereumNetwork(result, 'creating the game'))
					// No it's not.  Abort the operation.
					throw new Error(errPrefix + 'Metamask is currently connected to the wrong network.');
					
				// Update the game details object.
				gameDetailsObj.ethereumNetworkId = result;
			
				console.log("Network ID returned = " + gameDetailsObj.ethereumNetworkId );
				
				let postParamsObj = {};
				postParamsObj.game_details_obj = gameDetailsObj;
				
				// ----------------------------- API: client side game payment made ---------------------
				
				// Ask the server to create a game object for the game we just paid for.  This call
				//  gets us the request nonce we need to execute the EtherBandBattlesManager->makeGame()
				//  call.
				let xhrRequest = xhrPost_promise(urlPrepareForGamePaymentApi, postParamsObj);
				
				return xhrRequest;
			})
			.then(function(progressEvent) {
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				if (checkServerReturnForError(urlPrepareForGamePaymentApi, result))
					// Reject the promise with the error message.  The operation failed.
					reject(result.message);
				
				// Update the global game details object with the modified one. TRUE means do not
				//  validate the object after reconstituting it because we are building it
				//  right now.
				let serverResponseGameDetailsObj =
					reconstitute_lib.reconstituteGameDetailsObject(result.game_details_obj, EnumValidateMeTypes.SIMPLE_VALIDATION);
				
				// Have to convert the entry fee to a string in case it is a decimal point number.
				//  toWei() does not accept decimal point numbers.
				let entryFeeAsStr = serverResponseGameDetailsObj.entryFee.toString();
				
				// Make the call.  We use the entry fee as the value we are sending with the transaction.
				entryFeeAsWei = web3utils_lib.toWei(entryFeeAsStr, 'ether');
				
				// Build the Web3.js send request that will trigger a Metamask session to pay
				//  for the makeGame() game creation smart contract method.
				let contractInstance =
					ebbDetails.getContractInstance_client_side(
						localWeb3,
						serverResponseGameDetailsObj);
						
				// Same for the video ID.
				let videoIdSubmittedCompatible =
					localWeb3.utils.fromAscii(userDetailsObj.videoIdSubmitted);
					
				// Use the first public address in the accounts list since that is the one
				//  we will use when submitting the transaction to Metamask.
				usePublicAddr = aryAccounts[0];
				
				if (misc_shared_lib.isEmptySafeString(usePublicAddr))
					throw new Error(errPrefix + "The public address for the default account is empty.");
					
				let videoPlatformId = solidity_helpers_misc.EnumVideoPlatforms.YOUTUBE;
				
				// throw new Error('The game creator and house public address variables are not implemented yet.');
				
				// --------------------------------- ETHEREUM CALL: makeGame() ----------------------------
				
				// Always YouTube videos for now.
				callMakeGame = contractInstance.methods.makeGame(
					serverResponseGameDetailsObj.requestNonceFormatted,
					entryFeeAsWei,
					serverResponseGameDetailsObj.bandDonationPercentage,
					usePublicAddr,
					videoIdSubmittedCompatible,
					videoPlatformId);

				// Keep the updated game details object variable updated.
				updatedGameDetailsObj = serverResponseGameDetailsObj;
			
				// Estimate gas usage for the transaction.
				return callMakeGame.estimateGas({ from: usePublicAddr, gasPrice: 20000000000, gas: 1500000, value: entryFeeAsWei });
			})
			.then(function(result) {
				if (result <= 0)
					throw new Error(errPrefix + "The estimated gas for the transaction is zero or less.");
				
				// The result contains the estimated gas required to send the transaction
				//  on the current Ethereum network.  Pass the value by our fixer function
				//  for that value.
				estimatedGas = solidity_helpers_misc.fixEstimatedGas('make game', updatedGameDetailsObj.ethereumNetworkId, result);
				
				// Show and start the Ethereum transaction countdown timer.
				startEthTransSentTimer();
			
				// -------------------- METAMASK: Pay for game creation ------------------
				
				// Execute the Ethereum transaction to have a new game made.
				return callMakeGame.send({ from: usePublicAddr, gasPrice: 20000000000, gas: estimatedGas, value: entryFeeAsWei});
			})
			.then(function(result) {
				// The result should be the transaction hash returned by Metamask for the
				//  payment transaction for the creation of a new game.
				console.log('Transaction hash from Metamask for game creation payment: ' + result);
				
				txHashForGameCreationPaymentObj = result;
				
				// Stop the timer.
				clearEthTransSentTimer();
				
				// Tell the server about the user's public address.
				let postParamsObj = {};
				
				// We use the game ID for the Ethereum public address group ID.
				postParamsObj.group_id = updatedGameDetailsObj.id;
				postParamsObj.owner_id = userDetailsObj.id;
				postParamsObj.ethereum_public_address = usePublicAddr;
				
				// ----------------------------- API: set ethereum public address (game creator) ---------------------
				
				// Tell the server the Ethereum public address we have for the game creator.
				let xhrRequest = xhrPost_promise(urlSetEthereumPublicAddressApi, postParamsObj);
				
				return xhrRequest;
			})
			.then(function(progressEvent) {
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				if (checkServerReturnForError(urlSetEthereumPublicAddressApi, result))
					// Reject the promise with the error message.  The operation failed.
					reject(result.message);
				
				/*
				let serverResponseGameDetailsObj =
					reconstitute_lib.reconstituteGameDetailsObject(result.game_details_obj, true);
				
				// Keep the updated game details object updated.
				updatedGameDetailsObj = serverResponseGameDetailsObj;
				
				// Validate the user details object with advanced field validation.
				userDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION););
				
				// Save the validated, updated game details object to the global instance
				// 	of that object so we update the app with the latest game details
				// 	object contents. Store the updated game details object where
				//  everyone can find it.
				global.appObject.gameDetailsObj = updatedGameDetailsObj;
				*/
				
				// Add the user to the online users list.
				global.appObject.currentUserId = userDetailsObj.uuid;
				global.appObject.listOnlineUsers.addUser(userDetailsObj);
				global.appObject.rebuildOnlineUsersList();
				
				// The Ethereum transaction that requests the creation of a new
				//	game has been submitted to the Ethereum network successfully.
				// 	Create an Ethereum transaction tracking object to track it.
				//
				// We don't want to show the waiting for players DIV until we have received
				//  notification that the new game Ethereum transaction has been mined.  This
				//  is to prevent the game creator from seeing and sending out the invite link
				//  to other player to join the game.  Until the new game transaction has been
				//  mined, there is no contract/game for those players to join!
				//
				// Instead, we register a promise to do that operation with the Ethereum
				//  transaction tracker. Create a promise that will show the waiting for
				// 	players DIV, hiding all others, and set the page title appropriately.
				
				// Register our app event tracker with the object that manages those.
				let appEventId =
					AppEventTracker.addSimpleFuncAsTransToBeTracked(
						function(appEventResult) {
							appEventResult.validateMe();
							
							// The smart contract's game ID for the game recently created should be in the app event result
							//  object's custom data object.
							if (!appEventResult.customDataObj.hasOwnProperty('id_in_smart_contract'))
								throw new Error(errPrefix + 'The app event result object is missing the game ID the smart contract assigned to our game.');
								
							let idInSmartContract = misc_shared_lib.parseIntOrNull(appEventResult.customDataObj.id_in_smart_contract);
							
							if (!idInSmartContract)
								// The string in the result field is not a valid integer
								throw new Error(errPrefix + 'The result field in the Ethereum transaction result object does not contain a valid integer.');
								
							if (idInSmartContract < 1)
								// Game IDs are never 0 or negative.  See the smart contract for further details.
								throw new Error(errPrefix + 'The game ID found in the Ethereum transaction result object is invalid: ' + idInSmartContract + '.');
								
							// Store the game ID In the game details object.
							updatedGameDetailsObj.idInSmartContract = idInSmartContract;
							
							console.log('Game ID for our game in the smart contract is: ' + idInSmartContract);
			
							console.log('The transaction to create a new game has been confirmed as having succeeded.');
							global.appObject.showFormEntryHostDiv('form-waiting-for-players-host-div');
							global.appObject.setPageTitle('Waiting for Players');
						});
				
				// Now it's time to wait for the Ethereum network to confirm our
				//  new game creation transaction.  The server will notify us
				//  via a PubNub broadcast when that happens (or it times out).
				// return doWaitForGameCreation_promise(global.appObject.gameDetailsObj, userDetailsObj, appEventId);
				let postParamsObj =
					{
						game_details_obj: updatedGameDetailsObj,
						user_details_obj: userDetailsObj,
						app_event_id: appEventId,
						metamask_tx_hash_obj: txHashForGameCreationPaymentObj
					};
				
				// ----------------------------- API: wait for game creation ---------------------
				
				// Ask the server to add an Ethereum transaction lifecycle object for the Ethereum transaction
				//  we just submitted to the Ethereum network.
				return xhrPost_promise(urlWaitForGameCreationApi, postParamsObj);
			})
			.then(function(progressEvent) {
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				// Generic return handling.
				if (checkServerReturnForError(urlWaitForGameCreationApi, result))
					// Reject the promise with the error message.  The operation failed.
					reject(result.message);
					
				// Update the global game details object with the modified one.
				updatedGameDetailsObj =
					reconstitute_lib.reconstituteGameDetailsObject(result.game_details_obj, EnumValidateMeTypes.SIMPLE_VALIDATION);
				
				// Store the updated game details object where everyone can find it.
				global.appObject.gameDetailsObj = updatedGameDetailsObj;
				
				// Update the global user details object with the modified one.
				updateduserDetailsObj =
					reconstitute_lib.reconstituteUserDetailsObject( result.user_details_obj, EnumValidateMeTypes.SIMPLE_VALIDATION);
					
				// Store the updated user details object where everyone can find it.
				global.appObject.userDetailsObj = updateduserDetailsObj;
				
				// Update all form elements that show the game details in read-only form.
				global.appObject.updateGameDetailsElements();

				// Let the player new we are waiting for the Ethereum network to confirm our
				//  transaction to create a new game.
				global.appObject.setPageTitle('Waiting for confirmation that the new game has been created.');
				
				// Done.  Now we wait for the Ethereum transaction we just submitted to the
				//  Ethereum network to be mined. We resolve the promise with a simple TRUE
				//  response.
				resolve(true);
				
			})
			.catch(function(err) {
				// Stop the timer.
				clearEthTransSentTimer();
				
				console.error(errPrefix + err.message + "  - promise");
				
				reject(err);
			})
		}
		catch (err)
		{
			// Stop the timer.
			clearEthTransSentTimer();
			
			alert(err.message);
			console.error(errPrefix + err.message + "  - try block");
		}
	});
}


/**
 * Returns a promise that triggers a Metamask payment for the user to pay for
 * 	entering an existing game and then executes that Ethereum transaction on
 * 	the Ethereum network.
 *
 * NOTE: This client side method executes the EtherBandBattlesManager makeGame()
 * 	smart contract method.  That does not happen on the server.
 *
 * @param {Object} gameDetailsObj - A valid game details object.
 * @param {Object} userDetailsObj - A valid user object.
 * @param {string} appEventId - The transaction ID assigned to the
 * 	Ethereum transaction we submitted to make a new game.
 *
 * @return {Promise} - The result of the promise if successful is the
 * 	updated game details object.
 */
function doPayEntryFee_promise(gameDetailsObj, userDetailsObj)
{
	var errPrefix = '(doPayEntryFee_promise) ';
	
	return new Promise(function(resolve, reject)
	{
		try {
			// Clear the online user's list or we will get duplicate users.
			global.appObject.clearOnlineUsersList();

			// We recreate the Web3 object with each interaction, in case the user changed networks
			//  via Metamask.
			// let localWeb3 = new Web3(Web3.givenProvider);
			
			// Make sure the Web3.js object has been defined and get a
			//  reference to the local Web3 provider.
			let localWeb3 = web3_helpers.web3AndMetamaskCheck();
			
			if (typeof gameDetailsObj == 'undefined' || gameDetailsObj == null)
				throw new Error(errPrefix + 'The game details object is unassigned.');
	
			if (typeof userDetailsObj == 'undefined' || userDetailsObj == null)
				throw new Error(errPrefix + 'The current user details object is unassigned.');
				
			// FALSE means don't check the fields we don't have values for yet because we
			//  haven't created them yet.
			gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
			userDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
			
			// --------------- BEGIN: Variables needed across THEN blocks -----------
			
			// The modified game details object returned by the server when we call the
			//  API method that prepares a game details object for a Metamask transaction.
			let aryAccounts = null;
			let accountBalance = 0;
			let callAddPlayer = null;
			let entryFeeAsWei = null;
			let usePublicAddr = null;
			let estimatedGas = 0;
			let contractInstance = null;
			let txHashForPayEntryFee = null;
			
			// --------------- END  : Variables needed across THEN blocks -----------
			
			let postParamsObj = {
				game_details_obj: gameDetailsObj,
				user_details_obj: userDetailsObj
			}
			
			// First check to see if the video selected by the user trying to enter the
			//  game has already been entered by another player (duplicate video check).
			xhrPost_promise(urlPrepareForEnterGameApi, postParamsObj)
			.then(function(progressEvent) {
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				if (!result)
					throw new Error(errPrefix + "The result from the server to our duplicate video check was unassigned.");
				
				if (result.is_error)
					throw new Error(result.message);
				
				console.log(result.message);
				
				// Initialize PubNub using the given game details object and user details object.
				//  We must do this now since we rely on the PubNub to receive Ethereum transaction
				//  confirmations from the server.
				global.appObject.pubnubClient.initializePubNub(gameDetailsObj, userDetailsObj);
	
				return localWeb3.eth.getAccounts();
			})
			.then(function (result)
			{
				aryAccounts = result;
				
				if (common_routines.isArrayAndNotEmpty(aryAccounts))
				{
					// Use the first public address in the accounts list since that is the one
					//  we will use when submitting the transaction to Metamask.
					usePublicAddr = aryAccounts[0];
					
					if (misc_shared_lib.isEmptySafeString(usePublicAddr))
						throw new Error(errPrefix + "The public address for the default account is empty.");
					
					// Get the account balance.
					return localWeb3.eth.getBalance(usePublicAddr);
				}
				else
				{
					console.log("The JSON RPC response to our accounts query was not an array: ");
					console.log(aryAccounts);
					console.log("Is the target Ethereum network running and are you using the correct URL and HTTP/HTTPS protocol? (e.g. - Ganache)");
					throw new Error(
						errPrefix
						+ "Invalid Ethereum accounts array.\n\nPlease activate Metamask and make sure you are\nlogged in and have selected your desired payment account");
				}
			})
			.then(function(result)
			{
				accountBalance = result;
				
				// Get the current network ID.
				return localWeb3.eth.net.getId();
			})
			.then(function(result) {
				result = solidity_helpers_misc.conformEthereumNetworkId(errPrefix, result);
				
				// Check to see if Metamask is connected to the Ethereum network the server desires.
				if (!checkSelectedEthereumNetwork(result, 'entering the game'))
					// No it's not.  Abort the operation.
					throw new Error(errPrefix + 'Metamask is currently connected to the wrong network.');
					
				// Update the game details object.
				gameDetailsObj.ethereumNetworkId = result;
			
				console.log("Network ID returned = " + gameDetailsObj.ethereumNetworkId );
				
				// Tell the server about the user's public address.
				let postParamsObj = {};
				
				// We use the game ID for the Ethereum public address group ID.
				postParamsObj.group_id = gameDetailsObj.id;
				postParamsObj.owner_id = userDetailsObj.id;
				postParamsObj.ethereum_public_address = usePublicAddr;
				
				// ----------------------------- API: set ethereum public address (game creator) ---------------------
				
				// Tell the server the Ethereum public address we have for the game creator.
				let xhrRequest = xhrPost_promise(urlSetEthereumPublicAddressApi, postParamsObj);
				
				return xhrRequest;
			})
			.then(function(progressEvent) {
				// ---------------------- ESTIMATE THE GAS NEEDED FOR THE ETHEREUM TRANSACTION ---------
				
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				if (checkServerReturnForError(urlSetEthereumPublicAddressApi, result))
					// Reject the promise with the error message.  The operation failed.
					reject(result.message);

				// Have to convert the entry fee to a string in case it is a decimal point number.
				//  toWei() does not accept decimal point numbers.
				let entryFeeAsStr = gameDetailsObj.entryFee.toString();
				
				// Make the call.  We use the entry fee as the value we are sending with the transaction.
				entryFeeAsWei = web3utils_lib.toWei(entryFeeAsStr, 'ether');
				
				// Build the Web3.js send request that will trigger a Metamask session to pay
				//  for the makeGame() game creation smart contract method.
				contractInstance =
					ebbDetails.getContractInstance_client_side(
						localWeb3,
						gameDetailsObj);
						
				// Same for the video ID.
				let videoIdSubmittedCompatible =
					localWeb3.utils.fromAscii(userDetailsObj.videoIdSubmitted);
					
				let postParamsObj = {};
				postParamsObj.game_details_obj = gameDetailsObj;
				
				// Build the call to call the addPlayer() method of the smart contract.
				callAddPlayer = contractInstance.methods.addPlayer(
					gameDetailsObj.idInSmartContract,
					usePublicAddr,
					videoIdSubmittedCompatible);
					
				// TODO: Comment out this line when debugging is finished.
				// return 1500000;
			
				// Estimate gas usage for the transaction.
				return callAddPlayer.estimateGas({ from: usePublicAddr, gasPrice: 20000000000, gas: 1500000, value: entryFeeAsWei });
			})
			.then(function(result) {
				if (!goog.isNumber(result))
					throw new Error(errPrefix + "The result returned from estimateGas() is not a number.");
					
				if (result <= 0)
					throw new Error(errPrefix + "The estimated gas for the transaction is zero.");
					
				// The result contains the estimated gas required to send the transaction
				//  on the current Ethereum network.  Pass the value by our fixer function
				//  for that value.
				estimatedGas = solidity_helpers_misc.fixEstimatedGas('add player', gameDetailsObj.ethereumNetworkId, result);
				
				// Show and start the Ethereum transaction countdown timer.
				startEthTransSentTimer();
				
				// Execute the Ethereum transaction to add a new player.
				return callAddPlayer.send({ from: usePublicAddr, gasPrice: 20000000000, gas: estimatedGas, value: entryFeeAsWei});
			})
			.then(function(result) {
				// The result should be the transaction hash returned by Metamask for the
				//  payment transaction for the payment of the entry fee by the current user.
				console.log('Transaction hash from Metamask for entry fee payment: ' + result);
				
				txHashForPayEntryFee = result;

				// The Ethereum transaction that requests the adding of a new player
				// 	game has been submitted to the Ethereum network successfully.
				// 	Create an Ethereum transaction tracking object to track it.
				//
				// Now we register a promise to do the necessary post payment
				// 	confirmation operations with the Ethereum transaction tracker.
				
				// Register our Ethereum transaction tracker with the object that manages those.
				let appEventId =
					AppEventTracker.addSimpleFuncAsTransToBeTracked(
						function(appEventResult) {
							appEventResult.validateMe();
							
							// The game ID should be in the app event result
							//  object's custom data object.
							if (!appEventResult.customDataObj.hasOwnProperty('user_details_obj'))
								throw new Error(errPrefix + 'The app event result object is missing the updated user details object for the new player just added.');
							
							let updatedUserDetailsObj =
								reconstitute_lib.reconstituteUserDetailsObject( appEventResult.customDataObj.user_details_obj);
								
							if (!updatedUserDetailsObj.isEntryFeePaidAndConfirmed)
								throw new Error(errPrefix + 'Received entry payment transaction confirmation, but the user is still not considered as having made a valid entry fee payment.');
								
							// TODO: Update the user details object with the one we just received.  Note, this
							//  may already be happening when the in the PubNub client side code when
							//  a user update broadcast is sent, if one is being sent.
							
							// We don't do much here when we receive confirmation of the Ethereum payment for
							//  the entry fee because the real work happens in response to the PubNub
							//  broadcast that tells everyone the current user has paid their entry fee
							//  and that the payment has been confirmed.
							console.log(">>>>> Confirmation of our add player request transaction successfully received with result :");
							console.log(appEventResult.customDataObj);
							
							// Stop the timer.
							clearEthTransSentTimer();
							
							// Show the waiting for players quadrant.
							global.appObject.showFormEntryHostDiv('form-waiting-for-players-host-div');
							global.appObject.setPageTitle('Waiting for Players');
						});
					
				// Now it's time to wait for the Ethereum network to confirm our
				//  add player transaction.  The server will notify us
				//  via a PubNub broadcast when that happens (or it times out).
				let postParamsObj = {
					game_details_obj: gameDetailsObj,
					user_details_obj: userDetailsObj,
					app_event_id: appEventId,
					metamask_tx_hash_obj: txHashForPayEntryFee
				};

				// Ask the server to start checking for confirmation of our add player call.
				let xhrRequest = xhrPost_promise(urlWaitForEntryFeeConfirmationApi, postParamsObj);
				
				return xhrRequest;
			})
			.then(function(progressEvent) {
				// Pull out the response object from the decorated XMLHttpRequest response.
				let response = progressEvent.currentTarget.response;
				
				if (response.error)
					throw new Error(errPrefix + 'The server returned an error response.');
					
				if (!response.game_details_obj)
					throw new Error(errPrefix + 'Missing game details object from the server response.');
				
				let operationDesc = 'pay game entry fee';
				
				// If the operation succeeded the server will return the game details
				// 	object that was created by the game creator.
				let returnedGameDetailsObj = recoverGameDetailsObjFromServerResponse(response, operationDesc);
				returnedGameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
				
				let returnedUserDetailsObj = recoverUserDetailsObjFromServerResponse(response, operationDesc);
				returnedUserDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
				
				// Store the game details and user object where everyone can find it.
				global.appObject.gameDetailsObj = returnedGameDetailsObj;
				global.appObject.userDetailsObj = returnedUserDetailsObj;
				global.appObject.currentUserId = returnedUserDetailsObj.uuid;
				
				// Update all form elements that show the game details in read-only form.
				global.appObject.updateGameDetailsElements();

				// Add the updated user to the online user list.
				global.appObject.listOnlineUsers.addUser(returnedUserDetailsObj);
				// Rebuild the online user's list list box.
				global.appObject.rebuildOnlineUsersList();
				
				// Resolve the promise with a simple TRUE value.
				resolve(true);
			})
			/*
			.then(function(ignoreResult) {
				// We need to tell the server the user's public address now that we have it.
				let postParamsObj = {
					game_details_obj: gameDetailsObj,
					user_details_obj: userDetailsObj,
					??? WHAT TO DO ABOUT TRACKING HERE ??? HOW DOES THIS MESH WITH THE TRACKING DONE FROM THE CODE THAT CALLS THIS METHOD ???
					app_event_id: appEventId
				};

				// Ask the server to start checking for confirmation of our add player call.  It will
				//  notify us via PubNub when that transaction has been confirmed/mined or failed.
				let xhrRequest = xhrPost_promise('wait-for-entry-fee-confirmation-api', postParamsObj);
				
				return xhrRequest;
				
			} )
			.then(function(result) {
				console.log(result);
				
				// Stop the timer.
				clearEthTransSentTimer();
				
				// Let the player new we are waiting for the Ethereum network to confirm our
				//  transaction to create a new game.
				global.appObject.setPageTitle('Waiting for entry fee payment confirmation.');
				
				// We resolve the promise with the updated user details object.
				resolve(userDetailsObj);
			})
			*/
			.catch(function(err) {
				// Stop the timer.
				clearEthTransSentTimer();
				
				console.error(errPrefix + err.message + "  - promise");
				
				reject(err);
			})
		}
		catch (err)
		{
			// Stop the timer.
			clearEthTransSentTimer();
			
			console.error(errPrefix + err.message + "  - try block");
			alert(err.message);
		}
	});
}

/**
 * Tell the server we want to start the game.
 *
 * @param {Object} gameDetailsObj - A valid game details object.
 * @param {Object} userDetailsObj - A valid user object.
 *
 * @return {Promise} - The result of the promise if successful is the
 * 	updated game details object.
 *
 */
 
function doStartGame_promise(gameDetailsObj, userDetailsObj)
{
	var errPrefix = '(doStartGame_promise) ';
	
	return new Promise(function(resolve, reject)
	{
		try {
			
			if (!gameDetailsObj)
				throw new Error(errPrefix + ' The game details object is unassigned.');
			// Advanced validation of the game details object.
			gameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
			
			if (!userDetailsObj)
				throw new Error(errPrefix + ' The user details object is unassigned.');
			// Advanced validation of the user details object.
			userDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
			
			var postParamsObj =
			{
				gameId: gameDetailsObj.id,
				userId: userDetailsObj.id,
				// We don't need to take any follow-up actions so we pass in the
				//  dummy Ethereum transaction ID that tells the PubNub client
				//  side code not to look for one when we receive notification that
				//  thw start game transaction has been mined/confirmed.
				app_event_id: "(none)"
			};
	
			// ----------------------------- API: start game ---------------------
			
			// Ask the server to start the game.
			return xhrPost_promise(urlStartGameApi, postParamsObj)
			.then(function(progressEvent) {
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				// Generic return handling.
				if (checkServerReturnForError(urlStartGameApi, result))
					// Reject the promise with the error message.  The operation failed.
					reject(result.message);
				
				// Done.  We do not wait for the start game transaction to be mined because
				//  we don't want to hold up game play.  At this time, we don't do any
				//  follow-up client side actions when the transaction is confirmed/mined.
				resolve(true);
			})
			.catch(function(err) {
				// Stop the timer.
				clearEthTransSentTimer();
				
				console.error(errPrefix + err.message + "  - promise");
				
				reject(err);
			})
		}
		catch (err)
		{
			// Stop the timer.
			clearEthTransSentTimer();
			
			alert(err.message);
			console.error(errPrefix + err.message + "  - try block");
		}
	});
}



/**
 * Initialize the linked video sink slider.
 *
 */
function initializeLinkedVideoSinkSlider() {

	// Create the linked video seek slider.
	var linkedVideoSeekPercentageSlider = $("input.linked-seek-slider").slider();
	
	// Linked video seek slider.
	$('#linked-seek-slider-input').slider({
		formatter: function(currentSliderValue) {
			// Update attached value label.
			$('#linked-seek-slider-input-label').text(currentSliderValue + '%');
			
			// Tooltip value for slider.
			return 'Current value: ' + currentSliderValue;
		}
	});
	
	// Event that fires when a slider stops moving.
	$('#linked-seek-slider-input').on('slideStop', function(ev){
		let currentSliderValue = ev.value;
		let durationSecs = youtubeSupport.youtubePlayer.getDuration();
		let currentVideoId = youtubeSupport.youtubePlayer.videoId;
		
		let calculatedOffsetInSecs = (currentSliderValue * durationSecs) / 100;
		
		// Broadcast our new location over PubNub so other players can sync
		//  with us.
		global.appObject.pubnubClient.publishLinkedVideoSeekMessage(currentVideoId, calculatedOffsetInSecs, currentSliderValue);
	});
	
	// Linked video seek slider.
	$('#linked-2-seek-slider-input').slider({
		formatter: function(currentSliderValue) {
			// Update attached value label.
			$('#linked-2-seek-slider-input-label').text(currentSliderValue + '%');
			
			// Tooltip value for slider.
			return 'Current value: ' + currentSliderValue;
		}
	});
	
	// Event that fires when a slider stops moving.
	$('#linked-2-seek-slider-input').on('slideStop', function(ev){
		let currentSliderValue = ev.value;
		let durationSecs = youtubeSupport.youtubePlayer.getDuration();
		let currentVideoId = youtubeSupport.youtubePlayer.videoId;
		
		let calculatedOffsetInSecs = (currentSliderValue * durationSecs) / 100;
		
		// Broadcast our new location over PubNub so other players can sync
		//  with us.
		global.appObject.pubnubClient.publishLinkedVideoSeekMessage(currentVideoId, calculatedOffsetInSecs, currentSliderValue);
	});
	
}

/**
 * This method initialize the form elements for the enter game page.
 */
function initializeEnterGamePage()
{
	var errPrefix = '(initializeEnterGamePage) ';
	
	global.appObject.setPageTitle('Enter Game');
	
	if (typeof g_urlArgs == 'undefined' || g_urlArgs ==  null)
		throw new Error(errPrefix + 'The URL arguments parameter is unassigned.');
		
	// We must have a game ID, which should have been part of the invite link.
	var gameId = null;
	
	if (g_urlArgs.hasOwnProperty(AuxGameConstants.URL_ARG_GAME_ID))
	{
		gameId = g_urlArgs[AuxGameConstants.URL_ARG_GAME_ID];
		
		console.log(errPrefix + 'GAMEID: received with invite link -> ' + gameId);
	}
		
	var userDetailsObj = null;
	
	if (misc_shared_lib.isEmptySafeString(gameId))
	{
		var errMsg = 'Invalid or missing invite link.  Please contact the game creator for a new one.';
		alert(errMsg);
		throw new Error(errPrefix + errMsg);
	}
	
	initializeLinkedVideoSinkSlider();

	// The ENTER GAME button.
	$('#ge-enter-game-btn').click(
		function(e)
		{
			// Make sure the app global game details object is valid.
			if (!global.appObject.gameDetailsObj)
				throw new Error(errPrefix + 'The global game details object is unassigned.');
				
			global.appObject.gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
		
			// Validate the values.
			var videoId = youtubeSupport.youtubePlayer.videoId;
			
			if (misc_shared_lib.isEmptySafeString(videoId))
			{
				// TODO: Disable the create game button until a video has been selected.
				alert('Please select a video first.');
				return;
			}
			
			// Need to make sure the video details are available first.
			youtubeSupport.getCurrentVideoDetails_promise(videoId)
			.then(function(videoDetails)
			{
				// Create a new user object.
				userDetailsObj = new UserDetails();
				
				userDetailsObj.screenName = $('#ge-chat-room-name-input').val();
				userDetailsObj.gameId = global.appObject.gameDetailsObj.id;
				userDetailsObj.videoIdSubmitted = youtubeSupport.youtubePlayer.videoId;
				userDetailsObj.videoTitleSubmitted = videoDetails.title;
				
				console.log(
					errPrefix + 'Calling dPayEntryFee_promise() with the game ID field of the user details object set to -> ' + userDetailsObj.gameId);
				
				// Have the user pay the entry fee.
				return doPayEntryFee_promise(global.appObject.gameDetailsObj, userDetailsObj);
			})
			.then(result => {
				
				// The result should be a simple TRUE response.
				if (typeof result != 'boolean')
					throw new Error(errPrefix + 'The result object returned after we paid to enter the game is not a boolean value.');
				
				if (result !== true)
					throw new Error(errPrefix + 'doPayEntryFee_promise() did not return TRUE .');
					
				// Save the current game details in the cookie store.
				saveUserDetails(global.appObject.userDetailsObj);
				
				// Move on to the next step in the chain.
				return(true);
			})
			/* Move to doPayEntryFee_promise() method.
			.then(function(result) {
				// The Ethereum transaction that requests the adding of a new player
				// 	game has been submitted to the Ethereum network successfully.
				// 	Create an Ethereum transaction tracking object to track it.
				//
				// Now we register a promise to do the necessary post payment
				// 	confirmation operations with the Ethereum transaction tracker.
				
				// Register our Ethereum transaction tracker with the object that manages those.
				let appEventId =
					AppEventTracker.addSimpleFuncAsTransToBeTracked(
						function(ethTransResult) {
							// The game ID should be in the result field.
							if (!ethTransResult.ethereumResult)
								throw new Error(errPrefix + 'The Ethereum transaction result object is missing the result field.');
								
							// Reconstitute the user object from the one passed to us in the auxObj field.
							if (!ethTransResult.auxObj)
								throw new Error(errPrefix + 'The auxObj field in the Ethereum transaction result object is missing the updated user object field.');
							
							let updatedUserDetailsObj =
								reconstitute_lib.reconstituteUserDetailsObject( ethTransResult.auxObj);
								
							if (!updatedUserDetailsObj.isEntryFeePaidAndConfirmed)
								throw new Error(errPrefix + 'Received entry payment transaction confirmation, but the user is still not considered as having made a valid entry fee payment.');
								
							// TODO: Update the user details object with the one we just received.  Note, this
							//  may already be happening when the in the PubNub client side code when
							//  a user update broadcast is sent, if one is being sent.
							
							// We don't do much here when we receive confirmation of the Ethereum payment for
							//  the entry fee because the real work happens in response to the PubNub
							//  broadcast that tells everyone the current user has paid their entry fee
							//  and that the payment has been confirmed.
							console.log(">>>>> Confirmation of our add player request transaction successfully received with result :");
							console.log(ethTransResult.ethereumResult);
							
							// Show the waiting for players quadrant.
							global.appObject.showFormEntryHostDiv('form-waiting-for-players-host-div');
							global.appObject.setPageTitle('Waiting for Players');
						});
					
				// Now it's time to wait for the Ethereum network to confirm our
				//  add player transaction.  The server will notify us
				//  via a PubNub broadcast when that happens (or it times out).
				let postParamsObj = {
					game_id_in_smart_contract: global.appObject.gameDetailsObj.idInSmartContract,
					user_details_obj: userDetailsObj,
					app_event_id: appEventId
				};

				// Ask the server to start checking for confirmation of our add player call.
				let xhrRequest = xhrPost_promise('wait-for-entry-fee-confirmation-api', postParamsObj);
				
				return xhrRequest;
			})
			.then(function(progressEvent) {
				// Pull out the result object from the decorated XMLHttpRequest response.
				let result = progressEvent.currentTarget.response;
				
				if (result.error)
					throw new Error(errPrefix + 'The server returned an error result.');
					
				if (!result.game_details_obj)
					throw new Error(errPrefix + 'Missing game details object from the server result.');
			})
			*/
			.finally (function(){
				// Save the current user details in the cookie store.
				saveUserDetails(userDetailsObj);
			})
			.catch(function(err)
			{
				// Validation failed.  Show the user the error message.
				alert(err.message);
				return;
			});
		});
		
	// The SELECT VIDEO button.
	$('#ge-select-video-button').click(
		function (e)
		{
			// Pause the video.
			if (youtubeSupport.youtubePlayer)
			{
				// Save the current video state.
				g_LastVideoPlayerState = youtubeSupport.youtubePlayer.getState();
				
				// Pause the video in case it is playing.
				youtubeSupport.youtubePlayer.pause();
			}
		
			// Jump to video search page.
			doNavigateToVideoSearchPage();
		});
		
	// Show the correct form quadrant content.
	global.appObject.showFormEntryHostDiv('form-guest-entry-host-div');
	
	// ---------------------------- MAIN BODY -----------------
	
	// Fire off the request for the game details object from the game server.
	try	{
		// ----------------------------- API: Get game details object ---------------------
		
		let postParamsObj = { game_id: gameId };
			
		let gameDetailsObj = null;
		
		// Ask the server to return the game details object for the game ID we were passed.
		let xhrRequest = xhrPost_promise(urlGetGameDetailApi, postParamsObj);
		
		xhrRequest
		.then(function(progressEvent) {
			// Pull out the response object from the decorated XMLHttpRequest response.
			let response = progressEvent.currentTarget.response;
			
			if (checkServerReturnForError(urlPrepareForGamePaymentApi, response))
				// Reject the promise with the error message.  The operation failed.
				throw new Error(errPrefix + response.message);
				
			gameDetailsObj = recoverGameDetailsObjFromServerResponse(response, urlGetGameDetailApi);
			
			// Validate it with advanced validation.
			gameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
			
			// Store the game details object where everyone can find it.
			global.appObject.gameDetailsObj = gameDetailsObj;
			
			// Update all form elements that show the game details in read-only form.
			global.appObject.updateGameDetailsElements();
			
			// Show the enter game DIV, hide all others.
			global.appObject.showFormEntryHostDiv('form-guest-entry-host-div');
		})
		.catch(err => {
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);
				
			console.error(errMsg);
			
			throw new Error(errPrefix + errMsg + ' - promise');
		});
	}
	catch(err) {
		// Convert the error to a promise rejection.
		let errMsg =
			errPrefix + conformErrorObjectMsg(err);
			
		console.error(errMsg);
		
		throw new Error(errPrefix + errMsg + ' - try/catch');
	}
	
	// Hide all elements that belong only to the game creator.
	$('.game-creator').hide();
}

/**
 * This method initialize the form elements for the create game page.
 *
 */
function initializeCreateGamePage()
{
	var errPrefix = '(initializeCreateGamePage) ';
	
	global.appObject.setPageTitle('Create a New Game');

	if (typeof g_urlArgs == 'undefined' || g_urlArgs ==  null)
		throw new Error(errPrefix + 'The URL arguments parameter is unassigned.');
		
	// Default entry fee and game title.
	$('#entry-fee-input').val('0.003');
	$('#game-title-input').val('New EtherBandBattles game.');

	
	// Create the band donation percentage slider.
	var bandDonationPercentageSlider = $("input.band-donation-percentage-slider").slider();

	// Set up event handlers.
	//
	// Band donation percentage slider.
	$('#band-donation-percentage-input').slider({
		formatter: function(currentSliderValue) {
			// Update attached value label.
			$('#band-donation-percentage-input-label').text(currentSliderValue + '%');
			
			// Tooltip value for slider.
			return 'Current value: ' + currentSliderValue;
		}
	});
	
	initializeLinkedVideoSinkSlider();
	
	// The CREATE GAME button.
	$('#create-game-btn').click(
		function(e)
		{
			var gameDetailsObj = null;
			var userDetailsObj = null;
			
			// Validate the values.
			var videoId = youtubeSupport.youtubePlayer.videoId;
			
			if (misc_shared_lib.isEmptySafeString(videoId))
			{
				// TODO: Disable the create game button until a video has been selected.
				alert('Please select a video first.');
				return;
			}

			// Need to make sure the video details are available first.
			youtubeSupport.getCurrentVideoDetails_promise(videoId)
			.then(function(videoDetails)
			{
				// Create a user object for the game creator.
				userDetailsObj = new UserDetails();
				
				// Set the flag that identifies this user as the game creator.
				userDetailsObj.isGameCreator = true;
				
				userDetailsObj.screenName = $('#chat-room-name-input').val();
				userDetailsObj.videoIdSubmitted = youtubeSupport.youtubePlayer.videoId;
				userDetailsObj.videoTitleSubmitted = videoDetails.title;
				
				// Don't validate the user until we get the game ID.
			
				// Create a game details object for the game.
				gameDetailsObj = new GameDetails();
				
				// Assign the game ID to the user object.
				userDetailsObj.gameId = gameDetailsObj.id;
				
				// We do not validate yet because we don't get the user's public address
				//  until the Metamask payment transaction to create the game succeeds.
				// userDetailsObj.validateMe();
				
				// Store the user ID of the game creator.
				gameDetailsObj.gameCreatorUuid = userDetailsObj.uuid;
			
				// Build a game details object from the user's current inputs.
				gameDetailsObj.titleForGame = $('#game-title-input').val();
				gameDetailsObj.entryFee = $('#entry-fee-input').val();
				gameDetailsObj.bandDonationPercentage = bandDonationPercentageSlider.slider('getValue');
				
				// The game creator needs to pay for the game creation first.
				return doPayForGame_promise(gameDetailsObj, userDetailsObj);
			})
			.then(function(result) {
				// The result should be a simple TRUE response.
				if (typeof result != 'boolean')
					throw new Error(errPrefix + 'The result object returned after we paid for the game is not a boolean value.');
				
				if (result !== true)
					throw new Error(errPrefix + 'doPayForGame_promise() did not return TRUE .');
			})
			.finally (function(){
				// Always save the game and user detail objects to local storage so the user
				//  doesn't have to re-enter that information in case they leave the page
				//  before successfully creating a game.
				
				// Save the current game details in the cookie store.
				saveGameDetails(gameDetailsObj);
				
				// Save the current user details in the cookie store.
				saveUserDetails(userDetailsObj);
			})
			.catch(function(err)
			{
				// Validation failed.  Show the user the error message.
				let errMsg = err.message;
				
				if (typeof err == 'string')
					errMsg = err;
					
				alert(errMsg);
				return;
			});
		});
		
	// The START GAME button.
	$('#wfp-start-game-button').click(
		function(e)
		{
			
			try {
				doStartGame_promise(global.appObject.gameDetailsObj, global.appObject.userDetailsObj)
				.then(result =>
			    {
			    	if (result !== true)
			    		console.error('The result of the start game API call was not true.');
				
			    })
			.catch(function(err) {
				console.error(errPrefix + err.message + "  - promise");
			})
		}
		catch (err)
		{
			console.error(errPrefix + err.message + "  - try block");
		}
	});
		
	// The SELECT VIDEO button.
	$('#select-video-button').click(
		function (e)
		{
			// Pause the video.
			if (youtubeSupport.youtubePlayer)
			{
				// Save the current video state.
				g_LastVideoPlayerState = youtubeSupport.youtubePlayer.getState();
				
				// Pause the video in case it is playing.
				youtubeSupport.youtubePlayer.pause();
			}
		
			// Jump to video search page.
			doNavigateToVideoSearchPage();
		});
	
	// Show the correct form quadrant content.
	global.appObject.showFormEntryHostDiv('form-game-creation-host-div');
	
	// Show all form elements that belong only to the game creator.
	$('.game-creator').show();
}

// ---------------------- DOCUMENT READY FUNCTION ------------------------
// JQuery document ready handler.
$(document).ready(function (){
	// Initialize the app and create the application object.
	global.appObject = new AppObject();
	
	// If we don't have the "enter_game" URL argument set, then the page
	//  should be configured for game creation, not entry.
	g_urlArgs = getUrlArguments();
	
	// TODO: Remove this!
	$('#chat-room-name-input').val('Robert');
	
	// Send chat message button.
	$('#send-chat-btn').click(
		function(e)
		{
			var messageText = $('#chat-message-input').val();
			
			if (messageText.length > 0)
			{
				// Publish the chat message.
				global.appObject.pubnubClient.publishChatMessage(messageText);
			}
		});
		
	// The copy to clipboard handler for any such buttons.
	$('.copy-to-clipboard').click(
		function(e)
		{
			// Get the ID of the source for text for the clipboard copy operation from
			//  the data attributes of the target.
			var srcTextId = $('#' + e.target.id).data('clipboard-source');
			
			if (misc_shared_lib.isEmptySafeString(srcTextId))
			{
				console.warn('Could not find a source text element ID for the clipboard copy operation');
				return;
			}
			
			copyToClipboard(srcTextId);
		});
		
	// ------------------- PLAYING GAME: Buttons ----------------
	
	$('#ge-mark-location-button').click(
		function(e){
			// Copy the current video time into the span that shows that value.
			var currentSeconds = youtubeSupport.youtubePlayer.getCurrentTime();
			var strTime = misc_shared_lib.secondsToHoursMinutesSecondsString(currentSeconds);
			$('#marked-video-location-span').text(strTime);
			
			g_VideoLocationChosen = currentSeconds;
		});
		
	$('#ge-submit-choice-button').click(
		function(e){
			var videoId = youtubeSupport.youtubePlayer.videoId;
			
			if (misc_shared_lib.isEmptySafeString(videoId))
				throw new Error('The YouTube player does not have a video ID assigned to it.');
				
			if (g_VideoLocationChosen < 0)
				throw new Error('The chosen video location is invalid.');
				
			// Need to make sure the video details are available first.
			youtubeSupport.getCurrentVideoDetails_promise(videoId)
			.then(function(videoDetails)
			{
				// Change the title.
				global.appObject.setPageTitle("VIDEO LOCATION CHOICE CONFIRMED!")
				
				// Disable the mark location and submit choice buttons until the next
				//  round of play.
				disableButton($('.choose-loc'));
				
				return doSubmitVideoLocationChoice_promise(videoDetails);
			});
		});
		
	$('#pick-video-select').change(function()
	{
		// If the video ID selected from the drop-down box does not match the one currently
		//  loaded in the player, publish a load-video message so everybody's players load
		//  this video.
		let afterPartyVideoId = $('#pick-video-select option:selected').val();
		
		if (!misc_shared_lib.isEmptySafeString(afterPartyVideoId))
		{
			// Broadcast our new video selection over PubNub so other players can sync
			//  with us.
			global.appObject.pubnubClient.publishLinkedVideoSeekMessage(afterPartyVideoId, 0, 0);
		}
	});
	
	// The user must have the Metamask extension.  If we can't find the Web3.js
	//  object, show the graphic that tells the user they don't have Metamask installed.
	if (typeof web3 == 'undefined' || web3 == null)
	{
		// Metamask/web3 was not found. Show the correct form quadrant content.
		global.appObject.showFormEntryHostDiv('form-metamask-not-found-host-div');
		return;
	}
	else
	{
		// Metamask/web3 was found.
		
		// Initialize the YouTube player.
		youtubeSupport.initializeYouTubePlayerAPI();
		
		if (g_urlArgs.hasOwnProperty(AuxGameConstants.URL_ARG_ENTER_GAME))
			g_IsEnterGameFlagSet = misc_shared_lib.isTrueOrStrTrue(g_urlArgs[AuxGameConstants.URL_ARG_ENTER_GAME]);
		
		if (g_IsEnterGameFlagSet)
			// Configure the form quadrant for a user entering the game, which by definition
			//  is not the game creator.
			initializeEnterGamePage(g_urlArgs);
		else
			// Configure the form quadrant for game creation by the game creator..
			initializeCreateGamePage(g_urlArgs);
			
		// If we were given a video ID in the URL arguments, auto-load that video.
		if (g_urlArgs.hasOwnProperty(AuxGameConstants.URL_ARG_VIDEO_ID))
		{
			var videoId = g_urlArgs[AuxGameConstants.URL_ARG_VIDEO_ID];
			
			if (!misc_shared_lib.isEmptySafeString(videoId))
				youtubeSupport.youtubePlayer.load(videoId, false);
		}
	
		// Reload the most recently used project values.  We wait until the YouTube player
		//  is ready so restoreGameDetails() doesn't try to interact with the player
		//  before it is initialized.
		/* TODO: DISABLED FOR NOW
		restoreGameDetails();
		restoreUserDetails();
		*/
		
	}

	// Show a particular DIV when designing.
	// global.appObject.showFormEntryHostDiv('form-game-creation-host-div');
	// global.appObject.showFormEntryHostDiv('form-waiting-for-players-host-div');
	// global.appObject.showFormEntryHostDiv('form-guest-entry-host-div');
	// global.appObject.showFormEntryHostDiv('form-playing-game-host-div');
});