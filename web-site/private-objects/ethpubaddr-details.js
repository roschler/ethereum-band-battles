/**
 * This file contains the code related to the various Ethereum public addresses that are part of the game.
 *
 * 	IT SHOULD NOT BE SHARED WITH THE CLIENT CODE!
 */

const misc_shared_lib = require('../public/javascripts/misc/misc-shared');

/**
 * Validate a payment details object.
 *
 * @param {Object} objToValidate - The object to validate as an Ethereum public address details object.
 */
function validateEthPubAddr(objToValidate)
{
	var errPrefix = '(validateEthPubAddr) ';
	
	if (misc_shared_lib.isEmptySafeString(objToValidate.id))
		throw new Error(errPrefix + 'The object is missing a primary ID.');
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');

	// We must have an group ID.
	if (misc_shared_lib.isEmptySafeString(objToValidate.groupId))
		throw new Error(errPrefix + 'The group ID is empty.');
		
	// We must have an owner ID.
	if (misc_shared_lib.isEmptySafeString(objToValidate.ownerId))
		throw new Error(errPrefix + 'The owner ID is empty.');
		
	// We must have an Ethereum public address.
	if (misc_shared_lib.isEmptySafeString(objToValidate.ethereumPublicAddress))
		throw new Error(errPrefix + 'The Ethereum public address is empty.');
		
}

/**
 * This object holds the details for a particular Ethereum public address.
 *
 * @return {EthPubAddrDetails}
 *
 * @constructor
 */
function EthPubAddrDetails()
{
	var self = this;
	
    // Make a user ID for this object.
    this.id = 'ethpubaddr_' + misc_shared_lib.getSimplifiedUuid()
	
    /** @property {String} groupId - The ID of the group (context) the owner ID belongs to.  For example,
 	 * 	the game a user/ player belongs to in an EtherBandBattles game. */
    this.groupId = null;
    
    /** @property {String} userId - The ID of the entity that owns this Ethereum public address.  For example,
 	 * 	the user ID of a player in an EtherBandBattles game. */
    this.ownerId = null;
    
    /** @property {String} ethereumPublicAddress - The Ethereum public address this object holds. */
    this.ethereumPublicAddress = null;
    
    /**
	 * Validate this Ethereum public address details object.
	 */
	this.validateMe = function ()
	{
		return validateEthPubAddr(self);
	}
	
    // Return a reference to this object to support method chaining.
    return self;
}

module.exports =
	{
		EthPubAddrDetails: EthPubAddrDetails
	};

