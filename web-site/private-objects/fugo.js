/**
 * This file contains objects and code that are frequently used throughout the server side code that
 *  is specific to the EtherBandBattles dApp.
 *
 *  FUGO = Frequently Used Game Objects.
 *  SSO = Server-side only.
 *
 * @constructor
 */
 
const EnumValidateMeTypes = require('../public/javascripts/misc/validation').EnumValidateMeTypes;
const isValidValidateMeType = require('../public/javascripts/misc/validation').isValidValidateMeType;
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const redis_wrappers_lib = require('../common/redis-wrappers');
const PromiseThenBlockSkippedResult = require('../public/javascripts/misc/misc-shared').PromiseThenBlockSkippedResult;

const EthPubAddrDetails = require('../private-objects/ethpubaddr-details').EthPubAddrDetails;
const GameDetails = require('../public/javascripts/game-objects/game-details').GameDetails;
const UserDetails = require('../public/javascripts/game-objects/user-details').UserDetails;

/**
 * Constants needed by this code module.
 *
 * @constructor
 */
var FugoConstants_ebb = new function () {
    // Constant passed to the FugoObjects_ebb_sso object constructor that explicitly
    //   tells it NOT to look up an object from Redis, usually because it doesn't
    //   exist yet.
    this.ID_DO_NOT_GET_OBJECT = 'ID_DO_NOT_GET_OBJECT';
};

/**
 * This method returns TRUE if the given ID is the constant that tells us not to
 * 	retrieve a particular object, FALSE if it does not.
 *
 * @param {string} id - The ID to evaluate.
 * @return {boolean}
 */
function isDoNotGetObjId(id) {
	let errPrefix = '(isDoNotGetObjId) ';
	
	if (misc_shared_lib.isEmptySafeString(id))
		throw new Error(errPrefix + 'The ID is empty.');
		
	return (id == FugoConstants_ebb.ID_DO_NOT_GET_OBJECT);
}

/**
 * This object aggregates the following frequently used game objects
 *
 * 	GameDetails - the relevant EtherBandBattles game.
 * 	UserDetails - typically the user submitting a client side request (e.g. - the game creator, etc.)
 *	(ethereum public address) - The Ethereum public address of the relevant user.
 *
 * @param {string} gameId - The ID of the relevant game.  A fresh copy of the game will be looked
 * 	up from Redis using the given ID.
 * @param {string} enGameValType - This enum tells this method how the
 *   game object's validateMe() method should be called.  It MUST be set to DO_NOT_VALIDATE
 *   if the given game ID is set to the ID_DO_NOT_GET_OBJECT constant.
 * @param {string} userId - The ID of the relevant user (e.g. - game creator, player being added, etc.)
 * 	NOTE!: If you don't want the user record to be looked up you MUST Use the ID_DO_NOT_GET_OBJECT
 * 		constant.  Otherwise an error will be thrown if that ID is invalid OR if the user doesn't
 * 		exist in Redis y et!
 * @param {string} enUserValType - This enum tells this method how the
 *   user object's validateMe() method should be called.  It MUST be set to DO_NOT_VALIDATE
 *   if the given user ID is set to the ID_DO_NOT_GET_OBJECT constant.
 * @param {boolean} isUserEthPublicAddrToBeGotten - If TRUE, then the Ethereum public address of for the given
 * 	user ID will be retrieved from Redis.  If FALSE it will not be retrieved.  Setting this parameter
 * 	to TRUE while using ID_DO_NOT_GET_OBJECT constant will result in an error.
 *
 * @constructor
 */
function FugoObjects_ebb_sso(
     gameId,
     enGameValType,
     userId,
     enUserValType,
     isUserEthPublicAddrToBeGotten) {
     
     var self = this;
     
     let objName = 'FugoObjects_ebb_sso';
     
     let errPrefix = '(' + objName + ') ';
     let errObjPrefix = '(' + objName + '::';
     
    // ------------------------- PROPERTIES -----------------------
    
    // ---------------- PROPERTIES TO STORE THE CONSTRUCTOR PARAMETER   --------------
    
    /** @property {string} - The ID of the game to retrieve or ID_DO_NOT_GET_OBJECT. */
    this.gameId = null;
    
    /** @property {EnumValidateMeTypes} - The validation type to use for the game object we carry. */
    this.enGameValType = null;
    
    /** @property {string} - The ID of the user to retrieve or ID_DO_NOT_GET_OBJECT. */
    this.userId = null;
	
    /** @property {EnumValidateMeTypes} - The validation type to use for the user object we carry. */
    this.enUserValType = null;
	
	/** @property {boolean} - If TRUE, then the Ethereum public address of for the given user ID
	 *	will be retrieved from Redis.  If FALSE it will not be retrieved.
	 */
	this.isUserEthPublicAddrToBeGotten = null;
    
    /** @property {EthPubAddrDetails} - The Ethereum public address details object for the user contained
     * in the user details object (if one was retrieved). */
    this.ethPubAddrDetailsObj = null;
	
    
    // ---------------- THESE PROPERTIES ARE FILLED IN BY getObjects_promise() ---------------
	
	/** @property {GameDetails|null} - This field will carry a game details object if the
	 *		game ID given at constructor time was not set to ID_DO_NOT_GET_OBJECT.  Otherwise
	 *		it will remain NULL.
	 */
	this.gameDetailsObj = null;
 
	/** @property {UserDetails|null} - This field will carry a user details object if the
	 *		user ID given at constructor time was not set to ID_DO_NOT_GET_OBJECT.  Otherwise
	 *		it will remain NULL.
	 */
	this.userDetailsObj = null;
    
	/**
	 * Validate an ID against a validation type value.
	 *
	 * @param {string} objDesc - A short description of the object to use in
	 *    error messages, if needed.
	 * @param {string} id - The ID to validate.
	 * @param {EnumValidateMeTypes} valType - The validation type to validate the ID against.
	 *
	 * @private
	 */
	this._validateIdAgainstValType = function(objDesc, id, valType) {
        let errPrefix = errObjPrefix + '_validateIdAgainstValType) ';
          
        if (misc_shared_lib.isEmptySafeString(objDesc))
        	throw new Error(errPrefix + 'The object description is empty.');
          
		if (misc_shared_lib.isEmptySafeString(id))
			throw new Error(errPrefix + 'The ' + objDesc + ' ID is empty.');

		if (misc_shared_lib.isEmptySafeString(valType))
			throw new Error(errPrefix + 'The ' + objDesc + ' validation type is empty.');

		if (!isValidValidateMeType(valType))
			throw new Error(errPrefix + 'Invalid ' + objDesc + ' validation type: ' + valType);

		if (isDoNotGetObjId(id) && valType != EnumValidateMeTypes.DO_NOT_VALIDATE)
			throw new (errPrefix + 'The ' + objDesc + ' ID is set to "do not get object" but the validation type is not set to that.');
	}
	
	/**
	 * Validate the given object using the given validation type as a guide in how to
	 * 	call the object's validateMe() method.
	 *
	 * @param {string} objDesc - A short description of the object to use in
	 *    error messages, if needed.
	 * @param {Object|null} obj - The object to validate.  The object may be NULL
	 * 	if DO_NOT_VALIDATE constant was used for the object's ID when this object
	 * 	was constructed.
	 * @param {EnumValidateMeTypes} valType - The validation type to validate the ID against.
	 * 
	 * @private
	 */
	this._validateObjAccordingToValType = function(objDesc, obj, valType) {
        let errPrefix = errObjPrefix + '_validateObjAccordingToValType) ';
        
        if (misc_shared_lib.isEmptySafeString(objDesc))
        	throw new Error(errPrefix + 'The object description is empty.');
         
        if (!isValidValidateMeType(valType))
			throw new Error(errPrefix + 'Invalid ' + objDesc + ' validation type: ' + valType);
   
		if (valType == EnumValidateMeTypes.DO_NOT_VALIDATE) {
			// Do not validate the object.
		} else  if (valType == EnumValidateMeTypes.SIMPLE_VALIDATION) {
			// Simple validation.
			obj.validateMe(valType);
		} else  if (valType == EnumValidateMeTypes.ADVANCED_VALIDATION) {
			// Advanced validation.
			obj.validateMe(valType);
		}
		else {
			// We don't know how to handle the given validation type, despite it being
			//  a valid type according to the isValidValidateMeType() method.
			throw new Error(errPrefix + 'Do not know how to handle validation type(' + valType + ') for the ' + objDesc + ' object');
		}
	}
	
	/**
	 * Validate the given object using the given validation type as a guide in how to
	 * 	call the object's validateMe() method.
	 *
	 * @param {string} objDesc - A short description of the object to use in
	 *    error messages, if needed.
	 * @param {string} - The ID of the object.
	 * @param {Object|null} obj - The object to validate.
	 * @param {EnumValidateMeTypes} valType - The validation type to validate the ID against.
	 *
	 * @private
	 */
	this._validateOneObject = function(objDesc, id, obj, valType) {
        let errPrefix = errObjPrefix + '_validateObjAccordingToValType) ';
        
        if (misc_shared_lib.isEmptySafeString(objDesc))
        	throw new Error(errPrefix + 'The object description is empty.');
         
        if (misc_shared_lib.isEmptySafeString(id))
        	throw new Error(errPrefix + 'The ' + objDesc + ' ID is empty.');
         
        if (!isValidValidateMeType(valType))
			throw new Error(errPrefix + 'Invalid ' + objDesc + ' validation type: ' + valType);
			
		// Is the ID set to the "do not get object" constant?
		if (isDoNotGetObjId(id)) {
			// Yes, then the associated object parameter MUST be NULL or something went wrong,
			// 	like the object being retrieved when it shouldn't have been.
			if (obj != null)
				throw new Error(errPrefix + 'The ' + objDesc + ' ID is set to the "do not get object" constant, yet we have a non-NULL value for the relevant object property.');
		}
		else {
			// No.  Do the validation.
			self._validateObjAccordingToValType(objDesc, obj, valType);
		}
	}
	
	/**
	 * After retrieving the objects, validate them.
	 *
 	 * @private
	 */
	this._validateMeAfterRetrieval = function() {
        let errPrefix = errObjPrefix + '_validateMeAfterRetrieval) ';
		
		// Validate the game details object.
		self._validateOneObject('game', self.gameId, self.gameDetailsObj, self.enGameValType);
		
		// Validate the user details object.
		self._validateOneObject('user', self.userId, self.userDetailsObj, self.enUserValType);
		
		// Should we validate the user's Ethereum public address?
		if (self.isUserEthPublicAddrToBeGotten) {
			if (!self.ethPubAddrDetailsObj)
				throw new Error(errPrefix + 'The Ethereum public address details object is unassigned.');
			
			if (!(self.ethPubAddrDetailsObj instanceof EthPubAddrDetails))
				throw new Error(errPrefix + 'The object assigned to the Ethereum public address details object is not an EthPubAddrDetails object.');
				
			// Validate it.
			self.ethPubAddrDetailsObj.validateMe();
		}
	}
	
	/**
	 * Call this method to actually effect the retrieval of the objects this object aggregates
	 * 	using the ID's given when this object was construction.  The object's will be
	 * 	validated after retrieval according to the settings given during this object's
	 * 	construction.
	 *
	 * 	@return {Promise}
	 */
	this.getObjects_promise = function() {
		
		return new Promise(function(resolve, reject) {
			try
			{
				let errPrefix = errObjPrefix + 'getObjects_promise) ';
		
				// ----
				
				let promiseToExec;
				
				// Retrieve a game details object?
				if (!isDoNotGetObjId(self.gameId))
					// Yes.  Get a fresh copy of the game object using the given game ID.
					promiseToExec = redis_wrappers_lib.getGame_promise(self.gameId);
				else
					// Just return FALSE so the next THEN block knows not to validate the return
					//  of the previous THEN block.
					promiseToExec = Promise.resolve(new PromiseThenBlockSkippedResult());
				
				// Execute the promise.
				promiseToExec
				.then(result => {
					if (result instanceof PromiseThenBlockSkippedResult) {
						// The previous THEN block is letting us know not to validate it's result.
					}
					else {
						if (!(result instanceof GameDetails))
							throw new Error(errPrefix + "The result of the Redis get game call was invalid.");
							
						// Save it.  Don't validate it.  That's done later.
						self.gameDetailsObj = result;
					}
					
					// Retrieve a user details object?
					if (!isDoNotGetObjId(self.userId))
						// Yes.  Get a fresh copy of the user object using the given user ID.
						return redis_wrappers_lib.getUser_promise(self.gameId, self.userId);
					else
						// Return the object that lets successive blocks in this promise chain
						//  know not to continue processing.
						return Promise.resolve(new PromiseThenBlockSkippedResult());
				}).then(result => {
					if (result instanceof PromiseThenBlockSkippedResult) {
						// The previous THEN block is letting us know not to validate it's result.
					}
					else {
						if (!(result instanceof UserDetails))
							throw new Error(errPrefix + "The result of the Redis get user call was invalid.");
							
						// Save it.  Don't validate it.  That's done later.
						self.userDetailsObj = result;
					}
					
					// Get the Ethereum public address for the user?
					if (self.isUserEthPublicAddrToBeGotten)
						return redis_wrappers_lib.getEthPubAddr_promise(self.gameId, self.userId);
					else
						// Return the object that lets successive blocks in this promise chain
						//  know not to continue processing.
						return Promise.resolve(new PromiseThenBlockSkippedResult());
				})
				.then(result => {
					if (result instanceof PromiseThenBlockSkippedResult) {
						// The previous THEN block is letting us know not to validate it's result.
					}
					else {
						if (!(result instanceof EthPubAddrDetails))
							throw new Error(errPrefix + 'The object returned by Redis is not a EthPubAddrDetails object.');
							
						// Save it.  Don't validate it.  That's done later.
						self.ethPubAddrDetailsObj = result;
					}
					
					// Now validate everything.
					self._validateMeAfterRetrieval();
					
					// Just resolve the promise with TRUE.
					resolve(true);
				})
				.catch(err =>
				{
					// Reject the promise with the error object.
					reject(err);
				});
			}
			catch(err)
			{
				// Reject the promise with the error object.
				reject(err);
			}
		});
	}
	
	// ------------------------ VALIDATE CONSTRUCTOR PARAMETERS --------------------
	
	if (misc_shared_lib.isEmptySafeString(gameId))
		throw new Error(errPrefix + 'The game is empty.');
		
	if (!isValidValidateMeType(enGameValType))
		throw new Error(errPrefix + 'Invalid game validation type: ' + enGameValType);
	
	if (misc_shared_lib.isEmptySafeString(userId))
		throw new Error(errPrefix + 'The user is empty.');
		
	if (!isValidValidateMeType(enUserValType))
		throw new Error(errPrefix + 'Invalid user validation type: ' + enUserValType);
	
	// Validate the game ID against the validation type.
	this._validateIdAgainstValType('game', gameId, enGameValType);
	
	// Validate the user ID against the validation type.
	this._validateIdAgainstValType('user', userId, enUserValType);
	
	if (typeof isUserEthPublicAddrToBeGotten != 'boolean')
		throw new Error(errPrefix + 'The isUserEthPublicAddrToBeGotten parameter is missing or not of type boolean.');
	
	// To get the Ethereum public address we must have both a valid game and user ID.
	if (isUserEthPublicAddrToBeGotten)
	{
		if (isDoNotGetObjId(gameId) && isDoNotGetObjId(userId))
			throw new Error(errPrefix + 'The flag to get the Ethereum public address for the user is TRUE but the user ID and the game ID are both set to the "do not get object" constant. ');
		if (isDoNotGetObjId(gameId))
			throw new Error(errPrefix + 'The flag to get the Ethereum public address for the user is TRUE but the game ID is set to the "do not get object" constant. ');
		if (isDoNotGetObjId(userId))
			throw new Error(errPrefix + 'The flag to get the Ethereum public address for the user is TRUE but the user ID is set to the "do not get object" constant. ');
	}
	
	// Store the parameters for use by the getObjects_promise() method.
	self.gameId = gameId;
	self.enGameValType = enGameValType
	self.userId = userId;
	self.enUserValType = enUserValType
	self.isUserEthPublicAddrToBeGotten = isUserEthPublicAddrToBeGotten;
 
	// ------------------------ CONSTRUCTOR BODY --------------------
}

module.exports = {
	FugoConstants_ebb: FugoConstants_ebb,
	FugoObjects_ebb_sso: FugoObjects_ebb_sso,
	isDoNotObjGetId: isDoNotGetObjId
}