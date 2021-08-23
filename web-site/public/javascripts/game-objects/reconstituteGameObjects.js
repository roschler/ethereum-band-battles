/**
 * This file contains code that restores plain JSON objects to our game objects.
 */
 
 // const AppEventResult = require('./app-events').AppEventResult;
 
const misc_shared_lib = require('../misc/misc-shared');
const ethereum_payment_details_lib = require('./ethereum-payment-details');
const game_details_lib = require('./game-details');
const user_details_lib = require('./user-details');
const GameDetails = require('../game-objects/game-details').GameDetails;
const UserDetails = require('../game-objects/user-details').UserDetails;
const band_details_lib = require('./band-details');
const video_bookmark_details_lib = require('./video-bookmark-details');
const app_events_lib = require('./app-events');
const EnumValidateMeTypes = require('../misc/validation').EnumValidateMeTypes;
const isValidValidateMeType = require('../misc/validation').isValidValidateMeType;

/*
// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No. The needed routines should be in the global namespace.
}
else
{
	// Yes.  Need to require some modules.
	// var VideoBookmarkDetails = video_bookmark_details_lib.VideoBookmarkDetails;
}
*/

/**
 * Reconstitutes an object of a particular type stored in plain JSON object format
 * 	and validates it if it has a validateMe() method.
 *
 * @param {string} caller - A label describing the entity that is calling this method.
 * @param {Object} plainJsonObj - The object in plain JSON object format.
 * @param objOfType - The type name of the object to create.  It must have a parameterless
 * 	constructor.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.
 *
 * @return {*} - The reconstituted object in its original type.
 */
function reconstituteObjectOfType(caller, plainJsonObj, objOfType, validationType)
{
	let errPrefix = '(' + caller + ')';
	
	if (typeof caller != 'string')
		throw new Error(errPrefix + 'The caller parameter is not a string.');
	
	if (misc_shared_lib.isEmptySafeString(caller))
		throw new Error('(reconstituteObjectOfType) The caller parameter is empty.');
		
	if (typeof plainJsonObj == 'undefined' || plainJsonObj == null)
		throw new Error(errPrefix + 'The plain JSON object is undefined');
		
	if (typeof objOfType == 'undefined' || objOfType == null)
		throw new Error(errPrefix + 'The object of type parameter is undefined');
		
	if (!isValidValidateMeType(validationType))
		throw new Error(errPrefix + 'The validation type is invalid.');
		
	let reconstitutedObj = new objOfType();
	
	// Transfer all the plain JSON object properties to reconstitute the updated game details object.
	for (let prop in plainJsonObj)
		reconstitutedObj[prop] = plainJsonObj[prop];
		
	// Is validation of the reconstituted object required and does the reconstituted
	//  object have a validateMe() method?
	if (validationType == EnumValidateMeTypes.DO_NOT_VALIDATE) {
		// Do nothing.  Do not validate.
	}
	else  {
		if (!reconstitutedObj.hasOwnProperty('validateMe'))
			throw new Error(errPrefix + 'Validation is requested but the reconstituted object does not have a validateMe() method.');
		
		// Validate it.
		reconstitutedObj.validateMe(validationType);
	}
	
	return reconstitutedObj;
}

/**
 * Reconstitutes a game details object stored in plain JSON object format.
 *
 * @param {Object} plainJsonObj - The game details object in plain JSON object format.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.
 *
 * @return {GameDetails} - The reconstituted game details object.
 */
function reconstituteGameDetailsObject(plainJsonObj, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
{
	return reconstituteObjectOfType('reconstituteGameDetailsObject', plainJsonObj, GameDetails, validationType);
}

/**
 * Reconstitutes a payment details object stored in plain JSON object format.
 *
 * @param {Object} plainJsonObj - The payment details object in plain JSON object format.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.
 *
 * @return {EthereumPaymentDetails} - The reconstituted Ethereum payment details object.
 */
function reconstituteEthereumPaymentDetailsObject(plainJsonObj, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
{
	return reconstituteObjectOfType('reconstituteEthereumPaymentDetailsObject', plainJsonObj, ethereum_payment_details_lib.EthereumPaymentDetails, validationType);
}

/**
 * Reconstitutes an AppEventResult object stored in plain JSON object format.
 *
 * @param {Object} plainJsonObj - The app event details in plain JSON object format.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.
 *
 * @return {AppEventResult} - The reconstituted app event result object.
 */
function reconstituteAppEventResultObject(plainJsonObj, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
{
	return reconstituteObjectOfType('reconstituteAppEventResultObject', plainJsonObj, app_events_lib.AppEventResult, validationType);
}


/**
 * Reconstitutes a user details object stored in plain JSON object format.
 *
 * @param {Object} plainJsonObj - The user details object in plain JSON object format.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.
 *
 * @return {UserDetails} - The reconstituted user details object.
 */
function reconstituteUserDetailsObject(plainJsonObj, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
{
	return reconstituteObjectOfType('reconstituteUserDetailsObject', plainJsonObj, UserDetails, validationType);
}

/**
 * Reconstitutes a video bookmark details object stored in plain JSON object format.
 *
 * @param {Object} plainJsonObj - The video bookmark details object in plain JSON object format.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.
 *
 * @return {VideoBookmarkDetails} - The reconstituted video bookmark details object.
 */
function reconstituteVideoBookmarkDetailsObject(plainJsonObj, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
{
	return reconstituteObjectOfType(
		'reconstituteVideoBookmarkDetailsObject',
		plainJsonObj,
		video_bookmark_details_lib.VideoBookmarkDetails,
		validationType);
}

/**
 * This function takes the AppEventResult object in plain JSON object format received from a
 * 	PubNub MESSAGE event that is of the state-change category and returns an AppEventDetails
 * 	object built from its content.
 *
 * @param {Object} pubnubMessageEvent - A PubNub message event.
 *
 * @return {AppEventResult} - A full-fledged AppEventResult object.
 */
function recoverAppEventResultFromPubNubMessageEvent(pubnubMessageEvent)
{
	let errPrefix = '(recoverAppEventResultFromPubNubMessageEvent) ';

	// The payload of a PubNub message event containing an app event result should be
	//  an AppEventResultObject.
	let payload = game_details_lib.extractPayloadFromPubNubMessageEvent(pubnubMessageEvent);
	
	return reconstituteAppEventResultObject(payload);
}

/**
 * This function takes the user object in plain JSON object format received from a
 * 	PubNub STATUS event that is of the state-change category and returns a UserDetails
 * 	object built from its content.
 *
 * @param {Object} pubnubStatusEvent - A PubNub status event.
 *
 * @return {Object} - A full-fledged user details object.
 */
function recoverUserFromStatusEvent(pubnubStatusEvent)
{
	let errPrefix = '(recoverUserFromStatusEvent) ';

	// Validate the PubNub status event as being a state-change category event
	//  that carries one of our user objects.
	if (typeof pubnubStatusEvent == 'undefined' || pubnubStatusEvent == null)
		throw new Error(errPrefix + 'The PubNub status event object is unassigned.');
		
	if (!user_details_lib.isChatRoomUserObjInStateChange(pubnubStatusEvent))
		throw new Error(errPrefix + 'The PubNub status event object does not carry a valid chat room user object.');
	
	// Passed all checks.  Reconstitute the UserDetails object from the plain JSON object.
	let plainJsonObj = pubnubStatusEvent.state.user_details_object;
	let chatRoomUserObj = new UserDetails();
	
	// Convert the plain Javascript object to a Game Details object.
	for (let prop in plainJsonObj)
		chatRoomUserObj[prop] = plainJsonObj[prop];
	
	return chatRoomUserObj;
}

/**
 * This function takes the user object in plain JSON object format received from a
 * 	PubNub MESSAGE event that is of the state-change category and returns a UserDetails
 * 	object built from its content.
 *
 * @param {Object} pubnubMessageEvent - A PubNub message event.
 *
 * @return {Object} - A full-fledged UserDetails object.
 */
function recoverUserFromMessageEvent(pubnubMessageEvent)
{
	let errPrefix = '(recoverUserFromMessageEvent) ';

	// Validate the PubNub message event as being a state-change category event
	//  that carries one of our user objects.
	if (typeof pubnubMessageEvent == 'undefined' || pubnubMessageEvent == null)
		throw new Error(errPrefix + 'The PubNub message event object is unassigned.');
		
	if (!user_details_lib.isUserDetailsObjInMessageEvent(pubnubMessageEvent))
		throw new Error(errPrefix + 'The PubNub message event object does not carry a valid chat room user object.');
	
	// Passed all checks.  Reconstitute the UserDetails object from the plain JSON object.
	let plainJsonObj = pubnubMessageEvent.user_details_object;
	return reconstituteUserDetailsObject( plainJsonObj);
}


// Yes.  Export the code so it works with require().
module.exports =
	{
		reconstituteObjectOfType: reconstituteObjectOfType,
		reconstituteAppEventResultObject: reconstituteAppEventResultObject,
		reconstituteEthereumPaymentDetailsObject: reconstituteEthereumPaymentDetailsObject,
		reconstituteGameDetailsObject: reconstituteGameDetailsObject,
		reconstituteUserDetailsObject: reconstituteUserDetailsObject,
		reconstituteVideoBookmarkDetailsObject: reconstituteVideoBookmarkDetailsObject,
		
		recoverAppEventResultFromPubNubMessageEvent: recoverAppEventResultFromPubNubMessageEvent,
		recoverUserFromMessageEvent: recoverUserFromMessageEvent,
		recoverUserFromStatusEvent: recoverUserFromStatusEvent
	};

/*
// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
	window.reconstitute_lib = {};
	window.reconstitute_lib.reconstituteObjectOfType = reconstituteObjectOfType;
	window.reconstitute_lib.reconstituteGameDetailsObject = reconstituteGameDetailsObject;
	window.reconstitute_lib.reconstituteUserDetailsObject = reconstituteUserDetailsObject;
	window.reconstitute_lib.reconstituteVideoBookmarkDetailsObject = reconstituteVideoBookmarkDetailsObject;
	window.reconstitute_lib.reconstituteAppEventDetailsObject = reconstituteAppEventResultObject;
}
else
{
}
*/