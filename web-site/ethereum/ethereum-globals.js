/**
 * This module contains a singleton that creates the needed global elements required
 * 	by all the code in this app that perform Ethereum related functions.
 *
 */

// ----------------------------------------------------------------------

const Web3 = require('web3');
const web3Global = new Web3();

// ----------------------------------------------------------------------

const common_routines = require('../common/common-routines');
const ebbDetails = require('../common/contract-details').EtherBandBattlesManager_details;
const misc_shared_lib = require ('../public/javascripts/misc/misc-shared');
const solidity_helpers_misc = require('../common/solidity-helpers-misc');
const winstonLogger = require('../common/winston-logging-module').winstonLogger;


const DUMMY_ETHEREUM_TRANSACTION_ID = "no_app_event_id_required";

/**
 * The different kinds of Ethereum transaction result types in an EtherBandBattles game.
 * 	They are not listed in alphabetic order, but in the order that they occur during
 * 	a game.
 *
 * @type {{notset: string, game_creation: string, set_house_public_address: string, add_player: string, start_player:string, add_game_round_result: string, make_payments: string, distribute_payments:string}}
 */
EnumEthereumTransactionType_ebb = {
	// The transaction type has not been set yet.
	notset: "notset",
	// The transaction creates a game.
	game_creation: "game_creation",
	// Set the House public address for a game.
	set_house_public_address: "set_house_public_address",
	// The transaction adds a player to a game.
	add_player: "add_player",
	// The transaction starts a game.
	start_game: "start_game",
	// The transaction adds a game round result to a game.
	add_game_round_result: "add_game_round_result",
	// Transaction causes the game to be finalized and the payments calculated for the players and bands.
	finalize_game: "finalize_game",
	// The transaction actually makes a payment to someone.
	make_payments: "make_payment",
}

/**
 * The different statuses for a delayed Ethereum transaction.
 *
 * @type {{pending: string, in_progress: string, resolved: string, rejected: string}}
 */
EnumDelayedEthTransStatus = {
	pending: "pending",
	in_progress: "in progress",
	resolved: "resolved",
	rejected: "rejected"
}

/**
 *
 * @param {Object} txHashObj - A valid Ethereum transaction hash.
 * @param {number} nonceUsed - The nonce used in the transaction.
 * @param {string} operationDesc - The description of the Ethereum transaction.
 *
 * @constructor
 */
function SignedTransactionResult(txHashObj, nonceUsed, operationDesc)
{
	let errPrefix = '(SignedTransactionResult) ';
	
	if (!txHashObj)
		throw new Error(errPrefix + 'The Ethereum transaction object is unassigned.');
		
	if ( (nonceUsed == null) || nonceUsed < 0)
		throw new Error(errPrefix + 'Invalid nonce used.');
		
	if (misc_shared_lib.isEmptySafeString(operationDesc))
		throw new Error(errPrefix + 'The Ethereum operation description is empty.');
		
	this.txHashObj = txHashObj;
	this.nonceUsed = nonceUsed;
	this.operationDesc = operationDesc;
	
	/**
	 * This function returns the contents of this object in a human friendly string.
	 *
	 * @return {string}
	 */
	this.prettyPrint = function()
	{
		let retMsg =
			'txHash: ' + self.txHashObj.transactionHash
			+ ', nonceUsed: ' + self.nonceUsed
			+ ', blockNumber: ' + self.txHashObj.blockNumber
			+ ', operationDesc: ' + self.operationDesc
			+ ', cumulativeGasUsed: ' + self.txHashObj.cumulativeGasUsed
			+ ', from: ' + self.txHashObj.from
			+ ', to: ' + self.txHashObj.to;
			
		return retMsg;
	}
}


// ------------------ BEGIN: PROPERTY NAMES FOR CONFIRM AND COMPLETE OBJECT BAGS ------------

/*

// EXAMPLE: Exported constants with namespace.
const EthereumGlobalConstants = {
	BAG_PROP_ETHEREUM_TRANSACTION_ID: 'app_event_id',
	// Our server side assigned game ID.
	BAG_PROP_GAME_ID: 'game_id',
	// The game ID used by the smart contract, which is NOT the same as the
	//  server side assigned ID.
	BAG_PROP_GAME_ID_IN_SMART_CONTRACT: 'game_id_in_smart_contract',
	BAG_PROP_TEMP_GAME_DETAILS_OBJ: 'temp_game_details_obj',
	BAG_PROP_USER_ID: 'user_id',
	BAG_PROP_TEMP_USER_DETAILS_OBJ: 'temp_user_details_obj',
};
*/

// ------------------ END  : PROPERTY NAMES FOR CONFIRM AND COMPLETE OBJECT BAGS ------------

// Singleton pattern.
const EthereumGlobals = (function() {
	const self = this;
	
	this.web3Global = web3Global;
	
	this.lastNonceUsed = null;

	/** @property {EnumEthereumNetwork} ethereumNetworkId - The ethereum network ID
	 *   the server is using.
	 */
	this.ethereumNetworkId = solidity_helpers_misc.getTargetEthereumNetworkId();
	
	/** @property {string} web3ProviderUrl - The URL that represents the location of
	 *	 Ethereum network the server is using.
	 */
	// Initialize the Web3 object with the correct provider URL given the desired
	//  Ethereum network ID.
	this.web3ProviderUrl = solidity_helpers_misc.getWeb3ProviderUrl(this.ethereumNetworkId);
	
	this.web3Global.setProvider(new this.web3Global.providers.HttpProvider(this.web3ProviderUrl));
	
	/** @property {Object} ebbContractInstance - A reference to the actual EtherBandBattles
	 *		contract on the target Ethereum network the server is using to run the games.
	 */
	this.ebbContractInstance = ebbDetails.getContractInstance_server_side(web3Global, this.ethereumNetworkId);
	
	/**
	 * This promise when completed returns the nonce to use for the next Ethereum transaction processed by
	 * 	this server.
	 *
	 * @return {Promise<any>}
	 */
	this.getNonce_promise = function() {
		let errPrefix = '(getNonce_promise) ';
		
		return new Promise(function(resolve, reject) {
			try	{
				// Get a nonce using the public key by using the current transaction count
				//  for that key/account.
				self.web3Global.eth.getTransactionCount(self.ebbContractHelperObj.publicAddr)
				.then(function(transactionCount)
				{
					// If the global nonce has not been initialized yet, do it now.
					if (self.lastNonceUsed === null)
						self.lastNonceUsed = transactionCount;
					else
						// Increment the global last nonce used.
						self.lastNonceUsed++;
						
					// The transaction count must never be greater than our global last nonce used variable.
					if (transactionCount > self.lastNonceUsed)
						throw new Error(errPrefix + 'The Ethereum transaction count for our account is greater than our global last nonce used variable.');
				
					// Resolve the promise with the updated nonce.
					resolve(self.lastNonceUsed);
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
	
	
	// Create a contract helper object for EtherBandBattlesManager at the last known deployment address.
	// 	Note, for proxied contracts see the zos.local.json file.
	this.ebbContractHelperObj =
		new solidity_helpers_misc.EthereumContractHelper(
			this.ethereumNetworkId,
			web3Global,
			ebbDetails,
			solidity_helpers_misc.getPrivateKey());
			
	return this;
})();

module.exports = {
	DUMMY_ETHEREUM_TRANSACTION_ID: DUMMY_ETHEREUM_TRANSACTION_ID,
	EnumDelayedEthTransStatus: EnumDelayedEthTransStatus,
	EnumEthereumTransactionType_ebb: EnumEthereumTransactionType_ebb,
	// EthereumGlobalConstants: EthereumGlobalConstants,
	EthereumGlobals: EthereumGlobals,
	SignedTransactionResult: SignedTransactionResult
}
