/**
 * This file contains the code related to users as PubNub chat room participants.
 */

const EnumValidateMeTypes = require('../misc/validation').EnumValidateMeTypes;
const isValidValidateMeType = require('../misc/validation').isValidValidateMeType;

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No. The needed routines should be in the global namespace.
}
else
{
	// Yes.  Need to require some modules.
	var misc_shared_lib = require('../misc/misc-shared');
	var video_details_lib = require('./video-details');
	var reconstitute_lib = require('./reconstituteGameObjects');
}

/** Handy object to hold some constants we use when interacting with user objects. */
var UserDetailsConstants = new function()
{
	/** Various user states. */
	this.USER_STATE_CREATED = 'created';
	this.USER_STATE_WAITING_FOR_PLAYERS = 'waiting for players';
	this.USER_STATE_PLAYING = 'playing';
	this.USER_STATE_COMPLETED = 'completed';
	
	/**
	 * The property name for the property that holds a game details object in any
	 * 	game detail objects we send/receive.
	 */
	this.PROP_NAME_USER_DETAILS_OBJECT = 'user_details_obj';
	this.PROP_NAME_USER_ID = 'userId';
}

/**
 * This function does a deep integrity test to make sure a PubNub STATUS event
 * 	is one that carries one of our chat room user objects in plain JSON object
 * 	format.
 *
 * @param {Object} pubnubStatusEvent - A PubNub status event object.
 *
 * @return {boolean} - Returns TRUE if the status event carries one of our chat
 * 	room user objects in plain JSON object, FALSE if not.
 */
function isChatRoomUserObjInStateChange(pubnubStatusEvent)
{
	if (typeof pubnubStatusEvent == 'undefined' || pubnubStatusEvent == null)
		return false;

	if (!pubnubStatusEvent.hasOwnProperty('action'))
		return false;
		
	if (pubnubStatusEvent.action != 'state-change')
		return false;

	if (!pubnubStatusEvent.hasOwnProperty('state'))
		return false;
		
	if (!pubnubStatusEvent.state.hasOwnProperty('user_details_object'))
		return false;
		
	// All checks passed.
	return true;
}

/**
 * This function does a deep integrity test to make sure a PubNub MESSAGE event
 * 	is one that carries one of our chat room user objects in plain JSON object
 * 	format.
 *
 * @param {Object} pubnubMessageEvent - A PubNub status event object.
 *
 * @return {boolean} - Returns TRUE if the message event carries one of our chat
 * 	room user objects in plain JSON object, FALSE if not.
 */
function isUserDetailsObjInMessageEvent(pubnubMessageEvent)
{
	let errPrefix = '(isUserDetailsObjInMessageEvent) ';
	
	if (typeof pubnubMessageEvent == 'undefined' || pubnubMessageEvent == null)
	{
		console.warn(errPrefix + 'The PubNub message event is unassigned.');
		return false;
	}

	if (!pubnubMessageEvent.hasOwnProperty('messageText'))
	{
		console.warn(errPrefix + 'The PubNub message event does not have a messageText property.');
		return false;
	}
		
	if (!pubnubMessageEvent.hasOwnProperty('user_details_object'))
	{
		console.warn(errPrefix + 'The PubNub message event does not have a user_details_object property.');
		return false;
	}
		
	// All checks passed.
	return true;
}

/*
MOVED TO RECONSTITUTE GAME OBJECTS MODULE DUE TO CYCLIC MODULE REFERENCE LEADING
TO EMPTY reconstitute_lib MODULE DURING A REQUIRE STATEMENT.

**
 * This function takes the user object in plain JSON object format received from a
 * 	PubNub STATUS event that is of the state-change category and returns a UserDetails
 * 	object built from its content.
 *
 * @param {Object} pubnubStatusEvent - A PubNub status event.
 *
 * @return {Object} - A full-fledged user details object.
 *
function recoverUserFromStatusEvent(pubnubStatusEvent)
{
	var errPrefix = '(recoverUserFromStatusEvent) ';

	// Validate the PubNub status event as being a state-change category event
	//  that carries one of our user objects.
	if (typeof pubnubStatusEvent == 'undefined' || pubnubStatusEvent == null)
		throw new Error(errPrefix + 'The PubNub status event object is unassigned.');
		
	if (!isChatRoomUserObjInStateChange(pubnubStatusEvent))
		throw new Error(errPrefix + 'The PubNub status event object does not carry a valid chat room user object.');
	
	// Passed all checks.  Reconstitute the UserDetails object from the plain JSON object.
	var plainJsonObj = pubnubStatusEvent.state.user_details_object;
	var chatRoomUserObj = new UserDetails();
	
	// Convert the plain Javascript object to a Game Details object.
	for (var prop in plainJsonObj)
		chatRoomUserObj[prop] = plainJsonObj[prop];
	
	return chatRoomUserObj;
}

**
 * This function takes the user object in plain JSON object format received from a
 * 	PubNub MESSAGE event that is of the state-change category and returns a UserDetails
 * 	object built from its content.
 *
 * @param {Object} pubnubMessageEvent - A PubNub message event.
 *
 * @return {Object} - A full-fledged UserDetails object.
 *
function recoverUserFromMessageEvent(pubnubMessageEvent)
{
	var errPrefix = '(recoverUserFromMessageEvent) ';

	// Validate the PubNub message event as being a state-change category event
	//  that carries one of our user objects.
	if (typeof pubnubMessageEvent == 'undefined' || pubnubMessageEvent == null)
		throw new Error(errPrefix + 'The PubNub message event object is unassigned.');
		
	if (!isUserDetailsObjInMessageEvent(pubnubMessageEvent))
		throw new Error(errPrefix + 'The PubNub message event object does not carry a valid chat room user object.');
	
	// Passed all checks.  Reconstitute the UserDetails object from the plain JSON object.
	let plainJsonObj = pubnubMessageEvent.user_details_object;
	return reconstitute_lib.reconstituteUserDetailsObject( plainJsonObj);
}
*/

/**
 * Validate a user details object.
 *
 * @param {UserDetails} objToValidate - The object to validate as a user details object.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object.  See the EnumValidateMeTypes enumeration for details.
 */
function validateUserDetails(objToValidate, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
{
	var errPrefix = '(validateUserDetails) ';
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');
		
	if (!isValidValidateMeType(validationType))
		throw new Error(errPrefix + 'The validation type is invalid: ' + validationType);

	// We must have a user ID.
	if (misc_shared_lib.isEmptySafeString(objToValidate.uuid))
		throw new Error(errPrefix + 'The user ID is empty.');
		
	// We must have a screen name.
	if (misc_shared_lib.isEmptySafeString(objToValidate.screenName))
		throw new Error(errPrefix + 'The screen name for chat is empty.');
		
	// We must have a current status.
	if (misc_shared_lib.isEmptySafeString(objToValidate.currentStatus))
		throw new Error(errPrefix + 'The current status is empty.');
		
	// State is optional but force it to an empty object if it is undefined or NULL.
	if (typeof objToValidate.userMetaData == 'undefined' || objToValidate.userMetaData == null)
		objToValidate.userMetaData = {};
		
	// We must have a valid DIV Id.
	if (misc_shared_lib.isEmptySafeString(objToValidate.divId))
		throw new Error(errPrefix + 'The DIV element ID is empty.');
		
	// We must have a game ID.
	if (misc_shared_lib.isEmptySafeString(objToValidate.gameId))
		throw new Error(errPrefix + 'The game ID is empty.');
		
	// We must have the ID of the video submitted by this user.
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoIdSubmitted))
		throw new Error(errPrefix + 'The ID for the video submitted by the user is empty.');
		
	// We must have the title of the video submitted by this user.
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoTitleSubmitted))
		throw new Error(errPrefix + 'The title for the video submitted by the user is empty.');
		
	// We must have a valid video status.
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoStatus))
		throw new Error(errPrefix + 'The video status of the video submitted by the user is empty.');
}

/**
 * This method takes a JSON string, parses it into a UserDetails object, validates it, and then
 * 	returns it.
 *
 * @param {String} strJson - The UserDetails object in JSON format.
 *
 * @return {UserDetails} - A valid UserDetails object.
 */
function parseJsonStringToUserDetailsObject(strJson)
{
	var errPrefix = '(parseJsonStringToUserDetailsObject) ';
	
	if (misc_shared_lib.isEmptySafeString(strJson))
		throw new Error(errPrefix + 'The JSON string is empty.');
		
	return misc_shared_lib.parseJsonStringToObjectOfType(strJson, UserDetails);
}

/**
 * This is the object that contains a game user, which is by definition also a
 * 	PubNub chat room participant.
 *
 * @constructor
 *
 * @return {UserDetails} - A valid chat room user.
 */
function UserDetails() {
    const self = this;
    let errPrefix = '(UserDetails) ';
    
    // Assign to our data members.
    
    /** @property {String} uuid - The user ID.  MUST be unique between users! */
    // Make a user ID for this user.
    this.id = 'user_' + misc_shared_lib.getSimplifiedUuid()
    
    // Alias for the id field for PubNub's sake.
    this.uuid = this.id;
    
    /** @property {String} screenName - The screen name to show in the chat relate areas for this user.
     * 	Should be unique between users! */
    this.screenName = "";
   	/** @property {String} currentStatus - The text to show next to the user's screen name in the
	 * 	online users list area.
	 */
	this.currentStatus = "(none)";
    /** @property {Object} metaData - Optional auxiliary field to hold additional data associated with this user. */
    this.metaData = {};
	/** @property {String} divId - Build the DIV element ID we will use for DIVs that contain
	 * 	page content for this user.
	 */
	this.divId = 'online-user-' + this.uuid + '-div';
	/** @property {String} gameId - The ID of the game the user joined. */
	this.gameId = "";
	/** @property {String} videoIdSubmitted - The ID of the YouTube video the user submitted. */
	this.videoIdSubmitted = "";
	/** @property {String} videoTitleSubmitted - The title of the YouTube video the user submitted. */
	this.videoTitleSubmitted = "";
	/** @property {String} videoStatus - The current status of the video the user submitted
	 * 	(e.g. - 'queued', 'played', etc.) */
	this.videoStatus = video_details_lib.VideoDetailsConstants.VIDEO_STATE_QUEUED;
	
	/** @property {Boolean} isGameCreator - TRUE if this user created the game, FALSE if not. */
	this.isGameCreator = false;

	/** @property {Boolean} isEntryFeePaidAndConfirmed - TRUE if this user has paid their entry fee AND that
	* 	payment has been confirmed on the Ethereum network, FALSE if not. */
	this.isEntryFeePaidAndConfirmed = false;

	/** @property {Number} timeStampedByServer - When the record is added to Redis, the server
	 * 	will set this field to the current server time.
	 */
	 
	this.timeStampedByServer = null;
	/**
	 * Validate this user details object.
	 *
	 * @param {string} validationType - The type of validation to perform on the reconstituted
     * 	object.  See the EnumValidateMeTypes enumeration for details.
	 */
	this.validateMe = function (validationType = EnumValidateMeTypes.ADVANCED_VALIDATION)
	{
		return validateUserDetails(self, validationType);
	}
    
    // Return a reference to this object to support method chaining.
    return self;
};

/**
 * This object maintains a list of users.
 *
 * @constructor
 */
function UserList()
{
	/** @property {Array} - The list of chat room users. */
	this.listUsers = new Array();
	
	/**
	 * This method searches the user list collection for a user with the given ID.
	 *
	 * @param {String} - The desired user ID.
	 *
	 * @return {Object|null| - Returns the user object if found, NULL If not.
	 */
	this.findUserObj = function(uuid)
	{
		var errPrefix = '(findUserObj) ';
		
		if (misc_shared_lib.isEmptySafeString(uuid))
			throw new Error(errPrefix + 'The user ID parameter is empty.')
			
		// Find it.
		var foundUserObj =
			goog.array.find(this.listUsers, function(user, ndx, ary)
				{
					return user.uuid == uuid;
				});
				
		// If not found foundObj will be of type 'undefined'.  If so, convert it to NULL.
		if (typeof foundUserObj == 'undefined')
			return null;
			
		// Return the found user.
		return foundUserObj;		
	}
	
	/**
	 * This method searches the user list collection for a user with the given ID
	 * 	and returns its index in the array.
	 *
	 * @param {String} - The desired user ID.
	 *
	 * @return {Object|null| - Returns the index the user object was found at, or -1
	 * 	if it was not found.
	 */
	this.findUserNdx = function(uuid)
	{
		var errPrefix = '(findUserNdx) ';
		
		if (misc_shared_lib.isEmptySafeString(uuid))
			throw new Error(errPrefix + 'The user ID parameter is empty.')
			
		// Find it.
		return goog.array.findIndex(this.listUsers, function(chatRoomUser, ndx, ary)
				{
					return chatRoomUser.uuid == uuid;
				});
	}
	
	/**
	 * This function checks to see if our collection of users already has a user with the
	 * 	given ID.
	 *
	 * @param {String} - returns TRUE if we already have a user with the given ID in our
	 * 	collection, otherwise FALSE is returned.
	 */
	this.isExistingUser =function(uuid)
	{
		return (this.findUserObj(uuid) != null);
	}
	
	/**
	 * This method applies the given function to each chat room user in our collection.
	 *
 	 * @param funcToApply - The function to apply to each chat room user.  It should
 	 * 	have the following call signature fn(chatRoomUser, ndx, ary).
	 */
	this.applyFunction = function(funcToApply)
	{
		var errPrefix = '(applyFunction) ';

		if (funcToApply == null)
			throw new Error(errPrefix + "The function to apply is unassigned.");
			
		goog.array.forEachRight(this.listUsers, funcToApply);
	}

	/**
	 * @param {Object} userDetails - A user details object.
	 *
	 */
	this.addUser = function(userDetails)
	{
		var errPrefix = '(addUser) ';
		
		// Validate the user details object.
		if (typeof userDetails == 'undefined' || userDetails == null)
			throw new Error(errPrefix + 'The user details object is unassigned.');
		
		// Ignore duplicates.
		if (!this.isExistingUser(userDetails.uuid))
			// throw new Error(errPrefix + "We already have a user with the ID: " + userDetails.uuid + ".");
			this.listUsers.push(userDetails);
	}
	
	/**
	 * Given a user details object, add it to our list of users if it is not
	 * 	in the list already.  If it is, replace any existing user with the
	 * 	same user ID.
	 *
	 * @param {UserDetails} userDetails - A user details object.
	 */
	this.addOrReplaceUser = function(userDetails)
	{
		var errPrefix = '(addOrReplaceUser) ';
		
		// Validate the user details object.
		if (typeof userDetails == 'undefined' || userDetails == null)
			throw new Error(errPrefix + 'The user details object is unassigned.');
			
		// Existing user?
		var ndxFound = this.findUserNdx(userDetails.uuid);
		
		if (ndxFound < 0)
			// No. Add it.
			this.addUser(userDetails);
			
		// Get its index.
		ndxFound = this.findUserNdx(userDetails.uuid);
		
		// This should never happen since we just added it.
		if (ndxFound < 0)
			throw new Error(errPrefix + "Could not find user object we just added.");
		
		// Yes.  Replace it.  We always do a replace operation to make sure we pick up
		//  ALL the fields of the incoming object not just the ones passed to the constructor.
		//
		// TODO: Streamline this later when there's time to refactor
		//  the chat room user object.
		this.listUsers[ndxFound] = userDetails;
	}
	
	/**
	 * Sets the status field for the user with the given ID.  If no user
	 * 	exists with the given ID, the call is ignored, although a
	 * 	message is posted to the console.
	 *
	 * @param {String} - The desired user ID.
	 * @param {String} statusText - The text to change the user's status to.
	 *
	 * @return {Object|null} - The chat room user if one was found with the
	 * 	given ID, otherwise NULL.
	 */
	this.setUserStatusField = function(uuid, statusText)
	{
		var errPrefix = '(setUserStatusField) ';
		
		if (misc_shared_lib.isEmptySafeString(uuid))
			throw new Error(errPrefix + 'The user ID parameter is empty.')
			
		var foundUserObj = this.findUserObj(uuid);
		
		if (foundUserObj == null)
			console.log(errPrefix + "Could not find a user with the ID: " + uuid);
		else
			foundUserObj.currentStatus = statusText;
			
		return foundUserObj;
	}
}

/**
 * This method takes a primitive user details object, and then
 * 	returns a full-fledged user details object.
 *
 * @param {Object} UserDetailsObj_primitive - The UserDetails object as primitive JSON object (not full class).
 *
 * @return {UserDetails} - A valid UserDetails object.
 */
function postDataToUserDetailsObject(UserDetailsObj_primitive)
{
	var errPrefix = '(postDataToUserDetailsObject) ';
	
	if (!UserDetailsObj_primitive)
		throw new Error(errPrefix + 'The user details primitive object is unassigned.');
	
	var newUserDetailsObj = new UserDetails();
	
	// Convert the plain Javascript object to a user details object.
	for (var prop in UserDetailsObj_primitive)
		newUserDetailsObj[prop] = UserDetailsObj_primitive[prop];
	
	return newUserDetailsObj;
}


// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
	window.isChatRoomUserObjInStateChange = isChatRoomUserObjInStateChange;
    window.parseJsonStringToUserDetailsObject = parseJsonStringToUserDetailsObject;
    window.postDataToUserDetailsObject = postDataToUserDetailsObject;
    window.recoverUserFromMessageEvent = recoverUserFromMessageEvent;
    window.recoverUserFromStatusEvent = recoverUserFromStatusEvent;
    window.UserDetails = UserDetails;
    window.UserList = UserList;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			isChatRoomUserObjInStateChange: isChatRoomUserObjInStateChange,
			isUserDetailsObjInMessageEvent: isUserDetailsObjInMessageEvent,
			parseJsonStringToUserDetailsObject: parseJsonStringToUserDetailsObject,
			postDataToUserDetailsObject: postDataToUserDetailsObject,
			// recoverUserFromMessageEvent: recoverUserFromMessageEvent,
			// recoverUserFromStatusEvent: recoverUserFromStatusEvent,
			UserDetails: UserDetails,
			UserDetailsConstants: UserDetailsConstants,
			UserList: UserList
		};
}

