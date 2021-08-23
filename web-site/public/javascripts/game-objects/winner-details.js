/**
 * This module contains the objects related to the game winners.
 */
 
 // Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No. The needed routines should be in the global namespace.
}
else
{
	// Yes.  Need to require some modules.
	var misc_shared_lib = require('../misc/misc-shared');
}

/** Handy object to hold some constants we use when interacting with winner detail objects. */
var WinnerDetailsConstants = new function()
{
}

/**
 * Validate a winner details object.
 *
 * @param {Object} objToValidate - The object to validate as a winner details object.
 */
function validateWinnerDetailsObj(objToValidate)
{
	var errPrefix = '(validateWinnerDetailsObj) ';
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');

	// We must have an ID.
	if (misc_shared_lib.isEmptySafeString(objToValidate.id))
		throw new Error(errPrefix + 'The ID field is empty.');
		
	// We must have the ID of the user that authored the winning bookmark.
	if (misc_shared_lib.isEmptySafeString(objToValidate.userId))
		throw new Error(errPrefix + 'The user ID field is empty.');
		
	// We must have the ID of the video the winner was calculated for.
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoId))
		throw new Error(errPrefix + 'The source video ID field is empty.');
		
	// We must have the title video that we have the ID for.
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoId))
		throw new Error(errPrefix + 'The title for the source video is empty.');
		
	// The start point can not be negative.
	if (objToValidate.startPoint < 0)
		throw new Error(errPrefix + 'The start point for the video is negative.');
		
	// The average start point can not be negative.
	if (objToValidate.startPoint < 0)
		throw new Error(errPrefix + 'The average start point for the video is negative.');
		
	// The server timestamp must be set.
	if (!objToValidate.timeStampedByServer)
		throw new Error(errPrefix + 'The server timestamp was never set.');

	// All checks passed.
}
 
/**
 * This method takes a JSON string, parses it into a WinnerDetails object, validates it, and then
 * 	returns it.
 *
 * @param {String} strJson - The WinnerDetails object in JSON format.
 *
 * @return {Object} - A valid WinnerDetails object.
 */
function parseJsonStringToWinnerDetailsObject(strJson)
{
	var errPrefix = '(parseJsonStringToWinnerDetailsObject) ';
	
	if (misc_shared_lib.isEmptySafeString(strJson))
		throw new Error(errPrefix + 'The JSON string is empty.');
		
	return misc_shared_lib.parseJsonStringToObjectOfType(strJson, WinnerDetails);
}
 
function WinnerDetails(){
	var self = this;
	
	/** @property {String} id - An ID for this winner. */
	this.id = misc_shared_lib.getSimplifiedUuid();
	/** @property {String} userId - The ID of the winning user. */
	this.userId = "";
	/** @property {String} videoId - The ID of the video the user won in a round of playing. */
	this.videoId = "";
	/** @property {String} videoTitle - The title of the video. */
	this.videoTitle = "";
	/** @property {Number} id - The bookmark start location the winning user chose, in seconds. */
	this.startPoint = 0;
	/** @property {Number}  - The average start point of all the video bookmarks that were
	* part of the calculations for determining the winner. */
	this.avgStartPoint = 0;
	
	/** @property {Number} timeStampedByServer - When the record is added to Redis, the server
	 * 	will set this field to the current server time.
	 */
	this.timeStampedByServer = null;
	
	this.validateMe = function()
	{
		return validateWinnerDetailsObj(self)
	}
	
    // Return a reference to this object to support method chaining.
    // TODO: If errors crop up around the WinnerDetails object, remember this recent change.
    // return self;
}

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
    window.WinnerDetails = WinnerDetails;
    window.parseJsonStringToWinnerDetailsObject = parseJsonStringToWinnerDetailsObject;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			WinnerDetails: WinnerDetails,
			WinnerDetailsConstants: WinnerDetailsConstants,
			parseJsonStringToWinnerDetailsObject: parseJsonStringToWinnerDetailsObject
		};
}

