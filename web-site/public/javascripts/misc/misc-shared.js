/**
 * This file contains common code that is share between the server and client code.
 *
 */
 
// ---------------- BEGIN:  GOOGLE CLOSURE CLONED CODE -------------

// The functions below were extracted from the Google Closure library,
//  which is included in this project.  See it's license file for details.

/**
 * @return {number} An integer value representing the number of milliseconds
 *     between midnight, January 1, 1970 and the current time.
 *
 * WARNING!!: Only use this function on a server you control (trusted site).
 * 	See the notes on goog.TRUSTED_SITE for details.
 */
function nowDateTime()
{
	if (Date.now)
		return Date.now();
		
	 // Unary plus operator converts its operand to a number which in
	 // the case of a date is done by calling getTime().
	 return + new Date();
};


/**
 * Returns a string with at least 64-bits of randomness.
 *
 * Doesn't trust Javascript's random function entirely. Uses a combination of
 * random and current timestamp, and then encodes the string in base-36 to
 * make it shorter.
 *
 * @return {string} A random string, e.g. sn1s7vb4gcic.
 */
function getRandomString() {
  var x = 2147483648;
  return Math.floor(Math.random() * x).toString(36) +
		 Math.abs(Math.floor(Math.random() * x) ^ nowDateTime()).toString(36);
};

/**
 * (author: Robert Oschler)
 *
 * This method quadruples up on the Google Closure getRandomString() method to
 * 	create a longer unique ID since the random strings returned by that function
 * 	are quite short.
 *
 * TODO: WARNING - switch over to a browserified version of the UUID Node.js
 * 	package when there is time!  That library creates a better unique ID
 * 	then this function.
 */
function getSimplifiedUuid()
{
	console.warn('Using simplified version of unique ID creation function.');
	
	return getRandomString() + getRandomString() + getRandomString() + getRandomString();
}

/**
 * Returns a string representation of the given object, with
 * null and undefined being returned as the empty string.
 *
 * @param {*} obj The object to convert.
 * @return {string} A string representation of the {@code obj}.
 */
function makeStringSafe(obj) {
	if (typeof obj == 'undefined' || obj == null)
		return '';
		
	return String(obj);
}

/**
 * Checks if a string is empty or contains only whitespaces.
 * @param {string} str The string to check.
 * @return {boolean} Whether {@code str} is empty or whitespace only.
 */
function isEmptyOrWhitespaceString(str) {
	// testing length == 0 first is actually slower in all browsers (about the
	// same in Opera).
	// Since IE doesn't include non-breaking-space (0xa0) in their \s character
	// class (as required by section 7.2 of the ECMAScript spec), we explicitly
	// include it in the regexp to enforce consistent cross-browser behavior.
	return /^[\s\xa0]*$/.test(str);
}

/**
 * Checks if a string is null, undefined, empty or contains only whitespaces.
 * @param {*} str The string to check.
 * @return {boolean} Whether {@code str} is null, undefined, empty, or
 *     whitespace only.
 */
function isEmptySafeString (str) {
	return isEmptyOrWhitespaceString(makeStringSafe(str));
}

// ---------------- BEGIN:  GOOGLE CLOSURE CLONED CODE -------------

/**
 * Given a field value that is supposed to be a numeric value, make sure it is
 * 	and if it's not, show an error message to the user.
 *
 * @param fieldValue - The value to inspect.
 *
 * @param errPrompt - The error message to use if an error is thrown.
 *
 * @return {Number|null} - Returns the value as a number if it can be interpreted as one,
 * 	otherwise an error will be thrown using the given error prompt.
 */
function checkFieldForNumber(fieldValue, errPrompt)
{
	var errPrefix = '(' + arguments.callee.name + ') ';

	if (typeof fieldValue == 'undefined' || fieldValue == null)
		throw new Error(errPrefix + 'The field value parameter is unassigned.');

	if (isEmptySafeString(errPrompt))
		throw new Error(errPrefix + "The error prompt is empty.");

	if (typeof fieldValue == 'number')
		return fieldValue;
		
	try
	{
		var theNumber = parseFloat(fieldValue);
		
		// Check for NaN
		if (isNaN(theNumber))
			throw new Error(errPrefix + 'The field value is not a number.');
			
		return theNumber;
	}
	catch(err)
	{
		// Not a number.  Throw an error.
		throw new Error(errPrompt);
	}
	
	console.error(errPrefix + 'We should never reach this code location.');
}

/**
 * This method takes a JSON string, parses it into an object that is the same type as
 * 	the object of type passed in the objOfType parameter.  The newly created object is
 * 	then validate and returned.
 *
 * @param {String} strJson - The PlayerDetails object in JSON format.
 * @param objOfType - The type name of the object to create.  It must have a parameterless
 * 	constructor.
 *
 * @return {Object} - A new validated object of the same type as the objOfType parameter.
 */
function parseJsonStringToObjectOfType (strJson, objOfType)
{
	var errPrefix = '(parseJsonStringToObjectOfType) ';
	
	try {
		if (isEmptySafeString(strJson))
			throw new Error(errPrefix + 'The JSON string is empty.');
			
		if (typeof objOfType == 'undefined' || objOfType ==  null)
			throw new Error(errPrefix + 'The object of type parameter is unassigned.');
			
		var obj = JSON.parse(strJson);
		
		var newObjOfType = new objOfType();
		
		// Convert the plain Javascript object to a Game Details object.
		for (var prop in obj)
			newObjOfType[prop] = obj[prop];
		
		return newObjOfType;
	}
	catch(err)
	{
		// Most errors are due to constructor of the target object type throwing and
		//  error.
		let typeName = objOfType.name;
		let errMsg = errPrefix + 'Parse failed.  Did the target type constructor throw an error?: ' + typeName;
		
		errMsg += '\n Exception details: ' + err.message;
		
		throw new Error(errMsg);
	}
}

/**
 * Add a myPadLeft method to the String class that pads a string with a given pad value, but
 *  only if it is needed.
 *
 * @param {String} padValue - The value to prepend to the source string.  E.g. - "00" for time values.
 *
 * @return {string} - The modified string.
 */
String.prototype.myPadLeft = function(padValue) {
	if (typeof padValue == 'undefined' || padValue == null)
		throw new Error('(padLeft) The pad value is unassigned.');
		
	// Prefix enough of the pad value to the source string to meet
	//  the length of the pad value (if needed).
	return String(padValue + this).slice(-padValue.length);
}

/**
 * Converts a raw seconds value into a HH:MM:ss string.
 *
 * @param {Number} secondsRaw - The seconds count.
 *
 * @return {String} - The seconds value converted to a HH:MM:ss formatted string.
 */
function secondsToHoursMinutesSecondsString(secondsRaw)
{
	var errPrefix = '(secondsToHoursMinutesSecondsString) ';
	
	if (typeof secondsRaw == 'undefined' || secondsRaw == null)
		throw new Error (errPrefix + 'The raw seconds parameter is unassigned.');
	
	// Force the seconds parameter value to an integer.
	var seconds = parseInt(secondsRaw, 10);

	// Calculate the number of days.
	var days = Math.floor(seconds / (3600*24));
	seconds  -= days * 3600 * 24;
	
	// Calculate the number of days.
	var hours   = Math.floor(seconds / 3600);
	seconds  -= hours * 3600;
	
	// Calculate the number of days.
	var minutes = Math.floor(seconds / 60);
	seconds  -= minutes * 60;
	
	// Build full time string and return it.
	var padValue = "00";
	
	var retStr =
		hours.toString().myPadLeft(padValue)
		+ ':'
		+ minutes.toString().myPadLeft(padValue)
		+ ':'
		+ seconds.toString().myPadLeft(padValue);
		
	return retStr;
}

/**
 * This method returns TRUE if the strOrBool parameter is equal to boolean TRUE
 * 	or a string that can be converted to TRUE.
 *
 * @param strOrBool - The value to inspect.
 *
 * @return {boolean}
 */
function isTrueOrStrTrue(strOrBool)
{
	if (typeof strOrBool == 'undefined' || strOrBool == null)
		return false;
		
	if (typeof strOrBool == 'boolean' && strOrBool == true)
		return true;

	if (typeof strOrBool == 'string' && strOrBool.toLowerCase() == "true")
		return true;
		
	return false;
}

/**
 * This method returns FALSE if the strOrBool parameter is equal to boolean FALSE
 * 	or a string that can be converted to FALSE.
 *
 * @param strOrBool - The value to inspect.
 *
 * @return {boolean}
 */
function isFalseOrStrFalse(strOrBool)
{
	if (typeof strOrBool == 'undefined' || strOrBool == null)
		return false;
		
	if (typeof strOrBool == 'boolean' && strOrBool == false)
		return true;

	if (typeof strOrBool == 'string' && strOrBool.toLowerCase() == "false")
		return true;
		
	return false;
}

/**
 * This method tries to parse the given string as a number.
 *
 * @param {string} intAsStr - A string that allegedly contains a number.
 *
 * @return {number|null} - Returns an integer if the string contains a
 * 	valid integer, or NULL if it does not.
 */
function parseIntOrNull(intAsStr) {
	var retValue = null;
    
    if (!isEmptySafeString(intAsStr))
	{
    	if (!isNaN(intAsStr))
            retValue = parseInt(intAsStr);
    }
    
	return retValue;
}

/**
 * Simple helper function to conform error objects that may also be plain strings
 * 	to a string error message.
 *
 * @param {Object|string|null} err - The error object, or error message, or NULL.
 *
 * @return {string} - Returns the err value itself if it's a string.  If err is
 *  an object and it has a 'message property, it will return the err.message
 *  property value.  Otherwise the default empty value is returned.
 */
function conformErrorObjectMsg(err)
{
	let errMsg = '(none)';
	
	if (typeof err == 'string')
		errMsg = err;
	else
	{
		if (err && err.message)
			errMsg = err.message;
	}
	
	return errMsg;
}

/**
 * Builds an error prefix using the given function's caller and it's name as
 * 	found in the arguments.callee.name parameter at the time it called us.
 *
 * @param {Function} func - A function.
 * @param {string} argumentsCalleeName - The arguments.callee.name value.
 *
 * @return {string}
 */
function buildErrPrefixFromCalleeAndCaller(func, argumentsCalleeName) {
	let errPrefix = '(buildErrPrefixFromCalleeAndCaller) ';
	
	if (!func)
		throw new Error(errPrefix + 'The function given as the input parameter is unassigned.');
		
	if (isEmptySafeString(argumentsCalleeName))
		throw new Error(errPrefix + 'The arguments callee name is empty.');
		
	return '(' + func.caller + '::' + argumentsCalleeName + ') ';
}

/**
 * Use this construct to wrap promises intended for use with Promise.all()
 * 	so that Promise.all() does not fail fast (i.e. - fail immediately when
 * 	ANY promise fails).  Instead, you can itereate the values array returned
 * 	by Promise.all() and see the result of all the promises.
 *
 * If the wrapped promise succeeded the "error" property of the result object
 * 	will be FALSE and the result object will be returned.  If promise was
 * 	rejected the "error" property will be TRUE and the Error object
 * 	caught by the promise's catch block will be returned.  Use the
 * 	"instanceof Error" to make sure the error object is indeed an Error
 * 	object in the case of an error.
 *
 * @param {Promise} promiseToWrap
 *
 * @return {Promise<T | {error: boolean, err: Error}>}
 */
const toResultWrapperObject = (promiseToWrap) =>
{
	return new Promise(function(resolve, reject) {
		promiseToWrap
		.then(result => {
			let retObj = { error: false, resultObj: result };
			resolve(retObj);
		})
		.catch(err => {
			let retObj = { error: true, errorObj: err };
			resolve(retObj);
		});
	});
}

/**
 * This function takes an array of promises, decorates them with toResultWrapperObject,
 * 	and executes the decorated promises with Promise.all().  This fixes the
 * 	"fail-fast" problem with Promise.all().  See the notes on toResultWrapperObject.
 *
 *
 * @param {Array} aryPromises - An array of promises to execute.
 *
 * @return {Promise<any>}
 */
function promiseAllWithResultObjects_promise(aryPromises) {
	return new Promise(function(resolve, reject) {
		try {
			let errPrefix = '(promiseAllWithResultObjects) ';
			
			if (!Array.isArray(aryPromises))
				throw new Error(errPrefix + 'The array of promises is not an array.');
				
			if (aryPromises.length < 1)
				throw new Error(errPrefix + 'The array of promises is empty.');
				
			return Promise.all(aryPromises.map(toResultWrapperObject))
			.then(aryValues => {
				// Resolve the promise with the values array.
				resolve(aryValues);
			})
			// Decorate all the promises with toResultWrapperObject and pass that decorated
			//  array to Promise.all().
			.catch(err =>
			{
				reject(conformErrorObjectMsg(err));
			});
		}
		catch(err)
		{
			reject(conformErrorObjectMsg(err));
		}
	});
}

/**
 * This is a utility object that is returned by a Promise THEN block when
 * 	it wants to tell the next THEN block in a promise chain NOT to validate
 * 	the result of the previous block because the block was basically skipped.
 *
 * @constructor
 */
function PromiseThenBlockSkippedResult() {
	// This object's is the content itself.
}

/**
 * Simple function that returns TRUE if the "process" variable has been globally
 * 	defined and is not NULL, otherwise FALSE is returned.
 *
 * @return {boolean}
 */
function isProcessGlobalVarPresent() {
	if (typeof process == 'undefined' || process == null)
		return false;
	return true;
}

/**
 * This promise waits the specified number of milliseconds before resolving.
 *
 * @param {number} delayMs - The number of milliseconds to wait.
 */
function delayMS_promise(delayMs) {
	let errPrefix = '(delayMS_promise) ';
	
	if (!delayMs || delayMs < 100)
		throw new Error(errPrefix + 'The delay in milliseconds parameter is invalid.');
	
	return function(dummy) {
		return new Promise(resolve => setTimeout(() => resolve(dummy), delayMs));
	};
}

/**
 * Converts a Buffer object to an array of bytes32.
 *
 * @param {Buffer} buf - A buffer object to convert.
 * @return {Array<byte>}
 */
function bufferToByteArray(buf) {
	let methodName = 'bufferToByteArray';
	let errPrefix = '(' + methodName + ') ';
	
	if (!(buf instanceof Buffer))
		throw new Error(errPrefix + 'The input parameter buf does not contain a Buffer object.');
		
	let aryBytes = new Array();
	
	for (let i = 0; i < buf.length; i++)
		aryBytes.push(buf[i]);
		
	return aryBytes;
}


/**
 * This function pulls out the value of a property with the given name from the given
 * 	object.
 *
 * @param {Object} obj - An object returned by a Web3 method call.
 * @param {string} propName - The name of the desired property.
 *
 * @return {*} - Returns the value of the property that has the given property name
 * 	from the object.
 */
function extractPropertyFromObj(obj, propName) {
	let methodName = 'extractPropertyFromObj';
	let errPrefix = '(' + methodName + ') ';
	
	if (!obj)
		throw new Error(errPrefix + 'The obj parameter is invalid.');
	
	if (isEmptySafeString(propName))
		throw new Error(errPrefix + 'The propName parameter is empty.');
		
	if (!obj.hasOwnProperty(propName))
		throw new Error(errPrefix + 'The object does not have a property named: ' + propName);
		
	return obj[propName];
}

/**
 * This function returns TRUE if and only if the given object is not NULL or
 * 	'undefined', is not NULL, and is of type 'object'.  Anything else rturns
 * 	FALSE
 *
 * @param obj - The alleged object to inspect.
 *
 * @return {boolean}
 */
function isNonNullObjectAndNotArray(obj) {
	let errPrefix = '(isNonNullObjectAndNotArray) ';
	
	if (typeof obj === 'undefined' || obj == null)
		return false;
		
	if (Array.isArray(obj))
		return false;
		
	return (typeof obj === 'object');
}

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
	window.misc_shared_lib = {};
	window.misc_shared_lib.buildErrPrefixFromCalleeAndCaller = buildErrPrefixFromCalleeAndCaller;
	window.misc_shared_lib.bufferToByteArray = bufferToByteArray;
	window.misc_shared_lib.checkFieldForNumber = checkFieldForNumber;
	window.misc_shared_lib.conformErrorObjectMsg = conformErrorObjectMsg;
	window.misc_shared_lib.delayMS_promise = delayMS_promise;
	window.misc_shared_lib.extractPropertyFromObj = extractPropertyFromObj;
	window.misc_shared_lib.getRandomString = getRandomString;
	window.misc_shared_lib.getSimplifiedUuid =getSimplifiedUuid;
	window.misc_shared_lib.isEmptyOrWhitespaceString = isEmptyOrWhitespaceString;
	window.misc_shared_lib.isEmptySafeString = isEmptySafeString;
	window.misc_shared_lib.isFalseOrStrFalse = isFalseOrStrFalse;
	window.misc_shared_lib.isNonNullObjectAndNotArray = isNonNullObjectAndNotArray;
	window.misc_shared_lib.isProcessGlobalVarPresent = isProcessGlobalVarPresent;
	window.misc_shared_lib.isTrueOrStrTrue = isTrueOrStrTrue;
	window.misc_shared_lib.makeStringSafe = makeStringSafe;
	window.misc_shared_lib.nowDateTime = nowDateTime;
	window.misc_shared_lib.parseJsonStringToObjectOfType = parseJsonStringToObjectOfType;
	window.misc_shared_lib.parseIntOrNull = parseIntOrNull;
	window.misc_shared_lib.promiseAllWithResultObjects_promise = promiseAllWithResultObjects_promise;
	window.misc_shared_lib.PromiseThenBlockSkippedResult = PromiseThenBlockSkippedResult;
	window.misc_shared_lib.secondsToHoursMinutesSecondsString = secondsToHoursMinutesSecondsString;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			buildErrPrefixFromCalleeAndCaller: buildErrPrefixFromCalleeAndCaller,
			bufferToByteArray: bufferToByteArray,
			checkFieldForNumber: checkFieldForNumber,
			conformErrorObjectMsg: conformErrorObjectMsg,
			delayMS_promise: delayMS_promise,
			extractPropertyFromObj: extractPropertyFromObj,
			getRandomString: getRandomString,
			getRandomString: getRandomString,
			getSimplifiedUuid: getSimplifiedUuid,
			isEmptyOrWhitespaceString: isEmptyOrWhitespaceString,
			isEmptySafeString: isEmptySafeString,
			isFalseOrStrFalse: isFalseOrStrFalse,
			isNonNullObjectAndNotArray: isNonNullObjectAndNotArray,
			isProcessGlobalVarPresent: isProcessGlobalVarPresent,
			isTrueOrStrTrue: isTrueOrStrTrue,
			makeStringSafe: makeStringSafe,
			nowDateTime: nowDateTime,
			parseIntOrNull: parseIntOrNull,
			parseJsonStringToObjectOfType: parseJsonStringToObjectOfType,
			promiseAllWithResultObjects_promise: promiseAllWithResultObjects_promise,
			PromiseThenBlockSkippedResult: PromiseThenBlockSkippedResult,
			secondsToHoursMinutesSecondsString: secondsToHoursMinutesSecondsString
		};
}
