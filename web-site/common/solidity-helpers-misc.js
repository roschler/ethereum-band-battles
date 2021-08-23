/**
 * This module contains miscellaneous functions to help with various Ethereum/Solidity
 * 	related tasks.
 */
 
// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

const common_routines = require("./common-routines");
const misc_shared_lib = require ('../public/javascripts/misc/misc-shared');
const fs = require('fs');

const ethereumjs_wallet = require('ethereumjs-wallet');
const ethereum_util = require('ethereumjs-util');
// v4 for "random" uuid creation mode.
const uuidv4 = require('uuid/v4');

/**
 * The amount of time our polling functions will wait before considering a
 * 	block mining operation a failure (timed-out).
 *
 * @type {number}
 */
const DEFAULT_BLOCK_TIMEOUT_SECONDS = 60;

/** These are the various Ethereum networks we work with.  Not a complete list of
 *   all the Ethereum networks in existence.
 *
 * IMPORTANT: Private networks typically return some large number for the network
 * 	ID. Until we find a better strategy, any large network ID should be treated
 * 	as a Ganache network Id, which really means it's a private test network and
 * 	may not be Ganache at al (e.g. - Geth private node, etc.).
 *
 * @type {Readonly<{MAIN: number, MORDEN: number, ROPSTEN: number, RINKEBY: number, KOVAN: number, GANACHE: number}>}
 */

// WARNING: The Ganache network ID MUST match the value Ganache is using!
const EnumEthereumNetwork = Object.freeze({ "NOTSET": 0, "MAIN": 1, "MORDEN": 2, "ROPSTEN": 3, "RINKEBY": 4, "KOVAN": 42, "GANACHE": 5777 });



// ------------------------ BEGIN: SOLIDITY MIRROR ENUMS ----------------

	// This block contains enums that have a Solidity side counterpart.
	//  Therefore the content between the partner elements MUST stay
	//	in sync.

    // We start at 1 because we want to make sure the caller specifically assigned
    //  the video platform ID, and since 0 is the default value for a uint, that
    //  indicates the caller forgot to set it or made some other kind of mistake.
    const EnumVideoPlatforms = Object.freeze({
        "NOTSET": 0,
        "THETATV": 1,
        "YOUTUBE": 2,
        "TWITTER": 3,
        "NETFLIX": 4,
        "VIMEO": 5,
        "YAHOO": 6,
        "DAILYMOTION": 7,
        "HULU": 8,
        "VUBE": 9,
        "TWITCH": 10,
        "INSTAGRAM": 11,
        "KIK": 12,
        // Update this video platform ID as we add new platforms.  We use this to
        //  check the validity of the video platform ID.
        "OUT_OF_RANGE": 13
    });
		
    // --->>> Game state.

	// WARNING!: This enum must ALSO remain sync with the enumGameStateToString() and
	// 	isValidGameState() methods below!
	const EnumGameState = Object.freeze({
	    // Game state has not been set.  Usually indicates an error on the part of the programmer.
	    "NOTSET": 0,
		// The game has been created and is waiting for players", but has not
		//  been started yet.
		"CREATED": 1,
		// The game has started and is underway", and will not accept any new players.
		"PLAYING": 2,
		// The game is over", but all payments have not been made yet
		"GAME_OVER": 3,
		// Update this game state value as we add new states", if ever.  We use this to
		//  check the validity of a new game state assignment.
		"OUT_OF_RANGE": 4
	});
	
    // --->>> Payment type.

	// WARNING!: This enum must ALSO remain sync with the enumGameStateToString() and
	// 	isValidGameState() methods below!
	const EnumPaymentType = Object.freeze({
	    // The payment type has not been set.  Usually indicates an error on the part of the programmer.
	    "NOTSET": 0,
		// A player payment.
		"PLAYER": 1,
		// A band payment
		"BAND": 2,
		// A House payment.
		"HOUSE": 3,
		// A transfer from escrow to the pending payments list (i.e. - the scheduling of an
		//  escrow payment.
		"ESCROW_TRANSFER": 4,
		// Update this game state value as we add new states, if ever.  We use this to
		//  check the validity of a new game state assignment.
		"OUT_OF_RANGE": 5
	});
	
	
// These are the values for the Ethereum transaction "status" field, as returned by
//  the Web3JS getTransactionReceipt() call.
const EnumRawTransactionStatus = Object.freeze({
	"FAILED": 0,
	"SUCCESS": 1
});

/**
 * This function wraps the result of a call to the Web3JS Ethereum getTransaction() method.
 * 	It provides helper methods to deal with the raw result object.
 *
 * @param {Object} ethTransactionResult - An Ethereum transaction result object.
 *
 * @constructor
 */
function WrapTransactionResult(ethTransactionResult) {
	var self = this;
	
	let objectName = 'WrapTransactionResult';
	let errPrefix = '(' + objectName + '::constructor) ';
	
	if (!ethTransactionResult)
		throw new Error(errPrefix + 'The Ethereum transaction result parameter is unassigned.');
		
	this.ethTransactionResult = ethTransactionResult;
	
	/**
	 * This function extracts, validates, and returns the block number field from the
	 * 	wrapped transaction result object.
	 *
	 * @return {number}
	 */
	this.getBlockNumber = function() {
		let objectName = 'WrapTransactionResult';
		let methodName = objectName + '::' + 'getBlockNumber';
		let errPrefix = '(' + methodName + ') ';

		let blockNumber = misc_shared_lib.extractPropertyFromObj(self.ethTransactionResult, 'blockNumber');
		
		// Validate the block number.
		common_routines.validateAsIntegerGreaterThanZero(methodName, blockNumber);
		
		return blockNumber;
	}
}

/**
 * This function wraps the result of a call to the Web3JS Ethereum getTransactionReceipt() method.
 * 	It provides helper methods to deal with the raw result object.
 *
 * @param {Object} ethTransactionResult - An Ethereum transaction result object.
 *
 * @constructor
 */
function WrapTransactionReceiptResult(ethTransactionReceiptResult) {
	var self = this;
	
	let objectName = 'WrapTransactionReceiptResult';
	let errPrefix = '(' + objectName + '::constructor) ';
	
	if (!ethTransactionReceiptResult)
		throw new Error(errPrefix + 'The Ethereum transaction receipt result parameter is unassigned.');
		
	this.ethTransactionReceiptResult = ethTransactionReceiptResult;
	
	/**
	 * This function extracts, validates, and returns the block number field from the
	 * 	wrapped transaction receipt result object.
	 *
	 * @return {number}
	 */
	this.getBlockNumber = function() {
		let objectName = 'WrapTransactionReceiptResult';
		let methodName = objectName + '::' + 'getBlockNumber';
		let errPrefix = '(' + methodName + ') ';

		let blockNumber = misc_shared_lib.extractPropertyFromObj(self.ethTransactionReceiptResult, 'blockNumber');
		
		// Validate the block number.
		common_routines.validateAsIntegerGreaterThanZero(methodName, blockNumber);
		
		return blockNumber;
	}
	
	/**
	 * This function extracts, conforms, validates, and returns the status field from the
	 * 	wrapped transaction receipt result object.
	 *
	 * @return {number}
	 */
	this.getTransactionStatus = function() {
		let objectName = 'WrapTransactionReceiptResult';
		let methodName = objectName + '::' + 'getTransactionStatus';
		let errPrefix = '(' + methodName + ') ';
		
		let rawTransactionStatus = misc_shared_lib.extractPropertyFromObj(self.ethTransactionReceiptResult, 'status');
		
		// Conform the transactionStatus value.
		let transactionStatus = conformRawTransactionStatus(rawTransactionStatus);
		
		return transactionStatus;
	}
	
	/**
	 * This function extracts, conforms, validates, and returns the gas used (Gwei) field from the
	 * 	wrapped transaction receipt result object.
	 *
	 * @return {number}
	 */
	this.getGasUsedGwei = function() {
		let objectName = 'WrapTransactionReceiptResult';
		let methodName = objectName + '::' + 'getGasUsedGwei';
		let errPrefix = '(' + methodName + ') ';
		
		let rawGasUsedGwei = misc_shared_lib.extractPropertyFromObj(self.ethTransactionReceiptResult, 'gasUsed');
		
		// Conform the gasUsedGwei value.
		let gasUsedGwei = conformGasUsedGwei(rawGasUsedGwei);
		
		return gasUsedGwei;
	}

}

/**
 * Given a game state, convert it to a string representation suitable for diagnostic
 * 	or logging purposes.
 *
 * @param enGameState - A valid game state value.
 *
 * @return {string}
 */

function enumGameStateToString(enGameState) {
	let errPrefix = '(enumGameStateToString) ';
	
	let strGameState = '(none) ';
	
	if (typeof enGameState != 'number')
		throw new Error(errPrefix + 'The game state parameter is not a number');
		
	switch (enGameState) {
		case EnumGameState.NOTSET:
			strGameState = "NOTSET";
			break;
		case EnumGameState.CREATED:
			strGameState = "CREATED";
			break;
		case EnumGameState.PLAYING:
			strGameState = "PLAYING";
			break;
		case EnumGameState.GAME_OVER:
			strGameState = "GAME_OVER";
			break;
		case EnumGameState.OUT_OF_RANGE:
			throw new Error(errPrefix + 'The game state is out of range of the acceptable values for a game state: ' + enGameState.toString());
			break;
		default:
			throw new Error(errPrefix + 'Unknown game state: ' + enGameState.toString());
	}
	
	return strGameState;
}

/**
 * This method returns TRUE if the given game state is in the proper format and within the range
 * 	of allowed values for game states.
 *
 * @param {number} enGameState - A game state to inspect.
 *
 * @return {boolean} - Returns TRUE if the game state parameter contains a valid game state,
 * 	FALSE if not.
 */
function isValidGameState(enGameState) {
	if (typeof enGameState != 'number')
		return false;

	return (enGameState > EnumGameState.NOTSET && enGameState < EnumGameState.OUT_OF_RANGE);
}

/**
 * Given a payment type, convert it to a string representation suitable for diagnostic
 * 	or logging purposes.
 *
 * @param enPaymentType - A valid payment type value.
 *
 * @return {string}
 */

function enumPaymentTypeToString(enPaymentType) {
	let errPrefix = '(enumPaymentTypeToString) ';
	
	let strPaymentType = '(none) ';
	
	if (typeof enPaymentType != 'number')
		throw new Error(errPrefix + 'The payment type parameter is not a number');
		
	switch (enPaymentType) {
		case EnumPaymentType.NOTSET:
			strPaymentType = "NOTSET";
			break;
		case EnumPaymentType.PLAYER:
			strPaymentType = "PLAYER";
			break;
		case EnumPaymentType.BAND:
			strPaymentType = "BAND";
			break;
		case EnumPaymentType.HOUSE:
			strPaymentType = "HOUSE";
			break;
		case EnumPaymentType.ESCROW_TRANSFER:
			strPaymentType = "ESCROW_TRANSFER";
			break;
		case EnumPaymentType.OUT_OF_RANGE:
			throw new Error(errPrefix + 'The payment type is out of range of the acceptable values for a payment type: ' + enPaymentType.toString());
			break;
		default:
			throw new Error(errPrefix + 'Unknown payment type: ' + enPaymentType.toString());
	}
	
	return strPaymentType;
}

/**
 * Given a payment type in numeric format convert it to a true EnumPaymentType value.
 *
 * @param {string|number} rawPaymentTypeAsNumber - A valid payment type value.  If it is a number
 * 	in string format, an attempt will be made to parse it to a number first.
 *
 * @return {number}
 */

function numberToEnumPaymentType(rawPaymentTypeAsNumber) {
	let errPrefix = '(numberToEnumPaymentType) ';
	
	if (typeof rawPaymentTypeAsNumber == 'undefined' || rawPaymentTypeAsNumber == null)
		throw new Error(errPrefix + 'The payment type as number parameter is unassigned.')
		
	if (!(typeof rawPaymentTypeAsNumber == 'string'  || typeof rawPaymentTypeAsNumber != 'number'))
		throw new Error(errPrefix + 'The payment type as number parameter is not a number or a string.')
		
	let paymentTypeAsNumber = rawPaymentTypeAsNumber;
	
	if (typeof rawPaymentTypeAsNumber == 'string')
		paymentTypeAsNumber = parseInt(rawPaymentTypeAsNumber);
	
	let enPaymentType = EnumPaymentType.NOTSET;
	
	switch (paymentTypeAsNumber) {
		case EnumPaymentType.NOTSET:
			throw new Error(errPrefix + 'The payment type parameter value is invalid because it is the NOTSET value.');
		case EnumPaymentType.PLAYER:
		case EnumPaymentType.BAND:
		case EnumPaymentType.HOUSE:
		case EnumPaymentType.ESCROW_TRANSFER:
			enPaymentType = paymentTypeAsNumber;
			break;
		case EnumPaymentType.OUT_OF_RANGE:
			throw new Error(errPrefix + 'The payment type is out of range of the acceptable values for a payment type: ' + paymentTypeAsNumber.toString());
			break;
		default:
			throw new Error(errPrefix + 'Invalid payment type value: ' + paymentTypeAsNumber.toString());
	}
	
	return enPaymentType;
}

/**
 * This method returns TRUE if the given payment type is in the proper format and within the range
 * 	of allowed values for payment types.
 *
 * @param {number} enPaymentType - A payment type to inspect.
 *
 * @return {boolean} - Returns TRUE if the payment type parameter contains a valid payment type,
 * 	FALSE if not.
 */
function isValidPaymentType(enPaymentType) {
	if (typeof enPaymentType != 'number')
		return false;

	return (enPaymentType > EnumPaymentType.NOTSET && enPaymentType < EnumPaymentType.OUT_OF_RANGE);
}



/**
 * This function conforms an Ethereum network ID into a number value.  It throws an
 * 	Error if this cannot be done.
 *
 * @param {string} caller - A prefix to add to any error messages that may need to
 * 	be shown that identifies the caller or relevant consumer of this function.
 * @param {EnumEthereumNetwork|string|number|null} enEthereumNetworkId_in - A potential Ethereum network
 * 	ID to evaluate.
 *
 * @return {EnumEthereumNetwork} - Returns a valid Ethereum network ID enum value.
 */
function conformEthereumNetworkId(caller, enEthereumNetworkId_in) {
	let methodName = 'conformEthereumNetworkId';
	let errPrefix = '(' + caller + ':' + methodName + ') ';
	
	if (misc_shared_lib.isEmptySafeString(caller))
		throw new Error('(conformEthereumNetworkId) The error prefix is not set');

	if (!enEthereumNetworkId_in)
		throw new Error(caller + "The Ethereum network ID to conform is not set.");
		
	// Coerce input parameter to a number or if it is a string, case statements that
	//  depend on it will fail.
	let ethereumNetworkIdAsNumber = null;
	
	try {
		if (typeof enEthereumNetworkId_in == 'EnumEthereumNetwork')
			// TODO: Probably should get rid of this.  Enums defined as numbers are numbers
			//  in Javascript and are not treated as the enum type itself (For example,
			//  not as EnumEthereumNetwork in this case.)
			//
			// It'a already an EnumEthereumNetwork value, which is a number.  Just use it.
			ethereumNetworkIdAsNumber = enEthereumNetworkId_in;
		else if (typeof enEthereumNetworkId_in == 'string')
		{
			// It's a string.  Try to parse it as a number and conform it.
			ethereumNetworkIdAsNumber = parseInt(enEthereumNetworkId_in);
		}
		else if (typeof enEthereumNetworkId_in == 'number')
		{
			// It's a number.  Just use it.
			ethereumNetworkIdAsNumber = enEthereumNetworkId_in
		}
		else
			throw new Error(errPrefix + "Don't know how to handle type of input parameter.");
		
	}
	catch(err)
	{
		// Make sure the network ID we show with the error shows the proper value of the given
		//  network ID.
		let useEthereumNetworkIdForError = '(unassigned)';
		
		// A value of 0 should not turn be misinterpreted as the parameter not being set.
		if (enEthereumNetworkId_in == 0)
			useEthereumNetworkIdForError = 0;
		else {
			// Do we have a value to show?
			if (enEthereumNetworkId_in)
				// Show it.
				useEthereumNetworkIdForError = enEthereumNetworkId_in;
		}
		
		throw new Error(caller + 'Invalid Ethereum network ID(' + useEthereumNetworkIdForError + '). Details: ' + err.message);
	}

	if (ethereumNetworkIdAsNumber == EnumEthereumNetwork.MAIN)
		return EnumEthereumNetwork.MAIN;
	if (ethereumNetworkIdAsNumber == EnumEthereumNetwork.MORDEN)
		return EnumEthereumNetwork.MORDEN;
	if (ethereumNetworkIdAsNumber == EnumEthereumNetwork.ROPSTEN)
		return EnumEthereumNetwork.ROPSTEN;
	if (ethereumNetworkIdAsNumber == EnumEthereumNetwork.RINKEBY)
		return EnumEthereumNetwork.RINKEBY;
	if (ethereumNetworkIdAsNumber == EnumEthereumNetwork.KOVAN)
		return EnumEthereumNetwork.KOVAN;
	// If the Ethereum network ID is greater than or equal to the constant we use for
	//  the Ganache private network, coerce it to that value since we are most likely
	//  on the Ganache network or some other private Ethereum network.
	if (ethereumNetworkIdAsNumber >= EnumEthereumNetwork.GANACHE)
		return EnumEthereumNetwork.GANACHE;
		
	throw new Error(caller + "Invalid Ethereum network ID: " + ethereumNetworkIdAsNumber.toString() );
	
	return ethereumNetworkIdAsNumber;
}

// ------------------------ END: SOLIDITY MIRROR ENUMS ----------------

/**
 * Given an Ethereum network ID, return it's string representation.
 *
 * @param {EnumEthereumNetwork|number} enEthereumNetworkId_in - A valid Ethereum network ID.
 *
 * @return {string} - Returns the string representation of the given Ethereum network Id.
 */
function ethereumNetworkIdToString(enEthereumNetworkId_in)
{
	let errPrefix = "(ethereumNetworkIdToString) ";
	
	let enEthereumNetworkId = conformEthereumNetworkId(errPrefix, enEthereumNetworkId_in);
	
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MAIN)
		return "MAIN";
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MORDEN)
		return "MORDEN";
	if (enEthereumNetworkId_in == EnumEthereumNetwork.ROPSTEN)
		return "ROPSTEN";
	if (enEthereumNetworkId_in == EnumEthereumNetwork.RINKEBY)
		return "RINKEBY";
	if (enEthereumNetworkId_in == EnumEthereumNetwork.KOVAN)
		return "KOVAN";
	if (enEthereumNetworkId_in == EnumEthereumNetwork.GANACHE || enEthereumNetworkId_in == '999' )
		return "GANACHE";

	throw new Error(errPrefix + "Don't know how to handle Ethereum network ID: " + enEthereumNetworkId);
}

/**
 * Convert an Ethereum network name to an Ethereum network ID enum.
 *
 * @param {string} ethereumNetworkName - The Ethereum network name to convert.
 *
 * @return {EnumEthereumNetwork} - Returns the enum that represents the given
 * 	Ethereum network name.
 *
 */
function stringToEthereumNetworkId(ethereumNetworkName)
{
	let errPrefix = "(stringToEthereumNetworkId) ";
	
	if (common_routines.isEmptyString(ethereumNetworkName))
		throw new Error(errPrefix + "The Ethereum network name is empty.");
		
	if (ethereumNetworkName == 'MAIN')
		return EnumEthereumNetwork.MAIN;
	if (ethereumNetworkName == 'MORDEN')
		return EnumEthereumNetwork.MORDEN;
	if (ethereumNetworkName == 'ROPSTEN')
		return EnumEthereumNetwork.ROPSTEN;
	if (ethereumNetworkName == 'RINKEBY')
		return EnumEthereumNetwork.RINKEBY;
	if (ethereumNetworkName == 'KOVAN')
		return EnumEthereumNetwork.KOVAN;
	if (ethereumNetworkName == 'GANACHE')
		return EnumEthereumNetwork.GANACHE;
	
	throw new Error(errPrefix + "Invalid Ethereum network name: " + ethereumNetworkName);
}

/**
 * Loads the entire artifacts file for a contract from the Truffle JSON artifacts file.
 *
 * @param {string} jsonFilenameFullPath - The full path to the contract JSON
 * 	artifacts file.
 *
 * @return {Object} - Returns the ABI in JSON object format.
 */
function loadContractArtifacts_truffle(jsonFilenameFullPath) {
	let errPrefix = `(loadContractArtifacts_truffle) `;
	
	if (common_routines.isEmptyString(jsonFilenameFullPath))
		throw new Error(errPrefix + "The JSON file name parameter is empty.");
		
	let d = __dirname;
	let f = __filename;
	
	if (!fs.existsSync(jsonFilenameFullPath))
		throw new Error(errPrefix + "Unable to find the file named: " + jsonFilenameFullPath);
		
	// Read in its content.
	let bufArtifact = fs.readFileSync(jsonFilenameFullPath);
	
	// Convert the Buffer to string.
	let strArtifact = bufArtifact.toString();
	if (common_routines.isEmptyString(strArtifact))
		throw new Error(errPrefix + "The Truffle artifact file is empty.  Using file name: " + jsonFilenameFullPath);
		
	// Parse it.
	let retJsonObj = JSON.parse(strArtifact);
	
	// Return it.
	return retJsonObj;
}

/**
 * Loads the ABI data for a contract from the Truffle JSON artifacts file.
 *
 * @param {string} jsonFilenameFullPath - The full path to the contract JSON
 * 	artifacts file.
 *
 * @return {Object} - Returns the ABI in JSON object format.
 */
function loadContractAbi_truffle(jsonFilenameFullPath)
{
	let errPrefix = "(loadContractAbi) ";
	
	if (common_routines.isEmptyString(jsonFilenameFullPath))
		throw new Error(errPrefix + "The JSON file name parameter is empty.");
	
	let retJsonObj = loadContractArtifacts_truffle(jsonFilenameFullPath);
		
	if (!retJsonObj.abi)
		throw new Error(errPrefix + "The Truffle artifact JSON object is missing the ABI field.  Using file name: " + jsonFilenameFullPath);
		
	// Return just the ABI.
	return retJsonObj.abi;
}

/**
 * THIS OBJECT IS USED ON THE SERVER SIDE FOR TRANSACTIONS SIGNED AND EXECUTED BY THE SERVER.
 *
 * This object retrieves and stores the needed elements we need from an Ethereum network for
 * 	easy testing of the primary account (account 0).
 *
 * @param {EnumEthereumNetwork} ethereumNetworkId - A valid Ethereum network ID
 * 	that tells us what Ethereum network the target contract instance is deployed
 * 	on.
 * @param {Object} web3 - A valid web3 object.
 * @param {Object} contractDetailsObj - A valid contract details object.
 * @param {string} privateKey - The private key to use for all transactions.
 *
 * @constructor
 */
function EthereumContractHelper(ethereumNetworkId, web3, contractDetailsObj, privateKey)
{
	let errPrefix = '(EthereumContractHelper) ';
	
	// Network IDs begin at 1 so 0 is not a valid ID.
	if (!ethereumNetworkId || ethereumNetworkId == 0)
		throw new Error(errPrefix + 'Invalid Ethereum network ID.');
		
	/** @property {EnumEthereumNetwork} - The Ethereum network ID where the target contract instance is deployed at. */
	this.ethereumNetworkId = ethereumNetworkId;

	if (!web3)
		throw new Error(errPrefix + 'The web3 object is unassigned.');
		
	if (!contractDetailsObj)
		throw new Error(errPrefix + 'The contract details object is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(contractDetailsObj.contractName))
		throw new Error(errPrefix + 'The contract name is empty.');
		
	/** @property {string} - The contract name. */
	this.contractName = contractDetailsObj.contractName;
	
	/** @property {string} - The last deployment address of the contract on the Ethereum client network. */
	this.contractAddr = contractDetailsObj.findDeployedAt(ethereumNetworkId);
	
	// This should be the private key for account 0 in the target network, otherwise
	//  it won't match the public key we're about to retrieve for that account.
	/** @property {string} - The private key associated with account 0. */
	this.privateKey = privateKey;
	
	if (misc_shared_lib.isEmptySafeString(this.privateKey))
		throw new Error(errPrefix + 'Missing private key.');

	// Convert private key to Buffer format.
	/** @property {Buffer} - The private key associated with account 0 in Buffer object format. */
	this.privateKeyBuffer = ethereum_util.toBuffer(this.privateKey);
	
	// Now get a wallet instance for the given private key.
	/** @property {Wallet} - A wallet for use with the private key retrieved for account 0. */
	this.wallet = ethereumjs_wallet.fromPrivateKey(this.privateKeyBuffer);
	
	// Get the public key.
	/** @property {string} - The public key associated with account 0. */
	this.publicKey = this.wallet.getPublicKeyString();
	
	if (misc_shared_lib.isEmptySafeString(this.publicKey))
		throw new Error(errPrefix + 'Missing public key.');
		
	// Convert public key to Buffer format.
	/** @property {Buffer} - The public key associated with account 0 in Buffer object format. */
	this.publicKeyBuffer = ethereum_util.toBuffer(this.publicKey);

		
	// Get the public address.
	/** @property {string} - The public address associated with account 0. */
	this.publicAddr = this.wallet.getAddressString();

	if (misc_shared_lib.isEmptySafeString(this.publicAddr))
		throw new Error(errPrefix + 'Missing public address.');
		
	// Load the contract ABI from the JSON artifact file created by Truffle.
	// 	Convert it to an absolute path source from the project root directory.
	/** @property {string} - The full path to the JSON file that contains the
	  * Truffle artifact data for the contract. */
	this.jsonFilename = contractDetailsObj.jsonFilename;
	
	/** @property {Object} - The ABI (Application Binary Interface) for the contract. */
	this.contractAbi = contractDetailsObj.abi;

	// Create an instance of the contract using the given contract and public addresses.
	/** @property {Object} - An instance of the contract. */
	this.contractInstance =
		new web3.eth.Contract(
			this.contractAbi,
			contractDetailsObj.contractAddr,
			{
				// Comments are from the readthedocs web site for the web3 package.
				from: this.publicAddr, // Default 'from' address for transactions.
				// TODO: This should not be hard-coded.
				gasPrice: '20000000000', // Default gas price in wei in string format, 20 gwei in this case
			});
		
	console.log("EthereumContractHelper object construction completed.");
}

/**
 * Get the target Ethereum network, set in the environment.
 *
 * @return {EnumEthereumNetwork} - Returns the desired target Ethereum
 * 	network in enum format, or throws an Error if not found.
 */
function getTargetEthereumNetworkId()
{
	let errPrefix = "(getTargetEthereumNetworkId) ";
	
	// Get the current target Ethereum network ID from the environment.
	let ethereumNetworkName = process.env.ETHEREUM_NETWORK_NAME;
	
	if (common_routines.isEmptyString(ethereumNetworkName))
		throw new Error(errPrefix + "Unable to find the target Ethereum network in the environment.  Was it set?");
		
	console.log(errPrefix + "Found the following target Ethereum network name in the environment: " + ethereumNetworkName);
		
	// Convert the string representation to an Ethereum network ID enum
	//  and return it.
	return stringToEthereumNetworkId(ethereumNetworkName);
}

/**
 * This function grabs the correct environment variable that should hold
 * 	the private key for the given Ethereum network ID.
 *
 * @param {EnumEthereumNetwork} enEthereumNetworkId_in - A valid Ethereum network ID.
 *
 * @return {string} -  Returns the correct private key from the environment given
 * 	the network ID provided.
 *
 * @private
 */
function _doGetPrivateKey(enEthereumNetworkId_in) {
	let errPrefix = "(_doGetPrivateKey) ";
	
	let enEthereumNetworkId = conformEthereumNetworkId(errPrefix, enEthereumNetworkId_in);
	let retPrivKey = null;
	
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MAIN)
		retPrivKey = process.env.MAIN_PRIVATE_KEY;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MORDEN)
		retPrivKey = process.env.MORDEN_PRIVATE_KEY;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.ROPSTEN)
		retPrivKey = process.env.ROPSTEN_PRIVATE_KEY;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.RINKEBY)
		retPrivKey = process.env.RINKEBY_PRIVATE_KEY;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.KOVAN)
		retPrivKey = process.env.KOVAN_PRIVATE_KEY;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.GANACHE || enEthereumNetworkId_in == '999')
		retPrivKey = process.env.GANACHE_PRIVATE_KEY;
		
	if (!retPrivKey)
	{
		let ethNetName = ethereumNetworkIdToString(enEthereumNetworkId);
		
		throw new Error(errPrefix + "We do not have a key value for set in the environment for the Ethereum network: " + ethNetName);
	}

	return retPrivKey;
}

/**
 * This function grabs the correct environment variable that should hold
 * 	the mnemonic for the given Ethereum network ID.
 *
 * @param {EnumEthereumNetwork} enEthereumNetworkId_in - A valid Ethereum network ID.
 *
 * @return {string} -  Returns the correct mnemonic from the environment given
 * 	the network ID provided.
 *
 * @private
 */
function _doGetMnemonic(enEthereumNetworkId_in) {
	let errPrefix = "(_doGetMnemonic) ";
	
	let enEthereumNetworkId = conformEthereumNetworkId(errPrefix, enEthereumNetworkId_in);
	let retMnemonic = null;
	
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MAIN)
		retMnemonic = process.env.MAIN_MNEMONIC;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MORDEN)
		retMnemonic = process.env.MORDEN_MNEMONIC;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.ROPSTEN)
		retMnemonic = process.env.ROPSTEN_MNEMONIC;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.RINKEBY)
		retMnemonic = process.env.RINKEBY_MNEMONIC;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.KOVAN)
		retMnemonic = process.env.KOVAN_MNEMONIC;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.GANACHE || enEthereumNetworkId_in == '999')
		retMnemonic = process.env.GANACHE_MNEMONIC;
		
	throw new Error(errPrefix + "Invalid Ethereum network ID.");
	
	if (misc_shared_lib.isEmptySafeString(retMnemonic))
	{
		let ethNetName = ethereumNetworkIdToString(enEthereumNetworkId);
		
		throw new Error(errPrefix + "We do not have a mnemonic value set in the environment for the Ethereum network: " + ethNetName);
	}

	return retMnemonic;
}

/**
 * Using the target Ethereum network currently set in the environment, return
 * 	the private key from the environment for that network.
 *
 * @return {string} - Returns the correct private key from the environment given
 * 	the Ethereum network currently set in the environment.
 */
function getPrivateKey() {
	let errPrefix = "(getPrivateKey) ";

	// Get the target Ethereum network ID set in the environment.
	let enEthereumNetworkId = getTargetEthereumNetworkId();
	
	return _doGetPrivateKey(enEthereumNetworkId);
}

/**
 * Using the target Ethereum network currently set in the environment, return
 * 	the private key from the environment for that network.
 *
 * @return {string} - Returns the correct private key from the environment given
 * 	the Ethereum network currently set in the environment.
 */
function getMnemonic() {
	let errPrefix = "(getMnemonic) ";

	// Get the target Ethereum network ID set in the environment.
	let enEthereumNetworkId = getTargetEthereumNetworkId();
	
	return _doGetMnemonic(enEthereumNetworkId);
}


/**
 * This function grabs the correct environment variable that should hold
 * 	the house public address for the given Ethereum network ID.
 *
 * @param {EnumEthereumNetwork} enEthereumNetworkId_in - A valid Ethereum network ID.
 *
 * @return {string} -  Returns the correct house public address from the environment given
 * 	the network ID provided.
 *
 */
function getHousePublicAddressWithId(enEthereumNetworkId_in) {
	let errPrefix = "(getHousePublicAddressWithId) ";
	
	let enEthereumNetworkId = conformEthereumNetworkId(errPrefix, enEthereumNetworkId_in);
	let retPublicAddr = null;

	if (enEthereumNetworkId_in == EnumEthereumNetwork.MAIN)
		retPublicAddr = process.env.MAIN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MORDEN)
		retPublicAddr = process.env.MORDEN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.ROPSTEN)
		retPublicAddr = process.env.ROPSTEN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.RINKEBY)
		retPublicAddr = process.env.RINKEBY_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.KOVAN)
		retPublicAddr = process.env.KOVAN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.GANACHE || enEthereumNetworkId_in == '999')
		retPublicAddr = process.env.GANACHE_HOUSE_PUBLIC_ADDRESS;

	throw new Error(errPrefix + "Invalid Ethereum network ID.");
	
	if (misc_shared_lib.isEmptySafeString(retPublicAddr))
	{
		let ethNetName = ethereumNetworkIdToString(enEthereumNetworkId);
		
		throw new Error(errPrefix + "We do not have a house public address value set in the environment for the Ethereum network: " + ethNetName);
	}

	return retPublicAddr;
}

/**
 * This function returns the fully built Web3 provider URL for the given Ethereum network ID.
 *
 * @param {EnumEthereumNetwork|number} enEthereumNetworkId_in - A valid Ethereum network ID.
 *
 * @return {string} -  Returns the correct, fully built Web3 provider url given
 * 	the network ID provided.
 *
 */
function getWeb3ProviderUrl(enEthereumNetworkId_in) {
	let errPrefix = "(getWeb3ProviderUrl) ";
	
	let enEthereumNetworkId = conformEthereumNetworkId(errPrefix, enEthereumNetworkId_in);
	
	let host = 'infura.io';
	let subDomain = null;
	let protocol = 'https:';

	if (enEthereumNetworkId_in == EnumEthereumNetwork.MAIN)
		subDomain = 'mainnet';
	else if (enEthereumNetworkId_in == EnumEthereumNetwork.ROPSTEN)
		subDomain = 'ropsten';
	else if (enEthereumNetworkId_in == EnumEthereumNetwork.RINKEBY)
		subDomain = 'rinkeby';
	else if (enEthereumNetworkId_in == EnumEthereumNetwork.KOVAN)
		subDomain = 'kovan';
	else if (enEthereumNetworkId_in == EnumEthereumNetwork.GANACHE || enEthereumNetworkId_in == '999')
		return 'http://localhost:8545';

	if (subDomain == null)
		throw new Error(errPrefix + "Invalid Ethereum network ID: " + enEthereumNetworkId);
	
	// The Infura API key must be in the environment.
	let infuraApiKey = process.env.INFURA_API_KEY;
	
	if (!infuraApiKey)
		throw new Error(errPrefix + "The Infura API key was not found in the environment.");
		
	// Build the full Infura API provider URL.
	let urlWeb3Provider = protocol + '//' + subDomain + "." + host + '/' + infuraApiKey;
	
	return urlWeb3Provider;
}

/**
 * Given an Ethereum network ID, return the house public address set in the environment for that
 * 	network.
 *
 * @param {EnumEthereumNetwork|number} enEthereumNetworkId_in - A valid Ethereum network ID.
 *
 * @return {string}
 */
function _doGetHousePublicAddress(enEthereumNetworkId_in)
{
	let errPrefix = "(_doGetHousePublicAddress) ";
	
	let enEthereumNetworkId = conformEthereumNetworkId(errPrefix, enEthereumNetworkId_in);
	
	let retHousePublicAddr = null;
	
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MAIN)
		retHousePublicAddr = process.env.MAIN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.MORDEN)
		retHousePublicAddr = process.env.MORDEN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.ROPSTEN)
		retHousePublicAddr = process.env.ROPSTEN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.RINKEBY)
		retHousePublicAddr = process.env.RINKEBY_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.KOVAN)
		retHousePublicAddr = process.env.KOVAN_HOUSE_PUBLIC_ADDRESS;
	if (enEthereumNetworkId_in == EnumEthereumNetwork.GANACHE || enEthereumNetworkId_in == '999')
		retHousePublicAddr = process.env.GANACHE_HOUSE_PUBLIC_ADDRESS;
		
	if (!retHousePublicAddr)
		throw new Error(errPrefix + "Don't know how to handle Ethereum network ID: " + enEthereumNetworkId);
		
	return retHousePublicAddr;
}



/**
 * Using the target Ethereum network currently set in the environment, return
 * 	the house public address from the environment for that network.
 *
 * @return {string} - Returns the correct house public address from the environment given
 * 	the Ethereum network currently set in the environment.
 */
function getHousePublicAddress() {
	let errPrefix = "(getHousePublicAddress) ";

	// Get the target Ethereum network ID set in the environment.
	let enEthereumNetworkId = getTargetEthereumNetworkId();
	
	return _doGetHousePublicAddress(enEthereumNetworkId);
}

/**
 * Returns a unique random ID we can use as nonce.
 *
 * 	TODO: ASk Open Zeppelin if this is secure enough to use for the
 * 		EtherBandBattlesManger request nonce purposes.
 *
 * NOTE: This method will throw an error if the returned nonce is
 * 	longer than 32 bytes, since Solidity has a max length of 32
 * 	for byte arrays, the preferred type to use for encoding
 * 	strings in an efficient manner in Solidity.
 *
 * @return {string} - Returns a unique ID that can be used as a nonce.
 */
function getNonceViaUuid(){
	let errPrefix = '(getNonceViaUuid) ';
	let newNonce = uuidv4();
	
	// UUID returns unique ID strings that are 36 characters long.  Fortunately,
	//  we can remove the dashes it includes to make the nonce 32 characters long.
	let retNonce = newNonce.replace(/\-/g, '');
	
	if (retNonce.length > 32)
		throw new Error(errPrefix + "Nonce too long, greater than 32 characters in length.  Actual length: " + retNonce.length);
		
	return retNonce;
}

/**
 * This method takes a string and turns it into a format that is compatible with
 * 	for use with a smart contract method call that requires a bytes32 parameter.
 *
 * @param {string} str - The string to convert.
 *
 * @return {string | string | *} - Returns an encoded bytes32 string that can
 * 	be used with a smart contract call.
 */
function stringToBytes32(str) {
	let errPrefix = '(stringToBytes32) ';
	
	if (common_routines.isEmptyString(str))
		throw new Error(errPrefix + "The string is empty.");
		
	if (str.length > 32)
		throw new Error(errPrefix + "The string is longer than 32 bytes.");

	// const localWeb3 = new Web3(Web3.givenProvider);
	return web3.utils.fromAscii(str);
}

/**
 * This method takes a string and pads it to 32 characters in length using
 * 	the given pad character.
 *
 * NOTE: Use this function when sending signed values to a smart contract
 * 	method.  Otherwise, when the smart contract tries to use the
 * 	Solidity ecrecover() function on the message parameter to get back the
 * 	public address of the signer, it will get the wrong value.  This happens
 * 	because if you don't use this function you end up signing
 * 	the message on the Web3JS side on a string that is most likely shorter than
 * 	32 characters.  However,  internally Web3JS will upside the message to a
 * 	32 character value to make it compatible with the smart contract, when
 * 	it converts the string to bytes32 value to be sent to the target
 * 	contract method.
 *
 * @param {string} str - The string to convert.
 * @param {string} padChar - The character to pad the string with if it's
 * 	less than 32 characters long.  The default is the SPACE character.
 *
 * @return {string | string | *} - Returns a string of exactly 32 characters
 * 	in length.
 */
function padStringTo32Bytes(str, padChar = ' ') {
	let errPrefix = '(padStringTo32Bytes) ';
	
	if (common_routines.isEmptyString(str))
		throw new Error(errPrefix + "The string is empty.");

	if (str.length > 32)
		throw new Error(errPrefix + "The string is longer than 32 bytes.");
		
	let numChars = 32 - str.length;
	
	for (let i = 0; i < numChars; i++)
		str += padChar;

	// Sanity check.
	if (str.length < 32)
		throw new Error(errPrefix + "The padded string is shorter than 32 bytes.");
		
	// const localWeb3 = new Web3(Web3.givenProvider);
	return str;
}

/**
 * This method is an alias for the Web3JS function that undoes what the fromAscii()
 * 	function does to strings.
 *
 * @param {string} strBytes32FromSmartContract - A bytes32 value returned by
 * 	a smart contract via the Web3JS interface.
 * @param {boolean} bTrimTrailingSpaces - If TRUE then trailing spaces will be
 * 	trimmed from the returned string.  If not, they will be left alone.
 *
 * @return {*|string} - Returns the original string.
 */
function decodeBytes32Return(strBytes32FromSmartContract, bTrimTrailingSpaces = true) {
	let methodName = 'decodeBytes32Return';
	let errPrefix = '(' + methodName + ') ';
	
	if (misc_shared_lib.isEmptySafeString(strBytes32FromSmartContract))
		throw new Error(errPrefix + 'The strBytes32FromSmartContract parameter is empty.');
	
	if (strBytes32FromSmartContract.length != 66)
		throw new Error(errPrefix + 'The strBytes32FromSmartContract parameter is the wrong length.');
		
	let retStr = web3.utils.toAscii(strBytes32FromSmartContract);
	
	if (bTrimTrailingSpaces)
		return retStr.trim();
	else
		return retStr;
}

/**
 * Simple function to centralize any modifications we make to the estimated
 * 	gas value, in an attempt to avoid transaction errors like the
 * 	"transaction underpriced" error we sometimes get on Rinkeby, etc.
 *
 * @param {string} operationDesc - A short description of the Ethereum transaction we
 * 	are modifying the estimated gas for.  Used in logging operations.
 * @param {EnumEthereumNetwork} ethereumNetworkId - The ID of the target Ethereum network.
 * @param {number} estimatedGas - The estimated gas reported to us by the
 * 	estimateGas() function for a smart contract method call.
 *
 * @return {number} - The modified estimated gas value.
 */
function fixEstimatedGas(operationDesc, ethereumNetworkId, estimatedGas)
{
	let errPrefix = '(fixEstimatedGas) ';
	
	if (misc_shared_lib.isEmptySafeString(operationDesc))
		throw new Error(errPrefix + 'The Ethereum transaction operation description is empty.');
		
	if (!ethereumNetworkId || ethereumNetworkId <= 0)
		throw new Error(errPrefix + 'The Ethereum network ID is invalid: ' + ethereumNetworkId);
		
	if (estimatedGas <= 0)
		throw new Error(errPrefix + 'The estimated gas value is invalid: ' + estimatedGas);
		
	// Doubling the gas for now across all networks untilwe figure out
	//  the real "transaction underpriced" issue. Gas must be an integer
	// 	or we will get an Exception when we try to execute the Ethereum
	// 	transaction so we truncate the result.
	// TODO: See if we can eliminate this.
	let modifiedGas = Math.trunc(estimatedGas * 1.2);
	
	// Log it.
	console.log(
		errPrefix
		+ 'Fixing estimated gas for Ethereum network ('
		+ ethereumNetworkIdToString(ethereumNetworkId)
		+ ') -> operation('
		+ operationDesc
		+ ').  Original gas / modified gas: '
		+ estimatedGas
		+ ' / '
		+ modifiedGas);
		
	return modifiedGas;
}

/**
 * This method conforms the given value to a valid transaction status value in
 * 	numeric form, It is assumed that the value was taken from a result object
 * 	returned from a Web3JS getTransactionReceipt() call.
 *
 * @param {boolean|number|string} rawTransactionStatus - The raw transaction status value
 * 	in boolean format, numeric format, or in string format.
 *
 * @return {number} - Returns the transaction status value in numeric format.
 */
function conformRawTransactionStatus(rawTransactionStatus) {
	let methodName = 'conformRawTransactionStatus';
	let errPrefix = '(' + methodName + ') ';
	
	let transactionStatus = null;
	
	// Web3JS appears to return a true/false value instead of the 1/0 value we've seen in StackExchange posts.
	if (typeof rawTransactionStatus == 'boolean')
		transactionStatus = true ? EnumRawTransactionStatus.SUCCESS : EnumRawTransactionStatus.FAILED;
	// Conform the value to a number.
	else if (typeof rawTransactionStatus == 'number')
		transactionStatus = rawTransactionStatus;
	else if (typeof rawTransactionStatus == 'string')
		transactionStatus = parseInt(rawTransactionStatus);
	// Any other type is invalid.
	else
		throw new Error('The type of value in the raw transaction status parameter is not a number or a number in string format.');
	
	// The only valid transaction statuses at this time are 0 or 1.
	if (transactionStatus != EnumRawTransactionStatus.FAILED && transactionStatus != EnumRawTransactionStatus.SUCCESS)
		throw new Error(errPrefix + 'Invalid transaction receipt status field value: ' + rawTransactionStatus);
		
	return transactionStatus;
}

/**
 * This method conforms the given value to a valid transaction gas-used-Gwei value.
 * 	It is assumed that the value was taken from a result object returned from a Web3JS
 * 	getTransactionReceipt() call.
 *
 * @param {boolean|number|string} rawGasUsedGwei - The raw transaction gas-used-Gwei value
 * 	in numeric format or string format.
 *
 * @return {number} - Returns the gas-used-Gwei value in numeric format.
 */
function conformGasUsedGwei(rawGasUsedGwei) {
	let methodName = 'conformGasUsedGwei';
	let errPrefix = '(' + methodName + ') ';
	
	let gasUsedGwei = null;
	
	// Conform the value to a number.
	if (typeof rawGasUsedGwei == 'number')
		gasUsedGwei = rawGasUsedGwei;
	else if (typeof rawGasUsedGwei == 'string')
		gasUsedGwei = parseInt(rawGasUsedGwei);
	// Any other type is invalid.
	else
		throw new Error('The type of value in the raw gas-used parameter is not a number or a number in string format.');
		
	// Validate the numeric value.
	common_routines.validateAsIntegerGreaterThanZero(methodName, gasUsedGwei);
	
	return gasUsedGwei;
}

/**
 * Simple helper method that returns TRUE if the given raw transaction status indicates
 * 	the transaction failed.  Otherwise FALSE is returned.
 *
 * @param {number}string} rawTransactionStatus - The raw transaction status value
 * 	in numeric format, or in string format.
 *
 * @return {boolean}
 */
function isFailedRawTransactionStatus(rawTransactionStatus) {
	let transactionStatus = conformRawTransactionStatus(rawTransactionStatus);
	
	return (transactionStatus == EnumRawTransactionStatus.FAILED);
}

/**
 * Simple helper method that returns TRUE if the given raw transaction status indicates
 * 	the transaction succeeded.  Otherwise FALSE is returned.
 *
 * @param {number}string} rawTransactionStatus - The raw transaction status value
 * 	in numeric format, or in string format.
 *
 * @return {boolean}
 */
function isSuccessfulRawTransactionStatus(rawTransactionStatus) {
	let transactionStatus = conformRawTransactionStatus(rawTransactionStatus);
	
	return (transactionStatus == EnumRawTransactionStatus.SUCCESS);
}

/**
 * Converts the given Solidity tuple formatted object received as the result of a
 * 	smart contract method call to a Javascript object that MUST be an exact mirror
 * 	image of the tuple object!  (i.e. - Exact same number of fields in the exact
 * 	same order.
 *
 * NOTE: A Solidity tuple result object is formatted with 0-based numeric field
 * 	indexes for each field.  However the indexes are in string format and are
 * 	object key's, and NOT as array subscripts.  For example:
 *
 * 	{ "0": <field value 1>, "1": <field value 2>, etc.
 *
 * @param {Object} solidityTupleFormatObj - A Solidity tuple formatted object
 * 	received from a smart contract method call.
 * @param objOfType - The type name of the object to create.  It must have a
 * 	parameterless constructor.  The type given MUST be for an object type that
 * 	is a mirror image of the Solidity tuple object or the result object will not
 * 	be valid.
 * @param {function} - Solidity passes back all strings currently.  If you need to
 * 	post-process the object so that certain fields are converted from strings
 * 	to the correct field type, pass in a function here that does that.
 *
 * @return {Object} - An object of the desired type will be returned whose
 * 	content is built from the solidity tuple formatted object given.
 */
function solidityTupleResultToMirrorObject(solidityTupleFormatObj, objOfType, funcPostProcessStrings = null) {
	let errPrefix = '(solidityTupleResultToMirrorObject) ';
	
	if (typeof solidityTupleFormatObj == 'undefined' || solidityTupleFormatObj ==  null)
		throw new Error(errPrefix + 'The Solidity tuple object is unassigned');
		
	if (typeof objOfType == 'undefined' || objOfType ==  null)
		throw new Error(errPrefix + 'The object of type parameter is unassigned.');
		
	if (funcPostProcessStrings != null && typeof funcPostProcessStrings != 'function')
		throw new Error(errPrefix + 'The value in the post-processing function parameter is not NULL, but is not a FUNCTION either.');
	
	try {
		let resultObj = new objOfType();
		
		let fldNum = 0;
		for (let propKey in resultObj) {
			let solidityObjPropKey = fldNum.toString();
			
			// Ignore functions in the result object.  We only want data fields.
			if (typeof resultObj[propKey] == 'function')
				continue;
			
			if (!solidityTupleFormatObj.hasOwnProperty(solidityObjPropKey))
				throw new Error(errPrefix + 'The Solidity tuple object is missing a field for field index: ' + solidityObjPropKey);
		
			resultObj[propKey] = solidityTupleFormatObj[solidityObjPropKey];
			
			fldNum++;
		}
		
		// Check for extra, unexpected fields.
		let extraSolidityObjPropKey = fldNum.toString();
		
		if (solidityTupleFormatObj.hasOwnProperty(extraSolidityObjPropKey))
			throw new Error(errPrefix + 'Too many fields found in the The Solidity tuple object.');
			
		// Call the post-processing function if one was provided.
		if (funcPostProcessStrings)
			funcPostProcessStrings(resultObj);
			
		return resultObj;
	}
	catch(err)
	{
		// Most errors are due to constructor of the target object type throwing and
		//  error.
		let typeName = objOfType.name;
		let errMsg = errPrefix + 'Object initialization from Solidity tuple object failed.  Did the target type constructor throw an error?: ' + typeName;
		
		errMsg += '\n Exception details: ' + misc_shared_lib.conformErrorObjectMsg(err);
		
		throw new Error(errMsg);
	}
}

// Yes.  Export the code so it works with require().
module.exports =
	{
		conformEthereumNetworkId: conformEthereumNetworkId,
		conformRawTransactionStatus: conformRawTransactionStatus,
		decodeBytes32Return: decodeBytes32Return,
		DEFAULT_BLOCK_TIMEOUT_SECONDS: DEFAULT_BLOCK_TIMEOUT_SECONDS,
		EnumEthereumNetwork: EnumEthereumNetwork,
		EnumVideoPlatforms: EnumVideoPlatforms,
		EnumGameState: EnumGameState,
		enumGameStateToString: enumGameStateToString,
		EnumPaymentType: EnumPaymentType,
		enumPaymentTypeToString: enumPaymentTypeToString,
		EnumRawTransactionStatus: EnumRawTransactionStatus,
		EthereumContractHelper: EthereumContractHelper,
		ethereumNetworkIdToString: ethereumNetworkIdToString,
		fixEstimatedGas: fixEstimatedGas,
		getHousePublicAddress: getHousePublicAddress,
		getHousePublicAddressWithId: getHousePublicAddressWithId,
		getNonceViaUuid: getNonceViaUuid,
		getTargetEthereumNetworkId: getTargetEthereumNetworkId,
		getMnemonic: getMnemonic,
		getPrivateKey: getPrivateKey,
		getWeb3ProviderUrl: getWeb3ProviderUrl,
		isFailedRawTransactionStatus: isFailedRawTransactionStatus,
		isSuccessfulRawTransactionStatus: isSuccessfulRawTransactionStatus,
		isValidGameState: isValidGameState,
		isValidPaymentType: isValidPaymentType,
		loadContractArtifacts_truffle: loadContractArtifacts_truffle,
		loadContractAbi_truffle: loadContractAbi_truffle,
		numberToEnumPaymentType: numberToEnumPaymentType,
		padStringTo32Bytes: padStringTo32Bytes,
		solidityTupleResultToMirrorObject: solidityTupleResultToMirrorObject,
		stringToBytes32: stringToBytes32,
		stringToEthereumNetworkId: stringToEthereumNetworkId,
		WrapTransactionResult: WrapTransactionResult,
		WrapTransactionReceiptResult: WrapTransactionReceiptResult
	};

