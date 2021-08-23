/**
 * Common routines.
 */

const file_system = require('fs');
const path_system = require('path');
const http_status_codes = require('http-status-codes');

/**
 * This function returns true if the browser user agent property indicates the user is running
 *  the mobile Safari browser.
 *
 * @return {Boolean}
 */
function isMobileSafari() {
	var bIsUserAgentPresent = /(iPod|iPad|iPhone).+Version\/[\d\.]+.*Safari/i.test(navigator.userAgent);
	
	return bIsUserAgentPresent;
}

/**
 * This function splits a word by spaces and then returns all the words in the
 *  sentence in an array, after trimming each word.  Empty words are not
 *  added to the result array.
 *
 * @param {string} str - The string to split.
 * @return {Array}
 */
function splitAndTrimSentence(str)
{
    var aryRetWords = new Array();

    str.split(" ").map(
        function(word)
        {
            if (!isEmptyString(word))
                aryRetWords.push(word.trim());
        });

    return aryRetWords;
}

/**
 * Helper function to handle all cases of a variable being essentially empty.
 *  INCLUDING it containing nothing but whitespace.
 *
 * @param {string} str - The string to test.
 * @return {boolean}
 */
function isEmptyString(str) {
    return (typeof str == 'undefined' || str == null || str.trim().length < 1);
}

/**
 * Helper function to handle all cases of an object being a non-empty array.
 *
 * @param ary - The (alleged) array to test.
 * @return {boolean}
 */
function isArrayAndNotEmpty(ary) {
    return (Array.isArray(ary) && ary.length > 0);
}

/**
 * Helper function that checks if an item is defined and not NULL.
 *
 * @param item - The item to test.
 * @return {boolean}
 */
function isDefinedAndNotNull(item) {
    return (typeof item != 'undefined' && item != null);
}

/**
 * Simple function that returns FALSE if the given value is anything but
 *  an explicit boolean TRUE value.
 *
 * @param bValue - The value to inspect.
 * @return {boolean}.
 *
 */
function falseIfNotExplicitlyTrue(bValue) {
    if (typeof bValue != 'undefined' && bValue != null) {
        if (bValue === false || bValue === true)
            return bValue;
    }

    return false;
}

/**
 * Simple helper function to test a function name for being empty and if not,
 *  wrap it in parentheses.
 *
 * @param {string} funcName
 * @return {string}
 */
function wrapFunctionNameInParens(funcName) {
    if (isEmptyString(funcName))
        throw new Error("(wrapFunctionNameInParens) The function name is empty.");

    return "(" + funcName + ")";
}

/**
 * Simple helper function to build an error message that has the name of the
 *  function that generated the error prefixed to the error message.
 *
 * @param {string} funcName - The name of the function that generated the error.
 * @param {string} errMsg - The error message.
 * @return {string}
 */
function buildErrorMessage(funcName, errMsg) {
    if (isEmptyString(funcName))
        throw new Error("(buildErrorMessage) The function name is empty.");

    if (isEmptyString(errMsg))
        throw new Error("(buildErrorMessage) The error message is empty.");

    return wrapFunctionNameInParens(funcName.trim()) + " " + errMsg.trim();
}

/**
 * Remove all HTTP, HTTPS, or FTP links from a string.
 *
 * @param {string} str - The string to clean up.
 * @return {string}
 */
function removeAllLinks(str) {
    if (isEmptyString(str))
        return str;

    return str.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');
}

/**
 * Load the files from the given starting directory and
 *  return them in an array. If bRecurse is TRUE, then descend into
 *  child directories recursively too, otherwise only the contents
 *  of the starting directory will be processed.
 *
 * @param {string} startDir - The directory to begin the search at.
 * @param {boolean} bRecurse - Whether or not to recurse into sub-directories.
 * @return {Array} - An array of all the files found during the search.
 */
function readFilesSync(startDir, bRecurse) {
    var currentDir = startDir;
    var aryFilesFound = new Array();

    file_system.readdirSync(currentDir).forEach(
        function( fileName )
        {
            var filePath = path_system.join(currentDir, fileName);
            var statDetails = file_system.statSync(filePath);

            // Is it a file?
            if (statDetails.isFile())
            {
                // Add the file name to the return array.
                aryFilesFound.push(fileName);
            }
            else
            {
                // Is recursive descent requested?
                if (bRecurse)
                // Descend.
                    readFilesSync(filePath);
            } // else - if (statDetails.isFile())
        } // function( fileName )
    ); // foreach()

    // Return the list of files we found.
    return aryFilesFound;
} // function readFilesSync(startDir, bRecurse)

/**
 * This function returns TRUE if the value is an integer, FALSE if it is not
 *  including if it is not a number either.
 *
 * @param value - The directory to begin the search at.
 * @return {boolean}
 */
function isInteger(value)
{

    var er = /^-?[0-9]+$/;

    return er.test(value);
}

/**
 * Simple helper function to take a field name and value pair and convert it
 *  to standard equal sign delimited format.
 *
 * @param {string} name - The field name.
 * @param {string} value - The field value.
 * @return {string} - The equal sign delimited name/value pair.
 */
function buildNameValuePair( name, value ) {
    return name + '=' + value;
}

/**
 * Simple helper function to truncate a string at a maximum length.
 *
 * @param {string} str - The string to truncate.
 * @param {number} maxLen - The maximum allowed length for the string.
 * @return {string} - The truncated string.
 */
function truncateString(str, maxLen) {
    if (str.length > maxLen)
        return str.substring(0, maxLen - 1) + '&hellip;';
    return str;
}

/**
 * This method returns TRUE if the current environment variable settings indicate that
 *  we are on our local Linux development station.  Otherwise FALSE is returned.
 *
 * @return {boolean}
 */
function isDevEnv() {
    if (typeof process.env.LINUX_DEV == undefined || process.env.LINUX_DEV == null)
        // We are not on our development Linux station.
        return false;

    // Is the environment variable set to the value TRUE?
    var bIsDevEnv = process.env.LINUX_DEV === "true";

    return bIsDevEnv;
}

/**
 * This function takes a Javascript "associative array" (which
 *  actually is just an Object), and returns a string that
 *  that has each array element as a properly formed and
 *  encoded URL parameter, suitable for a GET request.
 *
 * IMPORTANT: Since we don't know if there are other URL
 *  parameters before this, it is the CALLER's responsibility
 *  to prepend a "?" or "&" character as appropriate before
 *  appending the URL parameters string to the MAIN URL.
 *
 *  @param {Array} aryNvp - array of name-value pairs.
 *  @return {string} - Encoded string formed from the name value pairs
 *      that is suitable for a get request.
 */
function nvpArrayToUrlParameters(aryNvp) {
    var emptyResult = "(none)";

    if (!isArrayAndNotEmpty(aryNvp))
        return emptyResult;

    var strRet = "";

    var aryKeys = Object.keys(aryNvp);

    if (aryKeys.length < 1)
        return emptyResult;

    for (var i = 0; i < aryKeys.length; i++)
    {
        if (i > 0)
            strRet += "&";
        strRet += aryKeys[i] + "=" + encodeURIComponent( aryNvp[aryKeys[i]]);
    }

    return strRet;

}

/**
 *  This function returns TRUE if the given function pointer is a valid
 *   non-null pointer to a function.
 *
 * @param funcPtr - The function pointer to inspect.
 *
 * @return {boolean}
 */
function isNonNullFunction(funcPtr) {
    if (typeof funcPtr == 'undefined' || funcPtr == null)
        return false;

    var getType = {};

    return getType.toString.call(funcPtr) === '[object Function]';
}

/**
 * Consolidated handling of a promise rejection.  This function will print a log message
 *  using the given caller and log message parameters, and then call the given reject
 *  function with the desired object given in the objResponse parameter.
 *
 *  NOTE: The "resolve" function is not currently used, but might be later if we
 *   create code that converts a reject attempt to a resolve attempt, based on
 *   some advanced recovery strategy we might create later.
 *
 * @param {String} caller - An informational message indicating who is calling myRejectPromise.
 * @param {String} logMessage - An informational message that indicates the reason for the
 * @param {Object} objResponse - The object that will be embedded in the error object
 *  we will pass to the reject function.  The embedded field name will be: response_object.
 * @param {Function} resolve - The promise's resolve function.
 * @param {Function} reject - The promise's reject function.
 *
 */
function myRejectPromise(caller, logMessage, objResponse, funcResolve, funcReject) {
    console.warn(
        caller + " -> ::myRejectPromise, rejected the promise with the message: "
        + logMessage);

    // Reject the promise if we have a valid reject function.
    if (isUnassignedObject(funcReject))
        // No recursive errors.  Just log the fact we don't have a valid rejection function.
        console.warn("Invalid rejection function parameter given.  The Promise can not be rejected!");
    else
    {
        var errMsg = caller + logMessage;
        var err = new Error(errMsg);
        err.response_object = objResponse;
        
        console.error("[Promise Rejection] " + errMsg);
    
        // Call the given rejection function with our error object.
        funcReject(err);
    }
}

/**
 * Helper function to handle all cases of a variable being unassigned.
 * @param {Object} obj - The alleged object to inspect.
 *
 * @return {boolean} - Returns TRUE if the object is unassigned, FALSE if not.
 */
function isUnassignedObject(obj) {
    return (typeof obj == 'undefined' || obj == null);
}

/**
 * Helper function to pretty print a Javascript object in a format friendly for logging.
 *
 * @param {Object} obj - The object to pretty print.
 */
function prettyPrintObject(obj)
{
    let errPrefix = '(prettPrintObject) ';
    
    if (isUnassignedObject(obj))
        throw new Error(errPrefix + ' The object parameter is unassigned.');
        
    return JSON.stringify(obj, null, 4);
}

/**
 * This helper function transfers all the properties found in the given auxiliary
 * 	object to the destination object.
 *
 * @param {Object} objAuxArgs - The auxiliary arguments object.
 * @param {Object} destObj - The destination object.
 *
 * @return {Object} - The destination object is returned with the properties belonging
 * 	to the auxiliary object transferred to it.
 *
 * NOTE: The auxiliary object must NOT any of the property names reserved for use
 * 	by a standard error object. (See the body of this function for a list of these
 * 	property names).
 */
function transferAuxObjPropsToObj(objAuxArgs, destObj) {
	let errPrefix = '(transferAuxObjPropsToObj) ';
	
	if (!objAuxArgs || typeof objAuxArgs != 'object')
		throw new Error(errPrefix + 'The auxiliary object is unassigned or is not of type "object".');
	if (!destObj || typeof destObj != 'object')
		throw new Error(errPrefix + 'The destination object is unassigned or is not of type "object".');

	// Add the properties of the auxiliary arguments object to the return object.
	for (var propKey in objAuxArgs) {
		// Auxiliary objects MUST NOT contain either an "is_error" property or a "message" property.
		if (propKey == 'is_error')
			throw new Error(errPrefix + 'Auxiliary objects MUST NOT contain property named "is_error".');
		if (propKey == 'is_error_shown_to_user')
			throw new Error(errPrefix + 'Auxiliary objects MUST NOT contain property named "is_error_shown_to_user".');
		if (propKey == 'message')
			throw new Error(errPrefix + 'Auxiliary objects MUST NOT contain property named "message".');
			
		destObj[propKey] = objAuxArgs[propKey];
	}

	return destObj;
}

/**
 * Simple helper function that returns a JSON object that indicates successfulConfirmation
 *  in a conformed format.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {String} theMessage - A simple message to return with the object.
 * @param {Object} [objAuxArgs] - An optional object containing extra data to be returned to the client.
 */
function returnStandardSuccessJsonObj(req, res, theMessage, objAuxArgs) {
    var errPrefix = '(returnStandardSuccessJsonObj) ';
    
    if (typeof req == 'undefined' || req == null)
        throw new Error(errPrefix + 'The request object is unassigned.');
        
    if (typeof res == 'undefined' || res == null)
        throw new Error(errPrefix + 'The response object is unassigned.');
        
    if (isEmptyString(theMessage))
        throw new Error(errPrefix + 'The message is empty.');
        
    // If we have a value for the auxiliary object parameter, make sure it an object.
    if (objAuxArgs) {
    	if (typeof objAuxArgs != 'object')
    		throw new Error(errPrefix + ' The auxiliary object parameter does not contain a value of type "object"');
	}
        
    var retJsonObj = {
        is_error: false,
        is_error_shown_to_user: false,
        message: theMessage,
	}
	
	// If we have an auxiliary object, transfer it's properties to the JSON object we are returning.
	if (objAuxArgs)
		transferAuxObjPropsToObj(objAuxArgs, retJsonObj);
    
    res.status(http_status_codes.OK).send(retJsonObj);
}

/**
 * Simple helper function that returns a JSON object that indicates an error occurred
 *  in a conformed format.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {String} theErrorMessage - An error message to return with the object.
 * @param {boolean} [isErrorShownToUser] - Set this to TRUE if you want the error message
 * 	to be shown to the user if this error is something the user can or needs to handle.
 * 	Set it to FALSE if not.  If not given, the default of FALSE will be used (i.e. - not
 * 	shown to the user).
 * @param {Number} [httpStatusCode] - The HTTP error code to send back.  If one
 *  is not provided, an HTTP OK will be returned.
 * @param {Object} [objAuxArgs] - An optional object containing extra data to be returned to the client.
 *
 * NOTE: The response returned carries an HTTP OK status code.
 */
function returnStandardErrorObj(req, res, theErrorMessage, isErrorShownToUser, httpStatusCode, objAuxArgs)
{
    var errPrefix = '(returnStandardErrorObj) ';
    
    if (typeof req == 'undefined' || req == null)
        throw new Error(errPrefix + 'The request object is unassigned.');
        
    if (typeof res == 'undefined' || res == null)
        throw new Error(errPrefix + 'The response object is unassigned.');
        
    if (!theErrorMessage || theErrorMessage.length < 1)
        throw new Error(errPrefix + 'The error message is empty.');
        
    if (typeof httpStatusCode == 'undefined' || httpStatusCode == null)
        httpStatusCode = http_status_codes.OK;

	// If we have been given a value for the isErrorShownToUser parameter, it must be boolean and
	//  the HTTP status code to return parameter must be an HTTP OK.
    if (isErrorShownToUser) {
		if (typeof isErrorShownToUser != 'boolean')
        	throw new Error(errPrefix + 'An isErrorShownToUser parameter has been provided but it is not of type "boolean".');
        	
        // If we are showing an error to the user, then we should ONLY return an HTTP status code of
        //  of HTTP OK, otherwise the client will think it's a catastrophic error.
        if (httpStatusCode != http_status_codes.OK)
        	throw new Error(errPrefix + 'The isErrorShownToUser flag is set to TRUE, but the HTTP status code to return is not that of HTTP OK.');
	}
        
    var errorObj = {
        is_error: true,
        is_error_shown_to_user: isErrorShownToUser,
        message: theErrorMessage
    }

		// If we have an auxiliary object, transfer it's properties to the JSON object we are returning.
	if (objAuxArgs)
		transferAuxObjPropsToObj(objAuxArgs, errorObj);
    
    res.status(httpStatusCode).send(errorObj);
}

// This function returns TRUE if the current execution context is localhost, otherwise
//  FALSE is returned.
function isLocalHost(req) {
    var hostMachine = req.headers.host.split(':')[0];
    
    return (hostMachine === 'localhost')
}

/**
 * Simple protections against unwanted users.  This test should only be run
 *  from localhost with the PIN provided as a URL argument.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {String} checkPin - The PIN that the PIN given by the URL arguments
 *  must match.
 */
function localHostWithPinOnly_get(req, res, checkPin) {
    let errPrefix = "(localHostWithPinOnly_get) ";
    let errMsg = null;
    let retStatusCode = http_status_codes.INTERNAL_SERVER_ERROR;
    
    if (!req)
        errMsg = "Missing Express request object.";
    else if (!res)
        errMsg = "Missing Express response object.";
    else if (isEmptyString(checkPin))
        errMsg = "Missing PIN to check incoming PIN against.";
    else {
        // Return a 401 Unauthorized error for the following errors.
        retStatusCode = http_status_codes.UNAUTHORIZED;
        
        if (!isLocalHost(req))
            errMsg = "You are not authorized to access this page.";
        // Make sure we have a PIN.
        else if (isEmptyString(req.query.pin))
            errMsg = "Missing confirmation code.";
        // Make sure it's the right PIN.
        else if (req.query.pin !== checkPin)
            errMsg = "Incorrect confirmation code.";
    }
    
    // Error occurred?
    if (errMsg)
        // Let the code that called us know.  Don't use the error prefix
        //  because errors will be shown to the client.
        throw new Error(errMsg);
	
	// Success.  Just return.
	return;
}

/**
 * This function removes the prefix that identifies strings as hex strings
 * 	if one exists.  Otherwise the string is returned unmodified.
 *
 * @param {String} str - The string to inspect and modify.
 *
 * @return {*} - Returns the string without the hex string format prefix.
 */
function removeHexPrefixIfExists(str) {
	if (isEmptyString(str))
		return str;
		
	if (str.startsWith('0x'))
		return str.substr(2, str.length - 2);
		
	return str;
}

/**
 * This function makes sure that a check PIN was provided with the GET
 *  URL arguments, that it matches the check PIN set in the environment,
 *  and that we are running on localhost.  Any failure in this regard
 *  throws an error (See localHostWithPinOnly_get()).
 *
 * @param {Object} req - A valid Express request object.
 * @param {Object} res - A valid Express response object.
 */
function localhostAndCheckPinOrDie(req, res) {
    let checkPin = process.env.CHECK_PIN;
		
    if (!checkPin || checkPin.length < 1)
        // We don't use an error prefix since errors are shown to the client.
        throw new Error('The confirmation code was not set in the environment.');
        
    // Localhost use only, with the default PIN (e.g. - ?pin=XXXX);
    localHostWithPinOnly_get(req, res, checkPin);
}

/**
 * This method validates a number as positive integer greater than 0.  If
 *  the incoming argument is a string, it will attempt to parse the string
 *  as an integer.
 *
 * @param {string} callerRaw - The calling function or relevant consumer of
 *  this method.
 * @param {number|string} allegedNumber - A number that must be an integer and
 *  greater than zero.
 *
 * @return {number} - Returns the number if it is an integer that
 *  is greater than 0.  Otherwise an error is thrown.
 */
function validateAsIntegerGreaterThanZero(callerRaw, allegedNumber) {
	let methodName = 'validateAsIntegerGreaterThanZero';
	let errPrefix = '(' + methodName + ') ';

	if (!callerRaw || callerRaw.length < 1 || callerRaw.trim() == '')
		throw new Error(errPrefix + 'The caller parameter is empty.');
		
	let caller = callerRaw + ' ';

    if (!allegedNumber)
        throw new Error(caller + 'The given value is not set.');
        
    let useNumber = allegedNumber;
        
    if (typeof allegedNumber === 'string')
        useNumber = parseInt(allegedNumber);
        
    if (!Number.isInteger(useNumber))
        throw new Error(caller + 'The given value is not an integer.');
        
    if (useNumber === 0)
        throw new Error(caller + 'The given value is equal to 0.');
        
    if (useNumber < 0)
        throw new Error(caller + 'The given value is negative.');
        
    return useNumber;
}

// Common code shared by other SERVER-SIDE Javascript source files in this project.
module.exports =
    {
        buildErrorMessage: buildErrorMessage,
        buildNameValuePair: buildNameValuePair,
        falseIfNotExplicitlyTrue: falseIfNotExplicitlyTrue,
        isArrayAndNotEmpty: isArrayAndNotEmpty,
        isDefinedAndNotNull: isDefinedAndNotNull,
        isDevEnv: isDevEnv,
        isEmptyString: isEmptyString,
        isInteger: isInteger,
        isLocalHost: isLocalHost,
        isMobileSafari: isMobileSafari,
        isNonNullFunction: isNonNullFunction,
        isUnassignedObject: isUnassignedObject,
        // localHostWithPinOnly_get: localHostWithPinOnly_get,
        localhostAndCheckPinOrDie: localhostAndCheckPinOrDie,
        myRejectPromise: myRejectPromise,
        nvpArrayToUrlParameters: nvpArrayToUrlParameters,
        prettyPrintObject: prettyPrintObject,
        readFilesSync: readFilesSync,
        removeAllLinks: removeAllLinks,
        removeHexPrefixIfExists: removeHexPrefixIfExists,
        returnStandardSuccessJsonObj: returnStandardSuccessJsonObj,
        returnStandardErrorObj: returnStandardErrorObj,
        splitAndTrimSentence: splitAndTrimSentence,
        truncateString: truncateString,
        validateAsIntegerGreaterThanZero: validateAsIntegerGreaterThanZero
    };


