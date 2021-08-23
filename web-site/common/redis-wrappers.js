/**
 * This file contains wrapper calls that takes care of the hash name building necessary
 * 	to service the various memory tables we store in Redis.
*/

/** TODO: The ADD calls actually do a replacement if an existing hash-name/field-name pair
 * exists for the given pair.  Refactor the code later to make this clearer.
 */

/**
 * TODO: When we start deleting Redis elements (clean-up), we will need to delete the associated
 * 	XREF objects, like those created for game details objects, etc.
 *
 */

const redis_support_lib = require('./redis-support');
const common_routines = require("../common/common-routines");
const misc_shared_lib = require("../public/javascripts/misc/misc-shared");
const PromiseThenBlockSkippedResult = require("../public/javascripts/misc/misc-shared").PromiseThenBlockSkippedResult;
const user_details = require('../public/javascripts/game-objects/user-details');
const band_details = require('../public/javascripts/game-objects/band-details');
const EthPubAddrDetails = require('../private-objects/ethpubaddr-details').EthPubAddrDetails;
const video_bookmark_details = require('../public/javascripts/game-objects/video-bookmark-details');
const game_details_lib = require('../public/javascripts/game-objects/game-details');
const private_payment_details_lib = require('../private-objects/private-payment-details');
const lodash_lib = require('lodash');
const GameDetailsServerSideOnly = require('./game-details-server-side-only').GameDetailsServerSideOnly;
const PaymentMadeRecord = require('./payment-made-record').PaymentMadeRecord;
const conformErrorObjectMsg = require("../public/javascripts/misc/misc-shared").conformErrorObjectMsg;

// Prefix we apply to all Redis primary keys to separate store values by application name.
var g_RedisNameSpace = 'crypto-band-battles';

// ------------------------------ COMMON CODE ------------------------------

// The prefix we append to a field name to make it a table name.
var _tableNamePrefix = 'table_name';

/**
 * This method creates an Object that has the details for a wrapper call.
 *
 * @param {string} hashName - The hash name to use when querying Redis for the desired
 * 	object type.
 * @param {string} errPromptHashName - The error prompt to use when throwing an error
 * 	if the hash name is invalid.
 * @param {string} fieldName - The hash name to use when querying Redis for the desired
 * 	object type.
 * @param {string} baseTableName - The table name to use when querying Redis for the desired
 * 	object type.
 * @param {string} errPromptFieldName - The error prompt to use when throwing an error
 * 	if the field name is invalid.
 * @param objOfType - The type name of the object to create.  It must have a parameterless
 * 	constructor.
 *
 * @constructor
 */
function WrapperDetailsObject(
	hashName,
	errPromptHashName,
	fieldName,
	errPromptFieldName,
	baseTableName,
	objOfType)
{
	var errPrefix = '(WrapperDetailsObject) ';

	if (misc_shared_lib.isEmptySafeString(hashName))
		throw new Error(errPrefix + 'The hash name parameter is empty.');
	if (misc_shared_lib.isEmptySafeString(errPromptHashName))
		throw new Error(errPrefix + 'The hash name error prompt parameter is empty.');
	if (misc_shared_lib.isEmptySafeString(fieldName))
		throw new Error(errPrefix + 'The field name parameter is empty.');
	if (misc_shared_lib.isEmptySafeString(errPromptFieldName))
		throw new Error(errPrefix + 'The field name error prompt parameter is empty.');
	if (misc_shared_lib.isEmptySafeString(baseTableName))
		throw new Error(errPrefix + 'The base table name parameter is empty.');
	if (typeof objOfType == 'undefined' || objOfType == null)
		throw new Error(errPrefix + 'The object of type parameter is unassigned.');
		
	// See the constructor doc comments for details on these data members.
	this.hashName = hashName;
	this.errPromptHashName = errPromptHashName;
	this.fieldName = fieldName;
	this.errPromptFieldName = errPromptFieldName;
	this.baseTableName = baseTableName;
	this.objOfType = objOfType;
}

/**
 * Simple object we use with a Redis table so we can look up the server side game ID for a given
 * 	smart contract game ID.
 *
 * @constructor
 */
function XRefEbbGameIdToServerId() {
	var self = this;
	let objectName = 'XRefEbbGameIdToServerId';
	let methodName = objectName + '::' + 'constructor';
	let errPrefix = '(' + methodName + ') ';
	
	/** @property {number} - The smart contract's ID for one of our games */
	this.idInSmartContract = null;
	
	/** @property {string} - The server side ID for the same game. */
	this.gameId = null;
	
	this.validateMe = function() {
		common_routines.validateAsIntegerGreaterThanZero(methodName, self.idInSmartContract);
		
		if (misc_shared_lib.isEmptySafeString(self.gameId))
			throw new Error(errPrefix + 'The self.gameId parameter is empty.');
	}
}

/**
 * This method decorates the game ID provided with the name space prefix
 * 	for this application and the "table name" given to create a hash name
 * 	that can be used to emulate the concept of a table in Redis.
 *
 *
 * @param {string} hashName - The hash name we are targeting
 * @param {string} baseTableName - The base name of the table we want to store in Redis.  This
 * 	value is appended to the application segregating label to emulate the idea of
 * 	a table in Redis, along with a special prefix to identify it as a table name.
 *
 * @returns {string} - The fully decorated hash name.
 */
function buildRedisKeyForHashAndTableName(hashName, baseTableName)
{
    var errPrefix = "(" + arguments.callee.name + ") ";

    if (misc_shared_lib.isEmptySafeString(hashName))
        throw new Error(errPrefix + "The hash name parameter is empty.");
        
    if (misc_shared_lib.isEmptySafeString(baseTableName))
        throw new Error(errPrefix + "The table name parameter is empty.");
        
	return g_RedisNameSpace + ':' + hashName + ':' + _tableNamePrefix + '_' + baseTableName;
}

/**
 * This method returns a promise that adds an object from Redis of the type
 * 	and to the table defined in the wrapper details object.
 *
 * @param {Object} wrapperDetailsObj - A valid wrapper details object that defines the
 * 	details needed to call Redis properly.
 *
 * 	@return {Promise} - Returns a promise that executes the desired Redis call.
 */
var addObject_promise = function(wrapperDetailsObj)
{
	var errPrefix = '(addObject_promise) ';
	
	if (typeof wrapperDetailsObj == 'undefined' || wrapperDetailsObj == null)
		throw new Error(errPrefix + 'The wrapper details object is unassigned.');

	// Validate the parameters of the wrapper details object.
	if (misc_shared_lib.isEmptySafeString(wrapperDetailsObj.hashName))
		// Throw an error using the error prompt defined in the wrapper details object.
		throw new Error(wrapperDetailsObj.errPromptHashName);
		
	if (misc_shared_lib.isEmptySafeString(wrapperDetailsObj.fieldName))
		// Throw an error using the error prompt defined in the wrapper details object.
		throw new Error(wrapperDetailsObj.errPromptFieldName);
		
	// Timestamp the object.
	wrapperDetailsObj.objOfType.timeStampedByServer = misc_shared_lib.nowDateTime();
		
	let strUserObj = JSON.stringify(wrapperDetailsObj.objOfType);
	let decoratedHashName = buildRedisKeyForHashAndTableName(wrapperDetailsObj.hashName, wrapperDetailsObj.baseTableName);
	
	return redis_support_lib.setString_To_Redis_promise(decoratedHashName, wrapperDetailsObj.fieldName, strUserObj);
}

/**
 * This method returns a promise that gets an object from Redis of the type
 * 	and from the table defined in the wrapper details object.
 *
 * @param {Object} wrapperDetailsObj - A valid wrapper details object that defines the
 * 	details needed to call Redis properly.
 *
 * 	@return {Promise} - Returns a promise that executes the desired Redis call.
 */
var getObject_promise = function(wrapperDetailsObj)
{
	let errPrefix = '(getObject_promise) ';
	
	if (typeof wrapperDetailsObj == 'undefined' || wrapperDetailsObj == null)
		throw new Error(errPrefix + 'The wrapper details object is unassigned.');

	// Validate the parameters of the wrapper details object.
	if (misc_shared_lib.isEmptySafeString(wrapperDetailsObj.hashName))
		// Throw an error using the error prompt defined in the wrapper details object.
		throw new Error(wrapperDetailsObj.errPromptHashName);
		
	if (misc_shared_lib.isEmptySafeString(wrapperDetailsObj.fieldName))
		// Throw an error using the error prompt defined in the wrapper details object.
		throw new Error(wrapperDetailsObj.errPromptFieldName);
		
	let decoratedHashName = buildRedisKeyForHashAndTableName(wrapperDetailsObj.hashName, wrapperDetailsObj.baseTableName);
	
	return redis_support_lib.getString_From_Redis_promise(decoratedHashName, wrapperDetailsObj.fieldName)
		.then(function(redisResponse)
		{
			// Redis response should be NULL if an object could not be found, or of type STRING if it were.
			//  Anything else indicates a strange problem.
			if (redisResponse == null)
				// Object not found with the given search parameters.
				return redisResponse;
		
			if (typeof redisResponse == 'string')
				// Object found.  Return it.
				return misc_shared_lib.parseJsonStringToObjectOfType(redisResponse, wrapperDetailsObj.objOfType);
				
			throw new Error(errPrefix + 'The result of the Redis retrieval operation was invalid.  Context: searching for a ' + wrapperDetailsObj.baseTableName + ' object');
		});
};


/**
 * This function returns a promise that gets ALL the objects of the given type
 * 	using the given game ID.
 *
 * @param {string} gameId - The ID of the desired game to get the users list for.
 * @param {string} baseTableName - The base name of desired table we are storing in Redis.
 * @param objOfType - The type name of the object to create.  It must have a parameterless
 * 	constructor.
 * @return {Array} - An array of user objects from the desired table name..
 */
var getAllObjects_promise = function(gameId, baseTableName, objOfType)
{
	let errPrefix = '(getAllObjects_promise) ';
	
	if (misc_shared_lib.isEmptySafeString(gameId))
		throw new Error(errPrefix + 'The game ID is empty.');
	
	if (misc_shared_lib.isEmptySafeString(baseTableName))
		throw new Error(errPrefix + 'The table name is empty.');
	
	if (typeof objOfType == 'undefined' || objOfType ==  null)
		throw new Error(errPrefix + 'The object of type parameter is unassigned.');
		
	let decoratedHashName = buildRedisKeyForHashAndTableName(gameId, baseTableName);
	
	return redis_support_lib.getAllStrings_From_Redis_promise(decoratedHashName)
		.then(function(redisResponse)
		{
			if (typeof redisResponse == 'undefined')
				// Retrieval operation failed.
				throw new Error(errPrefix + 'The response was undefined.');
				
			let aryDetailObjects = new Array();
			
			// A null response means nothing was found for the given field name.
			//  Return an empty array to let the caller know the call worked it's
			//  just that nothing was found.
			if (redisResponse == null)
				return aryDetailObjects;
			
			// The Redis response will be an object with each property name being the ID
			//  of one of the objects and the value being the original details object
			//  for that ID in JSON string format.  Convert this back to an array of objects
			//  of the underlying type.
			for (let propName in redisResponse)
			{
				let objectId = propName;
				let strJson = redisResponse[objectId];

				// Recover the original object from the JSON string stored in Redis.
				let detailsObj = misc_shared_lib.parseJsonStringToObjectOfType(strJson, objOfType);
				
				// Accumulate the return user objects.
				aryDetailObjects.push(detailsObj);
			}
			
			return aryDetailObjects;
		});
}

// ------------------------------ WRAPPER: GAME DETAILS SERVER SIDE ONLY OBJECT -----------

const _baseTableName_game_details_server_side_only = 'game_details_server_side_only';

/**
 * This function returns a promise that adds a user to the Redis store.
 *
 * @param {string} gameId - The ID of the game the user joined.
 * @param {Object} gameDetailsServerSideOnlyObj - A game details (server side only) object that has the
 * 	server side only game details for the given game ID.
 */
var addGameDetailsServerSideOnly_promise = function(gameId, gameDetailsServerSideOnlyObj)
{
	let errPrefix = '(addGameDetailsServerSideOnly_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		// Just use the base table name as the secondary key since
		//  there's only one game details (server side only) object
		//  per game.
		_baseTableName_game_details_server_side_only,
		errPrefix + 'This should never error out.',
		_baseTableName_game_details_server_side_only,
		gameDetailsServerSideOnlyObj);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the server side only
 * 	game details object for the given game ID.
 *
 * @param {string} gameId - The ID of the game the user belongs to.
 *
 * @return {Object} - The game details (server side only) object retrieved.
 */
var getGameDetailsServerSideOnly_promise = function(gameId)
{
	let errPrefix = '(getGameDetailsServerSideOnly_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		// Just use the base table name as the secondary key since
		//  there's only one game details (server side only) object
		//  per game.
		_baseTableName_game_details_server_side_only,
		errPrefix + 'This should never error out.',
		_baseTableName_game_details_server_side_only,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addUser_promise so we just
		//  pass the object type itself.
		GameDetailsServerSideOnly);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This promise updates a single field in the server side only details object.
 *
 * @param {string} - A valid game ID.  Must be for an existing game that
 * 	already has an existing server side only details object.
 * @param {string} - The name of the field to update.
 * @param fieldValue - The fieldValue that will replace the current value of the desired field.
 * @param {number|null} gasUsedGwei - The amount of gas used in Gwei by the current Ethereum
 * 	transaction.  It may be NULL for when you want to update a field outside of a
 * 	a transaction, but not 0 or negative.
 * @param {boolean|null} bIsServerSideTransaction - If TRUE, then the transaction was
 * 	a server side transaction so we need to update the running total of gas
 * 	paid by the server for the current game.  If FALSE, then a client side
 * 	entity paid for the transaction. (e.g. - the user paid for the transaction
 * 	with Metamask).

 *
 * @return {Promise<any>} - The promise returns the updated server side only game details object.
 */
function updateServerSideOnlyDetailsField_promise(gameId, fieldName, fieldValue, gasUsedGwei = null, bIsServerSideTransaction = null) {
	let methodName = 'updateServerSideOnlyDetailsField_promise';
	let errPrefix = '(' + methodName + ') ';
	
	return new Promise(function(resolve, reject) {
		try	{
			if (misc_shared_lib.isEmptySafeString(gameId))
				throw new Error(errPrefix + 'The gameId parameter is empty.');
			
			if (misc_shared_lib.isEmptySafeString(fieldName))
				throw new Error(errPrefix + 'The fieldName parameter is empty.');
				
			if (typeof fieldValue == 'undefined' || fieldValue == null)
				throw new Error(errPrefix + 'The fieldValue parameter is unassigned.');

			// We don't allow changes to the serverPaidGasUsed field here because it would overwrite any
			//  increments made by other code.
			if (fieldName == 'serverPaidGasUsed')
				throw new Error(errPrefix + 'The fieldName parameter can not be set to "serverPaidGasUsed".');

			// The gasUsedGwei field may be NULL but not undefined.
			if (typeof gasUsedGwei == 'undefined')
				throw new Error(errPrefix + 'The gasUsedGwei parameter is unassigned.');
				
			if (gasUsedGwei != null)
			{
				common_routines.validateAsIntegerGreaterThanZero(methodName, gasUsedGwei);
			
				if (typeof bIsServerSideTransaction != 'boolean')
					throw new Error(errPrefix + 'The value in the bIsServerSideTransaction parameter is not boolean.');
			}
			
			let gameDetailsServerSideOnlyObj = null;
		
			// First, get the server side only details object with the given game ID.
			getGameDetailsServerSideOnly_promise(gameId)
			.then(redisResponse => {
				if (!(redisResponse instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The fieldValue in the redisResponse parameter is not a GameDetailsServerSideOnly object.');
				if (!redisResponse)
					throw new Error(errPrefix + 'Redis could not find a server side only game details object with the game ID: ' + gameId);
					
				gameDetailsServerSideOnlyObj = redisResponse;
				
				// The field name must match an existing property in the object.
				if (!gameDetailsServerSideOnlyObj.hasOwnProperty(fieldName))
					throw new Error(errPrefix + 'The server side only game details object does not have a property named: ' + fieldName);

				// Replace the property fieldValue with the new one.
				gameDetailsServerSideOnlyObj[fieldName] = fieldValue;
				
				if (gasUsedGwei != null) {
					// ------------------------------ GAS USED ACCUMULATION ---------------------
					
					// If this is a server side transaction, automatically accumulate any gas paid by the
					//  server in that field.
					if (bIsServerSideTransaction && gasUsedGwei != null)
						gameDetailsServerSideOnlyObj.serverPaidGasUsed += gasUsedGwei;
				}
					
				// Update Redis.
				return addGameDetailsServerSideOnly_promise(gameId, gameDetailsServerSideOnlyObj);
			})
			.then(redisResponse =>
			{
				// TODO: Validate RedisResponse.
				
				// Resolve the promise with the updated server side only game details object.
				resolve(gameDetailsServerSideOnlyObj);
			})
			.catch(err => {
				// Convert the error to a promise rejection.
				let errMsg =
					errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
				
				reject(errMsg + ' - promise');
			});
		}
		catch(err) {
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
			
			reject(errMsg + ' - try/catch');
		}
	});
}

/**
 * This function increments the given gas-used-Gwei field by amount given in the gasUsedGwei parameter.
 *
 * @param {string} - A valid game ID.  Must be for an existing game that
 * 	already has an existing server side only details object.
 * @param {string} - The name of the gas-used field to update.  If NULL, then no changes will be
 * 	made to the server side only game details object except for that of accumulating the gasUsedGwei
 * 	value in the property that tracks that and only if bIsServerSideTransaction is TRUE.
 * @param {number} gasUsedGwei - The amount of gas used in Gwei by the current Ethereum
 * 	transaction.
 * @param {boolean} bIsServerSideTransaction - If TRUE, then the transaction was
 * 	a server side transaction so we need to update the running total of gas
 * 	paid by the server for the current game.  If FALSE, then a client side
 * 	entity paid for the transaction. (e.g. - the user paid for the transaction
 * 	with Metamask).
 *
 * @return {Promise<any>} -  * @return {Promise<any>} - The promise returns the updated server side only game details object.
 */
function updateSSOGameDetailsGasUsed_promise(gameId, fieldName, gasUsedGwei, bIsServerSideTransaction) {
	let methodName = 'updateSSOGameDetailsGasUsed_promise';
	let errPrefix = '(' + methodName + ') ';
	
	return new Promise(function(resolve, reject) {
		try	{
			if (misc_shared_lib.isEmptySafeString(gameId))
				throw new Error(errPrefix + 'The gameId parameter is empty.');
			
			// NULL or a valid string is allowed for the field name, nothing else.
			if (fieldName !== null && misc_shared_lib.isEmptySafeString(fieldName))
				throw new Error(errPrefix + 'The fieldName parameter is empty.');
				
			// Passing NULL for the field name for client side transactions is an error since no changes
			//  at all will be made to the server side only game details object.
			if (fieldName === null && !bIsServerSideTransaction)
				throw new Error(errPrefix + 'The field name is NULL and bIsServerSideTransaction is FALSE.  That is not allowed.');
			
			if (fieldName == 'serverPaidGasUsed')
				throw new Error(errPrefix + 'The fieldName parameter can not be set to "serverPaidGasUsed".');
				
			if (typeof gasUsedGwei == 'undefined' || gasUsedGwei == null)
				throw new Error(errPrefix + 'The gasUsedGwei parameter is unassigned.');
				
			// The gas-used-Gwei value must be a positive integer.
			common_routines.validateAsIntegerGreaterThanZero(methodName, gasUsedGwei);
			
			if (typeof bIsServerSideTransaction != 'boolean')
				throw new Error(errPrefix + 'The value in the bIsServerSideTransaction parameter is not boolean.');
				
			let gameDetailsServerSideOnlyObj = null;
			
			// First, get the server side only details object with the given game ID.
			getGameDetailsServerSideOnly_promise(gameId)
			.then(redisResponse => {
				if (!(redisResponse instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The fieldValue in the redisResponse parameter is not a GameDetailsServerSideOnly object.');
				if (!redisResponse)
					throw new Error(errPrefix + 'Redis could not find a server side only game details object with the game ID: ' + gameId);
					
				gameDetailsServerSideOnlyObj = redisResponse;
				
				// Are we updating a specific field?
				if (fieldName !== null) {
					// The field name must match an existing property in the object.
					if (!gameDetailsServerSideOnlyObj.hasOwnProperty(fieldName))
						throw new Error(errPrefix + 'The server side only game details object does not have a property named: ' + fieldName);

					// Increment the property fieldValue by the amount in the gasUsedGwei parameter.
					gameDetailsServerSideOnlyObj[fieldName] += gasUsedGwei;
				}
				
				// If this is a server side transaction, automatically accumulate any gas paid by the
				//  server in that field.
				if (bIsServerSideTransaction)
					gameDetailsServerSideOnlyObj.serverPaidGasUsed += gasUsedGwei;
				
				// Update Redis.
				return addGameDetailsServerSideOnly_promise(gameId, gameDetailsServerSideOnlyObj);
			})
			.then(redisResponse =>
			{
				// TODO: Validate RedisResponse.
				
				// Resolve the promise with the updated server side only game details object.
				resolve(gameDetailsServerSideOnlyObj);
			})
			.catch(err => {
				// Convert the error to a promise rejection.
				let errMsg =
					errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
				
				reject(errMsg + ' - promise');
			});
		}
		catch(err) {
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);
			
			reject(errMsg + ' - try/catch');
		}
	});
}


// ------------------------------ WRAPPER: XREF EBB GAME ID OBJECT -----------

const _baseTableName_xref_ebb_game_id_to_server_id = 'xref_ebb_game_id_to_server_id';

/**
 * This function returns a promise that adds a user to the Redis store.
 *
 * @param {Object} xrefEbbGameIdToServerId - An xref object that binds a smart contract ID to a
 * 	server side game ID.
 */
var addXRefEbbGameIdToServerId_promise = function(xrefEbbGameIdToServerId)
{
	let errPrefix = '(addXRefEbbGameIdToServerId_promise) ';
	
	if (!(xrefEbbGameIdToServerId instanceof XRefEbbGameIdToServerId))
		throw new Error(errPrefix + 'The value in the xrefEbbGameIdToServerId parameter is not a XRefEbbGameIdToServerId object.');
	
	// Validate the xref object.
	xrefEbbGameIdToServerId.validateMe();
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		xrefEbbGameIdToServerId.idInSmartContract,
		errPrefix + 'The smart contract game ID is empty.',
		// Just use the base table name as the secondary key since
		//  there's only one game details (server side only) object
		//  per game.
		_baseTableName_xref_ebb_game_id_to_server_id,
		errPrefix + 'This should never error out.',
		_baseTableName_xref_ebb_game_id_to_server_id,
		xrefEbbGameIdToServerId);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the xref object for the
 * 	given smart contract game ID.
 *
 * @param {string} ebbGameId - The smart contract's ID for the game.
 *
 * @return {Object}  - The xref object for the ID given in the ebbGameId parameter.
 */
var getXRefEbbGameIdToServerId_promise = function(ebbGameId)
{
	let errPrefix = '(getXRefEbbGameIdToServerId_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		ebbGameId,
		errPrefix + 'The smart contract game ID is empty.',
		// Just use the base table name as the secondary key since
		//  there's only one game details (server side only) object
		//  per game.
		_baseTableName_xref_ebb_game_id_to_server_id,
		errPrefix + 'This should never error out.',
		_baseTableName_xref_ebb_game_id_to_server_id,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addUser_promise so we just
		//  pass the object type itself.
		XRefEbbGameIdToServerId);
	
	return getObject_promise(wrapperDetailsObj);
};


// ------------------------------ WRAPPER: USER DETAILS OBJECT -----------

const _baseTableName_user_details = 'user_details';

/**
 * This function returns a promise that adds a user to the Redis store.
 *
 * @param {string} gameId - The ID of the game the user joined.
 * @param {string} userId - The user's ID.
 * @param {Object} userObj - A user object that has the user's details.
 */
var addUser_promise = function(gameId, userId, userObj)
{
	let errPrefix = '(addUser_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		userId,
		errPrefix + 'The user ID is empty.',
		_baseTableName_user_details,
		userObj);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the user object for the user
 *  with the given user ID from the user list for the given game ID.
 *
 * @param {string} gameId - The ID of the game the user belongs to.
 * @param {string} userId - The desired user's ID.
 *
 * @return {Object}  - The user details object retrieved.
 */
var getUser_promise = function(gameId, userId)
{
	let errPrefix = '(getUser_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		userId,
		errPrefix + 'The user ID is empty.',
		_baseTableName_user_details,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addUser_promise so we just
		//  pass the object type itself.
		user_details.UserDetails);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This function returns a promise that gets ALL the user objects for the given game ID.
 *
 * @param {string} gameId - The ID of the desired game to get the users list for.
 *
 * @return {Array} - An array of user details object.
 */
var getAllUsers_promise = function(gameId)
{
	return getAllObjects_promise(gameId, _baseTableName_user_details, user_details.UserDetails);
}

// ------------------------------ WRAPPER: VIDEO BOOKMARK DETAILS OBJECT -----------

const _baseTableName_video_bookmark_details = 'video_bookmark_details';

/**
 * This function returns a promise that adds a video bookmark to the Redis store.
 *
 * @param {string} gameId - The ID of the game the video bookmark joined.
 * @param {string} video bookmarkId - The video bookmark's ID.
 * @param {Object} video bookmarkObj - A video bookmark object that has the video bookmark's details.
 */
var addVideoBookmark_promise = function(gameId, videoBookmarkId, videoBookmarkObj)
{
	let errPrefix = '(addVideoBookmark_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		videoBookmarkId,
		errPrefix + 'The video bookmark ID is empty.',
		_baseTableName_video_bookmark_details,
		videoBookmarkObj);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the video bookmark object for the video bookmark
 *  with the given ID from the video bookmark list for the given game ID.
 *
 * @param {string} gameId - The ID of the game the video bookmark belongs to.
 * @param {string} videoBookmarkId - The ID of the desired video bookmark.
 *
 * @return {Object}  - The video bookmark details object retrieved.
 */
var getVideoBookmark_promise = function(gameId, videoBookmarkId)
{
	let errPrefix = '(getVideoBookmark_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		videoBookmarkId,
		errPrefix + 'The video bookmark ID is empty.',
		_baseTableName_video_bookmark_details,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addUser_promise so we just
		//  pass the object type itself.
		video_bookmark_details.VideoBookmarkDetails);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This function returns a promise that gets ALL the video bookmark objects for the given game ID.
 *
 * @param {string} gameId - The ID of the desired game to get the video bookmarks list for.
 *
 * @return {Array} - An array of video bookmark details object.
 */
var getAllVideoBookmarks_promise = function(gameId){
	return getAllObjects_promise(gameId, _baseTableName_video_bookmark_details, video_bookmark_details.VideoBookmarkDetails);
}


// ------------------------------ WRAPPER: BAND DETAILS OBJECT -----------

const _baseTableName_band_details = 'band_details';

/**
 * This function returns a promise that adds a band to the Redis store.
 *
 * @param {string} gameId - The ID of the game the band's video is in.
 * @param {string} bandId - The band's ID.
 * @param {Object} bandObj - A band object that has the band's details.
 */
var addBand_promise = function(gameId, bandId, bandObj)
{
	let errPrefix = '(addBand_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		bandId,
		errPrefix + 'The band ID is empty.',
		_baseTableName_band_details,
		bandObj);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the band object for the band
 *  with the given band ID from the band list for the given game ID.
 *
 * @param {string} gameId - The ID of the game the band's video belongs to.
 * @param {string} bandId - The desired band's ID.
 *
 * @return {Object}  - The band details object retrieved.
 */
var getBand_promise = function(gameId, bandId)
{
	let errPrefix = '(getBand_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		bandId,
		errPrefix + 'The band ID is empty.',
		_baseTableName_band_details,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addBand_promise so we just
		//  pass the object type itself.
		band_details.BandDetails);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This function returns a promise that gets ALL the band objects for the given game ID.
 *
 * @param {string} gameId - The ID of the desired game to get the bands list for.
 *
 * @return {Array} - An array of band details object.
 */
var getAllBands_promise = function(gameId)
{
	return getAllObjects_promise(gameId, _baseTableName_band_details, band_details.BandDetails);
}

// ------------------------------ WRAPPER: GAME DETAILS OBJECT -----------

const _baseTableName_game_details_lib = 'game_details';

// NOTE: For game objects, we use a constant for the hash name and the
//  game ID becomes the field name.  This allows us to keep a table
//  in Redis of all the games being tracked.
var _allGamesHashName = 'all-games';


/**
 * This promise will create an XREF object for the given game details object
 * 	if:
 *
 * 		- The game details object has a valid smart contract game ID
 * 		- An XREF object doesn't already exist.
 *
 * @param {Object} gameObj - A valid game object.
 *
 * @return {Promise<any>}
 */
function createGameIdXrefIfNecessary_promise(gameDetailsObj) {
	let errPrefix = '(createGameIdXrefIfNecessary_promise) ';
	
	return new Promise(function(resolve, reject) {
		try	{
			// If we finds a smart contract ID in the game details object, then the
			//  game has been registered with the smart contract.  Make sure we have
			//	an XREF object for the game.
			if (gameDetailsObj.idInSmartContract < 1)
				// The game is not known to the smart contract yet.  Just get out.
				resolve(true);
			else {
				// Smart contract knows about the game.  Do we have an XREF object for
				//  the game ID yet?
			
				getXRefEbbGameIdToServerId_promise(gameDetailsObj.idInSmartContract)
				.then(redisResponse => {
					// If we get a response, make sure it's a valid XREF object.
					if (redisResponse != null && !(redisResponse instanceof XRefEbbGameIdToServerId))
						throw new Error(errPrefix + 'The value in the redisResponse parameter is not a XRefEbbGameIdToServerId object.');
						
					// Existing XREF object for the smart contract game ID?
					if (redisResponse)
						// Nothing to do.
						return(new PromiseThenBlockSkippedResult());
					else {
						// Create a new XREF object and add it to Redis.
						let xrefObj = new XRefEbbGameIdToServerId();
						
						xrefObj.gameId = gameDetailsObj.id;
						xrefObj.idInSmartContract = gameDetailsObj.idInSmartContract;
						
						// The call below will validate the object.
						return addXRefEbbGameIdToServerId_promise(xrefObj);
					}
				})
				.then(result =>
				{
					if (result instanceof PromiseThenBlockSkippedResult)
						// The result is not a Redis response.  No need to check it.
						resolve(true);
					else {
						// TODO: Validate RedisResponse.
						resolve(true);
					}
				})
				.catch(err => {
					// Convert the error to a promise rejection.
					let errMsg =
						errPrefix + conformErrorObjectMsg(err);
					
					reject(errMsg + ' - promise');
				});
			}
		}
		catch(err) {
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);
			
			reject(errMsg + ' - try/catch');
		}
	});
}

/**
 * This function returns a promise that adds a game to the Redis store.
 *
 * @param {string} gameId - The ID of the game the game's video is in.
 * @param {Object} gameDetailsObj - A game object that has the game's details.
 */
var addGame_promise = function(gameId, gameDetailsObj) {
	let errPrefix = '(addGame_promise) ';
	
	return new Promise(function(resolve, reject) {
		try	{
			// Build a wrapper object for common call processing.
			let wrapperDetailsObj = new WrapperDetailsObject(
				_allGamesHashName,
				errPrefix + 'The constant grouping ID for all game objects is empty.',
				gameId,
				errPrefix + 'The game ID is empty.',
				_baseTableName_game_details_lib,
				gameDetailsObj);
				
			// Make sure a game ID XREF object is created at the right time (i.e. -
			//	after the smart contract knows about the game and only if one does
			//	not already exist.
			createGameIdXrefIfNecessary_promise(gameDetailsObj)
			.then(ignoreResult =>
			{
				// Now add/update the game details object.
				return addObject_promise(wrapperDetailsObj);
			})
			.then(redisResponse =>
			{
				// TODO: Validate RedisResponse.
				
				// Resolve the promise with the result of the addObject_promise() call.
				resolve(redisResponse);
			})
			.catch(err => {
				// Convert the error to a promise rejection.
				let errMsg =
					errPrefix + conformErrorObjectMsg(err);
				
				reject(errMsg + ' - promise');
			});
		}
		catch(err) {
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);
			
			reject(errMsg + ' - try/catch');
		}
	});
}


/**
 * This function returns a promise that gets the game object for the game
 *  with the given game ID from the game list for the given game ID.
 *
 * @param {string} gameId - The ID of the game the game's video belongs to.
 *
 * @return {Object}  - The game details object retrieved.
 */
var getGame_promise = function(gameId)
{
	let errPrefix = '(getGame_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		_allGamesHashName,
		errPrefix + 'The constant grouping ID for all game objects is empty.',
		gameId,
		errPrefix + 'The game ID is empty.',
		_baseTableName_game_details_lib,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addGame_promise so we just
		//  pass the object type itself.
		game_details_lib.GameDetails);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This function returns a promise that gets ALL the game objects for the given game ID.
 *
 * @param {string} gameId - The ID of the desired game to get the games list for.
 *
 * @return {Array} - An array of game details object.
 */
var getAllGames_promise = function(gameId)
{
	return getAllObjects_promise(gameId, _baseTableName_game_details_lib, game_details_lib.GameDetails);
}

// ------------------------------ WRAPPER: PRIVATE PAYMENT DETAILS OBJECT -----------

// NOTE: We use the user ID as the field name for this table instead of the payment ID
//  because that is how we want to look things up, by user.
const _baseTableName_private_payment_details = 'private_payment_details';

/**
 * This function returns a promise that adds a private payment to the Redis store.
 *
 * @param {string} gameId - The ID of the game the user involved with the payment joined.
 * @param {string} userId - The user ID of the user involved with the payment
 * @param {Object} privatePaymentObj - A private payment object that has the payment's details.
 */
var addPrivatePayment_promise = function(gameId, userId, privatePaymentObj)
{
	let errPrefix = '(addPrivatePayment_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		userId,
		errPrefix + 'The user ID is empty.',
		_baseTableName_private_payment_details,
		privatePaymentObj);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the private payment object for the user
 *  with the given user ID from the private payment list for the given game ID.
 *
 * @param {string} gameId - The ID of the game the user involved with th e private
 * 	payment belongs to.
 * @param {string} userId - The user ID.
 *
 * @return {Object}  - The private payment details object retrieved.
 */
var getPrivatePayment_promise = function(gameId, userId)
{
	let errPrefix = '(getPrivatePayment_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		gameId,
		errPrefix + 'The game ID is empty.',
		userId,
		errPrefix + 'The user ID is empty.',
		_baseTableName_private_payment_details,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addPrivatePayment_promise so we just
		//  pass the object type itself.
		private_payment_details_lib.PaymentForEntryFee);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This function returns a promise that gets ALL the private payment objects for the given game ID.
 *
 * @param {string} gameId - The ID of the desired game to get the users list for.
 *
 * @return {Array} - An array of private payment details object.
 */
var getAllPrivatePayments_promise = function(gameId)
{
	return getAllObjects_promise(gameId, _baseTableName_private_payment_details, private_payment_details_lib.PaymentForEntryFee);
}

// ------------------------------ WRAPPER: ETHPUBADDR DETAILS OBJECT -----------

/** NOTE: ethpubaddr stands for Ethereum Public Address */

const _baseTableName_ethpubaddr_details = 'ethpubaddr_details';

/**
 * This function returns a promise that adds an owner's EthPubAddrDetails object to the Redis store.
 * 	The Ethereum public address itself is stored in the EthPubAddrDetails object.
 *
 * @param {EthPubAddrDetails} ethPubAddrDetailsObj - An EthPubAddrDetails object that has the relevant details.
 */
var addEthPubAddr_promise = function(ethPubAddrDetailsObj)
{
	let errPrefix = '(addEthPubAddr_promise) ';
	
	ethPubAddrDetailsObj.validateMe();
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		ethPubAddrDetailsObj.groupId,
		errPrefix + 'The group ID is empty.',
		ethPubAddrDetailsObj.ownerId,
		errPrefix + 'The owner ID is empty.',
		_baseTableName_ethpubaddr_details,
		ethPubAddrDetailsObj);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the ethpubaddr object for the owner
 *  with the given owner ID from the ethpubaddr list for the given game ID.
 *
 * @param {string} groupId - The ID of the group (context) the owner ID belongs to.  For example,
 * 	the game a user/ player belongs to in an EtherBandBattles game.
 * @param {string} ownerId - The ID of the entity that owns this Ethereum public address.  For example,
 * 	the user ID of a player in an EtherBandBattles game.
 *
 * @return {EthPubAddrDetails}  - The EthPubAddrDetailsObj object retrieved.
 */
var getEthPubAddr_promise = function(groupId, ownerId)
{
	let errPrefix = '(getEthPubAddr_promise) ';
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		groupId,
		errPrefix + 'The group ID is empty.',
		ownerId,
		errPrefix + 'The ID of the owner of the Ethereum public address ID is empty.',
		_baseTableName_ethpubaddr_details,
		// When retrieving an object from Redis we don't need an object
		//  instance like we do in addEthPubAddr_promise so we just
		//  pass the object type itself.
		EthPubAddrDetails);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This function returns a promise that gets ALL the ethpubaddr objects for the given game ID.
 *
 * @param {string} gameId - The ID of the game the owner belongs to.
  *
 * @return {Array} - An array of ethpubaddr details object.
 */
var getAllEthPubAddrs_promise = function(gameId)
{
	return getAllObjects_promise(gameId, _baseTableName_ethpubaddr_details, EthPubAddrDetails);
}

// --------------------------------------------------------------------------

/**
 * This helper function validates the given Redis response as being an array or not.
 * 	If it is not, an error is thrown.
 *
 * @param redisResponse - The response from a Redis call.
 * @param {string} errPrefix - The error prefix to include in the error message if
 * 	an error is thrown.
 * @param {Boolean} bIsErrorIfEmpty - If TRUE, then an empty array will cause an
 * 	error to be thrown.  If not, it won't.
 */
var validateRedisResponseAsArray = function(redisResponse, errMsg,  bIsErrorIfEmpty)
{
	if (!Array.isArray(redisResponse))
		throw new Error(errMsg);
		
	if (bIsErrorIfEmpty == true && redisResponse.length < 1)
		throw new Error(errMsg);
}

/**
 * This private method checks to see if there is an existing bookmark for the given
 * 	game, user, and video ID.  WARNING: this method expects all parameters to be
 * 	validated by the caller!
 *
 * @param {Array} aryVideoBookmarks - An array of video bookmarks.
 *
 * @param {string} gameId - The desired game ID.
 * @param {string} userId - The desired user ID.
 * @param {string} videoId - The desired video ID.
 *
 * @return {Boolean} - Returns TRUE if a video bookmark was submitted for the video
 * 	with the given ID, by the user with the given user ID, for the game with the
 * 	given game ID.
 *
 * @private
 */
function _findBookmarkChoiceInBookmarksArray(aryVideoBookmarks, gameId, userId, videoId){
	let videobookMarkObj = lodash_lib.find(
		aryVideoBookmarks,
		{
			gameId: gameId,
			userId: userId,
			videoId: videoId
		});
	
	if (videobookMarkObj)
		return true;
		
	return false;
}
/**
 * This method checks returns a promise that checks to see if there is an
 * 	existing bookmark for the given game, user, and video ID.
 *
 * @param {string} gameId - The desired game ID.
 * @param {string} userId - The desired user ID.
 * @param {string} videoId - The desired video ID.
 *
 * @return {Boolean} - Returns TRUE if a video bookmark was submitted for the video
 * 	with the given ID, by the user with the given user ID, for the game with the
 * 	given game ID.
 */
var isExistingVideoBookmarkChoice_promise = function(gameId, userId, videoId)
{
	let errPrefix = '(isExistingVideoBookmark_promise) ';
	
	// Get all bookmarks for the given game ID.
	return getAllVideoBookmarks_promise(gameId)
	.then(function(redisResponse)
	{
		validateRedisResponseAsArray(redisResponse, errPrefix + 'The response from Redis to our request for all the game video bookmarks is not an array.', false);
		
		return _findBookmarkChoiceInBookmarksArray(redisResponse, gameId, userId, videoId);
	});
}

/**
 * This method checks returns a promise that checks to see if if all the users
 * 	participating in the game indicated by the given game ID have added a
 * 	bookmark for the video with the given video ID.
 *
 * @param {string} gameId - The desired game ID.
 * @param {string} videoId - The desired video ID.
 *
 * @return {Array} - Returns an array of all the users that have not submitted
 * 	video bookmarks yet.  If all users submitted bookmarks, the array will
 * 	be empty.
 */
var getUsersWhoHaveNotBookmarkedVideo_promise = function(gameId, videoId)
{
	let errPrefix = '(getUsersWhoHaveNotBookmarkedVideo_promise) ';
	
	let aryUsers = null;
	let aryVideobookmarks = null;
	let aryPendingUsers = null;
	
	// Get all users for the given game ID.
	return getAllUsers_promise(gameId)
	.then(function(redisResponse)
	{
		validateRedisResponseAsArray(redisResponse, errPrefix + 'The response from Redis to our request for all users is not an array.', false);
		
		aryUsers = redisResponse;
		
		// Now get all the video bookmarks for the current game.
		return getAllVideoBookmarks_promise(gameId);
	})
	.then(function(redisResponse)
	{
		validateRedisResponseAsArray(redisResponse, errPrefix + 'The response from Redis to our request for all video bookmarks is not an array.', false);
		
		aryVideobookmarks = redisResponse;
		aryPendingUsers = new Array();
		
		// Check all users for bookmark submissions for the desired video.
		for (let ndx = 0; ndx < aryUsers.length; ndx++)
		{
			let userObj = aryUsers[ndx];
			
			// Did the user add a bookmark for this video this game yet?
			if (!_findBookmarkChoiceInBookmarksArray(aryVideobookmarks, gameId, userObj.id, videoId))
				// No.  This user did not submit a bookmark yet.
				aryPendingUsers.push(userObj);
		}
	
		return (aryPendingUsers);
	});
}

// ------------------------------ WRAPPER: USER DETAILS OBJECT -----------

const _baseTableName_payment_made_record = 'payment_made_record';

/**
 * Payments are not segregated at this time by game ID because the smart
 * 	contract currently aggregates all payments for a particular address
 * 	to save gas.  Therefore, we use the same Redis SET name for all
 * 	payment made records in the global payments table.
 *
 * @type {string}
 */
const paymentMadeRecordSetName = 'global_payment_made_record'

/**
 * This function returns a promise that adds a payment made record to the Redis store.
 *
 * @param {Object} paymentMadeRecordObj - A payment made record object.
 */
var addPaymentMadeRecord_promise = function(paymentMadeRecordObj)
{
	let errPrefix = '(addPaymentMadeRecord_promise) ';
	
	if (!(paymentMadeRecordObj instanceof PaymentMadeRecord))
		throw new Error(errPrefix + 'The value in the paymentMadeRecordObj parameter is not a PaymentMadeRecord object.');
		
	// Validate it.
	paymentMadeRecordObj.validateMe();
	
	// Build a wrapper object for common call processing.
	let wrapperDetailsObj = new WrapperDetailsObject(
		paymentMadeRecordSetName,
		errPrefix + 'The Redis set name for the payments made record set is empty.',
		paymentMadeRecordObj.id,
		errPrefix + 'The payment record made object ID is empty.',
		_baseTableName_payment_made_record,
		paymentMadeRecordObj);
	
	return addObject_promise(wrapperDetailsObj);
}

/**
 * This function returns a promise that gets the payment made object by its ID.
 *
 * @param {string} paymentMadeRecordId - The ID of the game the user belongs to.
 *
 * @return {Object}  - The payment made record object retrieved.
 */
var getPaymentMadeRecord_promise = function(paymentMadeRecordId)
{
	let errPrefix = '(getPaymentMadeRecord_promise) ';
	
	let wrapperDetailsObj = new WrapperDetailsObject(
		paymentMadeRecordSetName,
		errPrefix + 'The Redis set name for the payments made record set is empty.',
		paymentMadeRecordId,
		errPrefix + 'The payment record made object ID is empty.',
		_baseTableName_payment_made_record,
		PaymentMadeRecord);
	
	return getObject_promise(wrapperDetailsObj);
};

/**
 * This function returns a promise that gets ALL the payment made record objects
 * 	for all time.
 *
 * TODO: This won't scale.  We will need a new approach once the dApp gets
 * 	really busy.
 *
 * @return {Array} - An array of payment made record object.
 */
var getAllPaymentMadeRecords_promise = function()
{
	return getAllObjects_promise(paymentMadeRecordSetName, _baseTableName_payment_made_record, PaymentMadeRecord);
}

// ----------------

module.exports = {
    addBand_promise: addBand_promise,
    getBand_promise: getBand_promise,
    getAllBands_promise: getAllBands_promise,
    
	addGameDetailsServerSideOnly_promise: addGameDetailsServerSideOnly_promise,
	getGameDetailsServerSideOnly_promise: getGameDetailsServerSideOnly_promise,
	
	addXRefEbbGameIdToServerId_promise: addXRefEbbGameIdToServerId_promise,
	getXRefEbbGameIdToServerId_promise: getXRefEbbGameIdToServerId_promise,

    addUser_promise: addUser_promise,
    getUser_promise: getUser_promise,
    getAllUsers_promise: getAllUsers_promise,
    
    addVideoBookmark_promise: addVideoBookmark_promise,
    getVideoBookmark_promise: getVideoBookmark_promise,
    getAllVideoBookmarks_promise: getAllVideoBookmarks_promise,
    
    addGame_promise: addGame_promise,
    getGame_promise: getGame_promise,
    getAllGames_promise: getAllGames_promise,
    
    addPaymentMadeRecord_promise: addPaymentMadeRecord_promise,
    getPaymentMadeRecord_promise: getPaymentMadeRecord_promise,
    getAllPaymentMadeRecords_promise: getAllPaymentMadeRecords_promise,
    
    addPrivatePayment_promise: addPrivatePayment_promise,
    getPrivatePayment_promise: getPrivatePayment_promise,
    getAllPrivatePayments_promise: getAllPrivatePayments_promise,
    
    addEthPubAddr_promise: addEthPubAddr_promise,
    getEthPubAddr_promise: getEthPubAddr_promise,
    getAllEthPubAddrs_promise: getAllEthPubAddrs_promise,
    
    getUsersWhoHaveNotBoomkmarkedVideo_promise: getUsersWhoHaveNotBookmarkedVideo_promise,
    isExistingVideoBookmarkChoice_promise: isExistingVideoBookmarkChoice_promise,
    validateRedisResponseAsArray: validateRedisResponseAsArray,
    
	updateServerSideOnlyDetailsField_promise: updateServerSideOnlyDetailsField_promise,
    updateSSOGameDetailsGasUsed_promise: updateSSOGameDetailsGasUsed_promise,
    
    XRefEbbGameIdToServerId: XRefEbbGameIdToServerId
}