/**
 * This file contains the object that we use to store the current game details.
 */

const EnumValidateMeTypes = require('../misc/validation').EnumValidateMeTypes;
const isValidValidateMeType = require('../misc/validation').isValidValidateMeType;
const EnumGameState = require('../../../common/solidity-helpers-misc').EnumGameState;

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No. The needed routines should already be in the global namespace.
}
else
{
	// Yes.  Need to require some modules.
	var misc_shared_lib = require('../misc/misc-shared');
}

/** Handy object to hold some constants we use when interacting with game objects. */
var GameDetailsConstants = new function()
{
	/** The various states a game pass through in its lifetime.
	 *
	 * WARNING:  Make sure you update the _aryPhaseOrder array if this information changes!
	 *
	 * DELETED: This was a duplicate of the EnumGameState values
	this.GAME_PHASE_CREATED = 'created';
	this.GAME_PHASE_WAITING_FOR_PLAYERS = 'waiting for players';
	this.GAME_PHASE_PLAYING = 'playing';
	this.GAME_PHASE_COMPLETED = 'completed';
	*/
	
	/**
	 * The property name for the property that holds a game details object in any
	 * 	game detail objects we send/receive.
	 */
	this.PROP_NAME_GAME_DETAILS_OBJECT = 'game_details_obj';
	this.PROP_NAME_GAME_ID = 'gameId';
	this.PROP_NAME_CHANNEL_NAME = 'channelName';
	
	/**
	 * The different tasks the game master tells us to do.
	 */
	// The game master server is telling us that a newly created game is fully ready for playing.
	this.APP_EVENT_NEW_GAME_IS_READY = 'new game is ready';
	// The game master server is telling us to play the next round (next music video).
	this.APP_EVENT_PLAY_NEXT_ROUND = 'play next round';
	// The game master server is telling us the game is over.
	this.APP_EVENT_GAME_OVER = 'game over';
	// A new player was added to the game (which indicates implicitly that their
	//	entry fee has been paid.
	this.APP_EVENT_NEW_PLAYER_ADDED = 'new player added';
	
	// The game master server is telling us about the results of an Ethereum transaction.
	// this.TASK_ETHEREUM_TRANSACTION_RESULT = 'ethereum transaction result';
	
	/**
	 * The PubNub sender name of the server acting as game master.
	 */
	this.SENDER_NAME_GAMEMASTER = 'gamemaster';
}

/**
 * This function returns TRUE if the given PubNub sender name belongs to the
 * 	game master, FALSE if not.
 *
 * @param {String} senderName - The sender name to evaluate.
 *
 * @return {boolean} - Returns TRUE if it is the sender name belonging to the
 * 	game master, otherwise FALSE.
 */
function isSenderTheGameMaster(senderName)
{
	if (misc_shared_lib.isEmptySafeString(senderName))
		return false;
		
	return (senderName == GameDetailsConstants.SENDER_NAME_GAMEMASTER);
}

/**
 * Extracts the "message" property from a PubNub message event object.
 *
 * @param pubnubMessageEvent - A valid PubNub message event.
 *
 * @return {*}
 */
function extractMessageFromPubNubMessageEvent(pubnubMessageEvent) {
	let errPrefix = '(extractMessageFromPubNubMessageEvent) ';
	
	if (!pubnubMessageEvent)
		throw new Error(errPrefix + 'The PubNub message event is unassigned.');
	
	if (!pubnubMessageEvent.hasOwnProperty('message'))
		throw new Error(errPrefix + 'The PubNub message event is missing the "message" property.');
		
	return pubnubMessageEvent.message;
}

/**
 * Extracts the "payload" property from the "message" property belonging to
 *  a PubNub message event object.
 *
 * @param message - A valid PubNub message property value.
 *
 * @return {*}
 */
function extractPayloadFromMessage(message) {
	let errPrefix = '(extractPayloadFromMessage) ';
	
	if (!message)
		throw new Error(errPrefix + 'The message property is unassigned.');
	
	if (!message.hasOwnProperty('payload'))
		throw new Error(errPrefix + 'The message property is missing the "payload" property.');
		
	return message.payload;
}

/**
 * Extracts the custom data object property from the "payload" property belonging to the "message" property
 *  that belongs to a PubNub message event object.
 *
 * @param message - A valid PubNub payload property value.
 *
 * @return {*}
 */
function extractCustomDataObjFromPayload(payload) {
	let errPrefix = '(extractCustomDataObjFromPayload) ';

	if (!payload)
		throw new Error(errPrefix + 'The payload property is unassigned.');
		
	if (!payload.hasOwnProperty('customDataObj'))
		throw new Error(errPrefix + 'The payload does not have a customDataObj property.');
		
	let customDataObj = payload.customDataObj;
	
	if (!customDataObj)
		throw new Error(errPrefix + 'The custom data object is unassigned.');
		
	if (typeof customDataObj !== 'object')
		throw new Error(errPrefix + 'The value found in the custom data object is not an object.');
		
	return customDataObj;
}

/**
 * Extracts the "task" property from the "customDataObj" property belonging to
 *  the "payload" property that belongs to the  "message" property of a PubNub
 *  	message event object.
 *
 * @param message - A valid PubNub message property value.
 *
 * @return {*}
 */
 function extractTaskFromCustomDataObj(customDataObj) {
	let errPrefix = '(extractTaskFromPayload) ';
	
	if (!customDataObj)
		throw new Error(errPrefix + 'The custom data object is unassigned.');
		
	if (!customDataObj.hasOwnProperty('game_master_task'))
		throw new Error(errPrefix + 'The payload does not have a game_master_task property.');
		
	let task = customDataObj.game_master_task;
	
	if (misc_shared_lib.isEmptySafeString(task))
		throw new Error(errPrefix + 'The task is empty.');
		
	return task;
}

/**
 * Extracts the "customDataObj" property embedded in a PubNub message event object.
 *
 * @param message - A valid PubNub message property value.
 *
 * @return {*}
 */
 function extractCustomDataObjFromPubNubMessageEvent(pubnubMessageEvent) {
	let errPrefix = '(extractCustomDataObjFromPubNubMessageEvent) ';
	
	let message = extractMessageFromPubNubMessageEvent(pubnubMessageEvent);
	let payload = extractPayloadFromMessage(message);
	let customDataObj = extractCustomDataObjFromPayload(payload);
	
	return customDataObj;
}


/**
 * Extracts the task property from a PubNub message event with deep property
 * 	path checking along the way.
 *
 * @param pubNubMessageEvent - A Valid PubNub message event received from a
 * 	game master server PubNub broadcast.
 *
 * @return {*}
 */
function extractTaskFromPubNubMessageEvent(pubNubMessageEvent) {
	let errPrefix = '(extractTaskFromPubNubMessageEvent) ';
	
	let message = extractMessageFromPubNubMessageEvent(pubNubMessageEvent);
	let payload = extractPayloadFromMessage(message);
	let customDataObj = extractCustomDataObjFromPayload(payload);
	let task = extractTaskFromCustomDataObj(customDataObj);
	
	if (misc_shared_lib.isEmptySafeString(task))
		throw new Error(errPrefix + 'The game master task extracted from the PubNub message event is empty.');
		
	return task;
}


/**
 * Extracts the payload property from a PubNub message event with deep property
 * 	path checking along the way.
 *
 * @param pubNubMessageEvent - A Valid PubNub message event received from a
 * 	game master server PubNub broadcast.
 *
 * @return {*}
 */
function extractPayloadFromPubNubMessageEvent(pubNubMessageEvent) {
	let errPrefix = '(extractPayloadFromPubNubMessageEvent) ';
	
	let message = extractMessageFromPubNubMessageEvent(pubNubMessageEvent);
	let payload = extractPayloadFromMessage(message);
	
	if (!payload)
		throw new Error(errPrefix + 'The payload object is unassigned.');
		
	return payload;
}

/**
 * Extracts the game details object property from a PubNub message event with deep property
 * 	path checking along the way.
 *
 * @param pubNubMessageEvent - A Valid PubNub message event received from a
 * 	game master server PubNub broadcast.
 *
 * @return {*}
 */
function extractGameDetailsObjFromPubNubMessageEvent(pubnubMessageEvent) {
	let errPrefix = '(extractGameDetailsObjFromPubNubMessageEvent) ';
	let message = extractMessageFromPubNubMessageEvent(pubnubMessageEvent);
	
	if (!message.hasOwnProperty('game_details_object'))
		throw new Error(errPrefix + 'The message propoerty is missing a game details object property.');

	return message.game_details_object;
}

/**
 * This method takes a primitive game details object, and then
 * 	returns a full-fledged game details object.
 *
 * @param {Object} gameDetailsObj_primitive - The GameDetails object as primitive JSON object (not full class).
 *
 * @return {GameDetails} - A valid GameDetails object.
 */
function postDataToGameDetailsObject(gameDetailsObj_primitive)
{
	var errPrefix = '(postDataToGameDetailsObject) ';
	
	if (!gameDetailsObj_primitive)
		throw new Error(errPrefix + 'The game details primitive object is unassigned.');
	
	var newGameDetailsObj = new GameDetails();
	
	// Convert the plain Javascript object to a Game Details object.
	for (var prop in gameDetailsObj_primitive)
		newGameDetailsObj[prop] = gameDetailsObj_primitive[prop];
	
	return newGameDetailsObj;
}


/**
 * This method takes a JSON string, parses it into a GameDetails object, validates it, and then
 * 	returns it.
 *
 * @param {String} strJson - The GameDetails object in JSON format.
 *
 * @return {GameDetails} - A valid GameDetails object.
 */
function parseJsonStringToGameDetailsObject(strJson)
{
	var errPrefix = '(parseJsonStringToGameDetailsObject) ';
	
	if (misc_shared_lib.isEmptySafeString(strJson))
		throw new Error(errPrefix + 'The JSON string is empty.');
	
	var obj = JSON.parse(strJson);
	
	var newGameDetailsObj = new GameDetails();
	
	// Convert the plain Javascript object to a Game Details object.
	for (var prop in obj)
		newGameDetailsObj[prop] = obj[prop];
	
	return newGameDetailsObj;
}

/**
 * Call this method to validate the fields of a GameDetails object.
 *
 * @param {Object} objToValidate - The object to validate as a Game Details object.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.

 */
function validateGameDetailsObj(objToValidate, validationType)
{
	var errPrefix = '(validateGameDetailsObj) ';
	
	if (!isValidValidateMeType(validationType))
		throw new Error(errPrefix + 'The validation type is invalid: ' + validationType);
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.id))
		throw new Error(errPrefix + 'Please enter a valid ID for the game.');

	if (misc_shared_lib.isEmptySafeString(objToValidate.channelName))
		throw new Error(errPrefix + 'Please enter a channel name for the game.');

	if (misc_shared_lib.isEmptySafeString(objToValidate.titleForGame))
		throw new Error(errPrefix + 'Please enter a valid title for the game.');
	
	var minLengthForTitle = 5;
	
	if (objToValidate.titleForGame.length < minLengthForTitle)
		throw new Error(errPrefix + 'The title for the game is too short and must be at least ' + minLengthForTitle + ' characters in length.  Please enter a longer title.');
	
	// Conform the entry fee to a number.  If it is not, checkFieldForNumber()
	//  will throw the given error message.
	objToValidate.entryFee = misc_shared_lib.checkFieldForNumber(objToValidate.entryFee, 'Please enter a valid number for the entry fee.');
	
	if (objToValidate.entryFee <= 0)
		throw new Error(errPrefix + 'A negative value or zero value for the entry fee is invalid.');
	
	// Conform the band donation percentage to a number.  If it is not, checkFieldForNumber()
	//  will throw the given error message.
	objToValidate.bandDonationPercentage = misc_shared_lib.checkFieldForNumber(objToValidate.bandDonationPercentage, 'The band donation percentage must be a number between 0 and 100.');

	// Range check the band donation percentage to make sure it's between 0 and 100.
	if (objToValidate.bandDonationPercentage < 0)
		throw new Error(errPrefix + 'A negative value or zero value for the band donation percentage is invalid.');
	
	if (objToValidate.bandDonationPercentage > 100)
		throw new Error(errPrefix + 'The band donation percentage can not be greater than 100 percent.');
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.gameCreatorUuid))
		throw new Error(errPrefix + 'The game creator ID is empty.');
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.state))
		throw new Error(errPrefix + 'The game state is empty.');
		
	// These fields are validated only after certain advanced operations have been
	//  performed first.  See if they should be validated now.
	if (validationType == EnumValidateMeTypes.ADVANCED_VALIDATION) {
		// On the server side we use the globally defined contract address so we only do this check
		//  on the client side.  We check for the IS_NODE_JS environment variable to be TRUE to
		//  determine if we are running on the server.
		if (misc_shared_lib.isProcessGlobalVarPresent() && process.env.IS_NODE_JS == "true") {
			if (misc_shared_lib.isEmptySafeString(objToValidate.contractAddress))
				throw new Error(errPrefix + 'The EtherBandBattles smart contract address is empty.');
		}
	
		if (objToValidate.ethereumNetworkId <= 0)
			throw new Error(errPrefix + 'The Ethereum network ID is invalid.');
		
		if (misc_shared_lib.isEmptySafeString(objToValidate.requestNonce))
			throw new Error(errPrefix + 'The request nonce is empty.');
			
		if (misc_shared_lib.isEmptySafeString(objToValidate.requestNonceFormatted))
			throw new Error(errPrefix + 'The request nonce formatted for a smart contract method call is empty.');

		if (objToValidate.idInSmartContract < 1)
			throw new Error(errPrefix + 'The game ID on the smart contract side is invalid.');
	}
};


/**
 * This object holds the details for a particular game instance.
 *
 * @constructor
 */
function GameDetails()
{
	var errPrefix = "(GameDetails) ";
	
	var self = this;
	
	let baseId = misc_shared_lib.getSimplifiedUuid();
	
	/** @property {String} gameId - The game ID. */
	this.id = 'game_' + baseId;
	
	/** @property {String} The PubNub channel ID for this game. */
	this.channelName = 'channel_' + baseId;
	
	/** @property {String} titleForGame - The title chosen for the game by the game creator. */
	this.titleForGame = "";
	
	/** @property {Number} entryFee - The entry chosen for the game by the game creator. */
	this.entryFee = 0;
	
	/** @property {Number} bandDonationPercentage - The percentage of the proceeds that should go to the bands
	* whose music videos are part of this game. */
	this.bandDonationPercentage = 0;
	
	/** @property {String} gameCreatorUuid - The ID of the user that created this game. */
	this.gameCreatorUuid = "";
	
	// The initial game state is that of being created.
	/** @property {String} state - The current state the game is in. */
	this.state = EnumGameState.NOTSET;
	
	/** @property {String} videoIdCurrentlyPlaying - The video ID for the video that is currently playing (if any). */
	this.videoIdCurrentlyPlaying = "";
	
	/** @property {String} videoTitleCurrentlyPlaying - The title of the video that is currently playing (if any). */
	this.videoTitleCurrentlyPlaying = "";
	
	/** @property {String} requestNonce - The request nonce we used in the makeGame() call. */
	this.requestNonce = "";
	
	/** @property {String} requestNonceFormatted - The request nonce from the above field but
      * 	formatted for direct use with a smart contract method call. */
	this.requestNonceFormatted = "";
	
	/** @property {Number} ethereumNetworkId - the Ethereum network ID for the network the game will
	 * 	be hosted on.  This is determined on the client side by asking Metamask what network it is
	 * 	currently connected to.
	 */
	this.ethereumNetworkId = 0;

	/** @property {String} contractAddress - The address for the EtherBandBattles smart contract that
	 * 	the server has provided for us.  */
	this.contractAddress = null;
	
	/** @property {number} idInSmartContract - The game ID give to our game by the EtherBandBattles smart contract.
			It is not validated because we don't receive it until the Ethereum transaction that makes a new game
			is mined. */
	this.idInSmartContract = -1;

	// -------------------- NON-VALIDATED FIELDS -----------------------
	
	// The following fields are not inspected during a validation call.
	
	/** @property {Number} timeStampedByServer - When the record is added to Redis, the server
	 * 	will set this field to the current server time.
	 */
	this.timeStampedByServer = null;
	
	/** @property {Array} - As each round is played, the winners will accumulate in this field. */
	this.aryWinners = new Array();
	
	// -------------------- METHODS -----------------------

	/**
	 * Call this function to validate the current game details of this object. If
	 * 	any field is invalid, an error will be thrown with the validation
	 * 	problem stored in the error message property.
	 *
 	 * @param {string} validationType - The type of validation to perform.
 	 * 	See the EnumValidateMeTypes enumeration for details.
	 */
	this.validateMe = function(validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
	{
		return validateGameDetailsObj(self, validationType);
	};
	
}

// Use code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
	window.parseJsonStringToGameDetailsObject = parseJsonStringToGameDetailsObject,
	window.extractCustomDataObjFromPubNubMessageEvent = extractCustomDataObjFromPubNubMessageEvent,
	window.extractGameDetailsObjFromPubNubMessageEvent = extractGameDetailsObjFromPubNubMessageEvent,
	window.extractPayloadFromPubNubMessageEvent = extractPayloadFromPubNubMessageEvent,
	window.extractTaskFromPubNubMessageEvent = extractTaskFromPubNubMessageEvent,
	window.isSenderTheGameMaster = isSenderTheGameMaster,
    window.GameDetails = GameDetails;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			GameDetails: GameDetails,
			GameDetailsConstants: GameDetailsConstants,
			extractCustomDataObjFromPubNubMessageEvent: extractCustomDataObjFromPubNubMessageEvent,
			extractGameDetailsObjFromPubNubMessageEvent: extractGameDetailsObjFromPubNubMessageEvent,
			extractPayloadFromPubNubMessageEvent: extractPayloadFromPubNubMessageEvent,
			extractTaskFromPubNubMessageEvent: extractTaskFromPubNubMessageEvent,
			isSenderTheGameMaster: isSenderTheGameMaster,
			parseJsonStringToGameDetailsObject: parseJsonStringToGameDetailsObject,
			postDataToGameDetailsObject: postDataToGameDetailsObject
		};
}

