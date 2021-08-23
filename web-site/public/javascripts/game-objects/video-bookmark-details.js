/**
 * This file contains the object that we use to store the video bookmark details.
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
}


/**
 * This method takes a JSON string, parses it into a VideoBookmarkDetails object, validates it, and then
 * 	returns it.
 *
 * @param {String} strJson - The VideoBookmarkDetails object in JSON format.
 *
 * @return {Object} - A valid VideoBookmarkDetails object.
 */
function parseJsonStringToVideoBookmarkDetailsObject(strJson)
{
	var errPrefix = '(parseJsonStringToVideoBookmarkDetailsObject) ';
	
	if (misc_shared_lib.isEmptySafeString(strJson))
		throw new Error(errPrefix + 'The JSON string is empty.');
		
	return misc_shared_lib.parseJsonStringToObjectOfType(strJson, VideoBookmarkDetails);
}

/**
 * This function validates a VideoBookmarkDetails object.  If the object fails
 * 	validation for any reason, an error is thrown.
 *
 * @param {Object} objToValidate - A video bookmark details object.
 */
function validateVideoBookmarkDetailsObj(objToValidate)
{
	var errPrefix = "(validateVideoBookmarkDetailsObj) ";
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');

	// Parameter checks.
	if (misc_shared_lib.isEmptySafeString(objToValidate.id))
		throw new Error(errPrefix + "Please enter a valid bookmark ID.");
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.gameId))
		throw new Error(errPrefix + "Please enter a valid game ID.");
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoId))
		throw new Error(errPrefix + "Please enter a valid video ID.");
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoTitle))
		throw new Error(errPrefix + "Please enter a valid video title.");
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.userId))
		throw new Error(errPrefix + "Please enter a valid player ID.");
		
	if (objToValidate.startPoint < 0)
		throw new Error(errPrefix + "The start point is negative.  Please enter 0 or greater for the bookmark start point.");
	
	if (objToValidate.endPoint < 0)
		throw new Error(errPrefix + "The end point is negative.  Please enter 0 or greater for the bookmark start point.");
		
	// Make sure the start point and end point make sense in relation to
	//  each other, but only if endPoint is greater than 0 since 0 means
	//  "play to the end of the video".
	if (objToValidate.endPoint > 0 && objToValidate.endPoint < objToValidate.startPoint)
		throw new Error(errPrefix + "The end point is before the start point.  Please enter a valid start and end point pair.");
	
	if (misc_shared_lib.isEmptySafeString(objToValidate.comment))
		throw new Error(errPrefix + "Please enter a valid comment for this bookmark.");
}

/**
 *
 * See validateBookmarkParameters() for a description of the parameters to this
 *  object's constructor.
 *
 * @constructor
 */
function VideoBookmarkDetails()
{
	// -------------- Critical data properties ------------------
	
	var self = this;

	// NOTE: see validateBookmarkParameters() for details about the following properties.
	
	// Make a unique ID for this bookmark, solely to tie various page elements
	//  to this Javascript object.
	this.id = misc_shared_lib.getSimplifiedUuid();

	/** @property {String} gameId - The ID of the game this video bookmark belongs to. */
	this.gameId = "";
	/** @property {String} videoId - The ID of the video on the host streaming platform.  (E.g. - A YouTube video ID). */
	this.videoId = "";
	/** @property {String} videoTitle - The title of the video on the host streaming platform.  (E.g. - A YouTube video title). */
	this.videoTitle = "";
	/** @property {String} userId - The ID of the user that created this bookmark. */
	this.userId = "";
	/** @property {String} startPoint -  The location in the video in seconds where the bookmark begins at. */
	this.startPoint = 0;
	/** @property {String} endPoint - The location in the video in */
	this.endPoint = 0;
	/** @property {String} comment - A comment about or description for this bookmark. */
	this.comment = "";
	
	// -------------- Optional properties used for editing and styling purposes only ------
	
	/** @property {String} isAvailable - If TRUE, the video is still available for playback.  If not, then it is FALSE. */
	this.isAvailable = true;
	
	/** @property {String} isSelected - This flag is available for marking a bookmark as selected during a bookmark editing
	 * operation  */
	this.isSelected = false
	
	/** @property {String} isHighlighted - This flag is available for marking a bookmark as selected during a bookmark viewing
	 * operation  */
	this.isHighlighted = false;
	
	/** @property {Number} timeStampedByServer - When the record is added to Redis, the server
	 * 	will set this field to the current server time.
	 */
	this.timeStampedByServer = null;
	
	/**
	 * Call this function to validate the current game details of this object.  If
	 * 	any field is invalid, an error will be thrown with the validation
	 * 	problem stored in the error message property.
	 */
	this.validateMe = function()
	{
		return validateVideoBookmarkDetailsObj(self);
	};
	
	/**
	 * Return the start point value as a human friendly formatted HH:MM:ss string.
	 *
	 * @return {String}
	 */
	this._formatStartPoint = function()
	{
		return misc_shared_lib.secondsToHoursMinutesSecondsString(self.startPoint);
	}
	
	/**
	 * Return the end point value as a human friendly formatted HH:MM:ss string.
	 *
	 * @return {String}
	 */
	this._formatEndPoint = function()
	{
		// Do not show the end point if it is 0 since that is the default value that means play until the end
        //  of the video.
        if (self.endPoint > 0)
			return misc_shared_lib.secondsToHoursMinutesSecondsString(self.endPoint);
		else
			return "";
	}
	
	/**
	 * Return the comment in a conformed format.
	 *
	 * @return {String}
	 */
	this._formatComment = function()
	{
		return self.comment;
	}
	
	/**
	 * This method creates various derived properties that we need for the handlebar
	 * 	templates used in conjunction with this object.  It should be called whenever
	 * 	one of the MAIN fields change in content.
	 */
	this.finishBookmark = function()
	{
		self.startPoint_formatted = self._formatStartPoint();
		self.endPoint_formatted = self._formatEndPoint();
		self.comment_formatted = self._formatComment();
	}
	
	/**
	 * This function returns TRUE if the time interval bounded inclusively by the
	 * 	start and end points of this bookmark (overlaps).  Otherwise FALSE is
	 * 	returned.
	 *
 	 * @param {Number} seconds - The seconds value to inspect.
 	 *
	 * @return {boolean} Returns TRUE if the seconds value is covered by this bookmark,
	 * 	otherwise FALSE is returned.
	 */
	this.isTimeInsideBookmark = function(seconds) {
		var errPrefix = '(isTimeInsideBookmark) ';
		
		if (seconds < self.startPoint)
			return false;
		if (seconds > self.endPoint)
			return false;
			
		return true;
	}
	
	self.finishBookmark();
}

/**
 * This method takes a primitive video bookmark details object, and then
 * 	returns a full-fledged video bookmark details object.
 *
 * @param {Object} VideoBookmarkDetailsObj_primitive - The VideoBookmarkDetails object as primitive JSON object (not full class).
 *
 * @return {VideoBookmarkDetails} - A valid VideoBookmarkDetails object.
 */
function postDataToVideoBookmarkDetailsObject(VideoBookmarkDetailsObj_primitive)
{
	var errPrefix = '(postDataToVideoBookmarkDetailsObject) ';
	
	if (!VideoBookmarkDetailsObj_primitive)
		throw new Error(errPrefix + 'The video bookmark details primitive object is unassigned.');
	
	var newVideoBookmarkDetailsObj = new VideoBookmarkDetails();
	
	// Convert the plain Javascript object to a video bookmark details object.
	for (var prop in VideoBookmarkDetailsObj_primitive)
		newVideoBookmarkDetailsObj[prop] = VideoBookmarkDetailsObj_primitive[prop];
	
	return newVideoBookmarkDetailsObj;
}


// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
    window.VideoBookmarkDetails = VideoBookmarkDetails;
    window.video_bookmark_details_lib.parseJsonStringToVideoBookmarkDetailsObject = parseJsonStringToVideoBookmarkDetailsObject;
    window.video_bookmark_details_lib.postDataToVideoBookmarkDetailsObject = postDataToVideoBookmarkDetailsObject;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			VideoBookmarkDetails: VideoBookmarkDetails,
			parseJsonStringToVideoBookmarkDetailsObject: parseJsonStringToVideoBookmarkDetailsObject,
			postDataToVideoBookmarkDetailsObject: postDataToVideoBookmarkDetailsObject
		};
}

