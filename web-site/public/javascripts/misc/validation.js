/**
 * This module contains objects and code to help with various validation tasks.
 */

const misc_shared_lib = require('./misc-shared');

/**
 * This object provides the relevant state information for an object that has a validateMe()
 * 	method, describing how that method should be called.
 *
 * @type {Readonly<{DO_NOT_VALIDATE: string, SIMPLE_VALIDATION: string, ADVANCED_VALIDATION: string}>}
 */
const EnumValidateMeTypes = Object.freeze(
		{
			// Do not call the validateMe() method on a certain object.
			"DO_NOT_VALIDATE": "do not validate",
			// Call the validateMe() method on a certain object with the
			//  advanced validation flag set to FALSE.
			"SIMPLE_VALIDATION": "simple validation",
			// Call the validateMe() method on a certain object with the
			//  advanced validation flag set to TRUE.
			"ADVANCED_VALIDATION": "advanced validation"
		}
	);

/**
 * This method returns TRUE if the given validation type matches one of the constants in the
 * 	EnumValidateMeTypes enum.  Otherwise it returns FALSE.
 *
 * @param {string} valType - The validation type to validate.
 *
 * @return {boolean}
 */
function isValidValidateMeType(valType) {
	let errPrefix = '(isValidValidateMeType) ';
	
	if (misc_shared_lib.isEmptySafeString(valType))
		throw new Error(errPrefix + 'The validation type is empty.');
	
	return (
		valType == EnumValidateMeTypes.DO_NOT_VALIDATE
			||
		valType == EnumValidateMeTypes.SIMPLE_VALIDATION
			||
		valType == EnumValidateMeTypes.ADVANCED_VALIDATION);
}
	
module.exports = {
	EnumValidateMeTypes: EnumValidateMeTypes,
	isValidValidateMeType: isValidValidateMeType
}