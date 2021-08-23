/**
 * This file contains the object that we use to store the band details.
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

/**
 * Call this method to validate the fields of a BandDetails object.
 *
 * @param objToValidate
 * @returns {boolean}
 */
function validateBandDetailsObj(objToValidate)
{
	var errPrefix = '(validateBandDetailsObj) ';
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');

	if (misc_shared_lib.isEmptySafeString(objToValidate.id))
		throw new Error(errPrefix + 'Please enter a valid ID for the band.');
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.gameId))
		throw new Error(errPrefix + 'Please enter a valid game ID for the game the band joined.');
	
	if (misc_shared_lib.isEmptySafeString(objToValidate.ethereumPublicAddress))
		throw new Error(errPrefix + 'Please enter a valid Ethereum public address.');
		
	if (misc_shared_lib.isEmptySafeString(objToValidate.videoIdSubmitted))
		throw new Error(errPrefix + 'Please select a valid YouTube video.');
	
	// All checks passed.
	return true;
};

/**
 * This method takes a JSON string, parses it into a BandDetails object, validates it, and then
 * 	returns it.
 *
 * @param {String} strJson - The BandDetails object in JSON format.
 *
 * @return {Object} - A valid BandDetails object.
 */
function parseJsonStringToBandDetailsObject(strJson)
{
	var errPrefix = '(parseJsonStringToBandDetailsObject) ';
	
	if (misc_shared_lib.isEmptySafeString(strJson))
		throw new Error(errPrefix + 'The JSON string is empty.');
		
	return misc_shared_lib.parseJsonStringToObjectOfType(strJson, BandDetails);
}

/**
 * This object holds the details for a particular game instance.
 *
 * @constructor
 */
function BandDetails()
{
	var errPrefix = '(BandDetails) ';

	/** @property {String} uuid - The band ID.*/
	this.uuid = "";
	
	/** @property {String} gameId - The ID of the game the band joined. */
	this.gameId = "";
	
	/** @property {String} ethereumPublicAddress - The Ethereum public address of the band. */
	this.ethereumPublicAddress = "";
	
	/** @property {String} videoIdSubmitted - The ID of the YouTube video one of the players
	* 	submitted for the band. */
	this.videoIdSubmitted = "";
	
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
		return validateBandDetailsObj(this);
	};
	
}

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
    window.BandDetails = BandDetails;
    window.parseJsonStringToBandDetailsObject = parseJsonStringToBandDetailsObject;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			BandDetails: BandDetails,
			parseJsonStringToBandDetailsObject: parseJsonStringToBandDetailsObject
		};
}

