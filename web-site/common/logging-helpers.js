/**
 * This file contains code that helps with logging.
 *
 */

const moment_lib = require('moment');
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');

/**
 * This function formats a date/time variable using the default format we prefer for
 * 	logging purposes.
 *
 * @param {Date} [dt] - The date/time variable to format.  If a value is not
 * 	provided, then Date.now() will be used for the date/time value.
 *
 * @return {string}
 */
function formatDateTimeForLogging_default(dt) {
	let errPrefix = '(formatDateTimeForLogging_default) ';
	
	if (typeof dt == 'undefined')
		dt = Date.now();
	
	if (typeof dt != 'number')
		throw new Error(errPrefix + 'The value in the dt parameter is not a number or is unassigned.');
	
	return moment_lib(dt).format("YYYY-MM-DD HH:mm:ss:S");
}

/**
 * DELETED: The "callee" object was removed due to security issues making this function useless.

 * This method takes a Javascript function's "arguments" object and extracts out the method
 * 	name.
 *
 * 	NOTE: This function will fail (i.e. - throw an Error) with anonymous function since
 * 		there is no method name.
 *
 * @param {Object} arguments
 *
 * @return {string} - Returns the name of the currently executing method that passed us the
 * 	"arguments" value or whatever method that parameter value belongs to.
 *
function getAndFormatCalleeName(arguments) {
	let errPrefix = '(getAndFormatCalleeName) ';
	
	let regex = new RegExp(/function\s*(.*?)\s*\(/);
	
	if (!arguments)
		throw new Error(errPrefix + 'The arguments parameter is empty.');
		
	if (!arguments.hasOwnProperty('callee'))
		throw new Error(errPrefix + 'The arguments parameter does not have a "callee" property.');
		
	let methodName = arguments.callee.toString().trim();
	
	// Decorated method name?
	let reMatch = regex.exec(methodName);
	
	if (reMatch) {
		// Yes.  The method name should be in the first group.
		if (reMatch.length < 1)
			throw new Error(errPrefix + 'The regular expression for method names matched but did is missing the required capture group for the method name.');
		
		let retMethodName = regex[1].trim();
		
		if (misc_shared_lib.isEmptySafeString(retName))
			throw new Error(errPrefix + 'The method name captured by the regular expression is empty.');

		return retMethodName;
	}
	else
		// Just return the method name as is.
		return methodName;
}
*/

module.exports = {
	// getAndFormatCalleeName: getAndFormatCalleeName,
	formatDateTimeForLogging_default: formatDateTimeForLogging_default
}