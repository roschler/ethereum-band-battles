/**
 * This file contains the elements other code requires for interacting with the Solidity contracts.
 *
 * 	NOTE: Remember to update the _deployedAt addresses for all contracts when a new deployment
 * 		takes place.  For ZeppelinOS contracts, makes sure you use the proxy contract address
 * 		and not the address of the contract being proxied!
 */

const common_routines = require ('./common-routines');
const misc_shared_lib = require ('../public/javascripts/misc/misc-shared');
const solidity_helpers_misc = require('./solidity-helpers-misc');
const EnumValidateMeTypes = require('../public/javascripts/misc/validation').EnumValidateMeTypes;

const path = require('path');

/**
 * NOTE: This object will be heavily modified later when we or Open Zeppelin start writing
 * 	the last deployment address to the Truffle JSON artifact file.  Write now that is not
 * 	happening so we manually copy the address into the object below after a new deployment.
 * 	In other words, for now, this object keeps track of the various deployment addresses
 * 	for our contracts on each network, but it requires manual updating.
 *
 * NOTE: This code is used on both the server and client side.  On the client side, it is
 * 	the responsibility of the code that runs in that context to fill in the ABI field member.
 *
 * @constructor
 */
// Singleton pattern.
const EtherBandBattlesManager_details = (function() {
	const self = this;
	
	/** @property {String} - The name of the contract as it is in the Solidity contract source code. */
	this.contractName = "EtherBandBattlesManager";
	
	/** @property {Array} -  The last known deployment address for the contract instance. */
	// DELETED.  We now get the last deployment address directly from the
	//  contract ABI we load at startup.
	// this._deployedAt = new Array();
	
	// TODO: Restore the address for the ZeppelinOS proxy contract.
	// this._deployedAt[solidity_helpers_misc.EnumEthereumNetwork.GANACHE] =
	//	"0xcc5f0a600fd9dc5dd8964581607e5cc0d22c5a78";


	// TODO: WARNING! These contract addresses must match the actual contract addresses
	//  on the respective blockchain networks!  Is there a way to automate this
	//  as a discovery process instead of hard-coding it?
	
	// TODO: Contract address for simplified non-Zeppelin O/S contract instance.
	// this._deployedAt[solidity_helpers_misc.EnumEthereumNetwork.GANACHE] = "0x96d953278408E9485374A115bDC0d03699a7DB49"; // "0x1bf9604db76fd3d6387fc126f297f517c4984132"; "0x8f508b43180aed127c41eca63c45b54bd6b8f688";
	// NON-PROXIED GANACHE
	// this._deployedAt[solidity_helpers_misc.EnumEthereumNetwork.RINKEBY] = "0xc157960644b2a197abcf84c36c84f195ea20afd8";
	// PROXIED GANACHE
	
	// this._deployedAt[solidity_helpers_misc.EnumEthereumNetwork.RINKEBY] = "0xf09077fe28e3197c9258de33270307d1d42c8ca6";
	
	// If we have an environment variable for the Rinkeby address, use it instead.
	// if (process.env.RINKEBY_CONTRACT_ADDRESS)
	//	this._deployedAt[solidity_helpers_misc.EnumEthereumNetwork.RINKEBY] = process.env.RINKEBY_CONTRACT_ADDRESS;
		
	/** @property {String} - The full path to the JSON file that contains the contract information. " */
	this.jsonFilename = path.resolve("./solidity/build/contracts/" + this.contractName + ".json");

	/** @property {Object} - The ABI for this contract. " */
	// Load the contract ABI from local storage, but only if we are running in Node.JS
	//
	// On the server side we use the globally defined contract address so we only do this check
	//  on the client side.  We check for the IS_NODE_JS environment variable to be TRUE to
	//  determine if we are running on the server.
	if (misc_shared_lib.isProcessGlobalVarPresent() && process.env.IS_NODE_JS == "true") {
		// Load the entire artifacts file that Truffle created.
		this.artifacts = solidity_helpers_misc.loadContractArtifacts_truffle(this.jsonFilename);
		this.abi = this.artifacts.abi;
	}
	else
	{
		// Assume we are running in the client side (browser) context. In this case
		//  it is the client code's responsibility to fill in this field.
		console.warn("ABI source file not available.  Assuming client side execution context.");
		
		// Get the ABI for this contract from the global configuration variable.
		this.abi = JSON.parse(g_AppConfig.ebb_abi_str);
	}

	/**
	 * This function returns the deployment address for the given Ethereum network.
	 *
 	 * @param {EnumEthereumNetwork} enEthereumNetworkId - The network ID of the desired
 	 * 	Ethereum network.
 	 * @param {Boolean} bErrorIfNotFound - If this variable is TRUE, then an
 	 * 	error will be thrown if deployment address can not be found for the desired
 	 * 	Ethereum network.  Otherwise NULL will be returned.
 	 *
	 * @return {String} - Returns the last known deployment address for the contract
	 * 	on the given network.  If no entry can be found, then if bErrorIfNotFound
	 * 	is TRUE an error will be thrown, otherwise NULL will be returned.
	 */		
	this.findDeployedAt = function(enEthereumNetworkId, bErrorIfNotFound = true)
	{
		let methodName = self.constructor.name + '::' + `findDeployedAt`;
		let errPrefix = '(' + methodName + ') ';
		
		if (!this.artifacts)
			throw new Error(errPrefix + `The contract artifacts property is unassigned.`);
			 	
		if (!this.artifacts.networks)
			throw new Error(errPrefix + `The contract artifacts property is missing or has an invalid "networks" property`);
			
		if (!this.artifacts.networks[enEthereumNetworkId])
			throw new Error(errPrefix + `The contracts "networks" property is missing an entry for the current network ID: ${enEthereumNetworkId}.`);
			
		let deployedAt = this.artifacts.networks[enEthereumNetworkId].address;
		
		if (misc_shared_lib.isEmptySafeString(deployedAt))
			throw new Error(errPrefix + `The deployedAt value found for in the contract artifacts property for network ID(${enEthereumNetworkId}) is empty.`);
		
		/*
		if (this._deployedAt[enEthereumNetworkId] &&
			!common_routines.isEmptyString(this._deployedAt[enEthereumNetworkId])) {
			return this._deployedAt[enEthereumNetworkId];
		}
		 */
		
		if (misc_shared_lib.isEmptySafeString(deployedAt)) {
			if (bErrorIfNotFound)
				throw new Error("Unable to find a deployment address for the desired network ID.");
			else
				return null;
		}
		
		return deployedAt;
	}
	
	/**
	 * This function returns a Web3.js compatible contract instance for the contract
	 *  using the given Ethereum network ID.  Use this call on the SERVER side.
	 *
	 * @param {Object} web 3- A valid Web3 interface object.
 	 * @param {EnumEthereumNetwork} enEthereumNetworkId - The network ID of the desired
 	 * 	Ethereum network.
 	 * @param {Object} options - A valid options object for the Web3 Contract constructor.
 	 * 	If NULL, then no options object is given then an empty options object will be
 	 * 	passed to the constructor.
 	 * @param {Boolean} bErrorIfNotFound - If this variable is TRUE, then an
 	 * 	error will be thrown if deployment address can not be found for the desired
 	 * 	Ethereum network.  Otherwise NULL will be returned.
 	 *
	 * @return {web3.eth.Contract} - Returns a contract instance for the given Ethereum network
	 * 	using the last known deployment address for the contract
	 * 	on the given network.  If no entry can be found, then if bErrorIfNotFound
	 * 	is TRUE an error will be thrown, otherwise NULL will be returned.
	 */
	this.getContractInstance_server_side = function(web3, enEthereumNetworkId, options = {}, bErrorIfNotFound = true)
	{
		let errPrefix = '(getContractInstance_server_side) ';
		
		if (!web3)
			throw new Error(errPrefix + "The Web3 object is unassigned.");
			
		// Makes sure the ABI field was filled in.
		if (!this.abi)
			throw new Error(errPrefix + "The contract ABI is empty.");
			
		let lastDeployedAtAddr = this.findDeployedAt(enEthereumNetworkId, bErrorIfNotFound);
		
		console.log(errPrefix + 'USING CONTRACT ADDRESS FROM findDeployedAt: ' + lastDeployedAtAddr);
		
		let contractInstance = new web3.eth.Contract(this.abi, lastDeployedAtAddr, options);
		
		return contractInstance;
	}
	
	/**
	 * This function returns a Web3.js compatible contract instance for the contract
	 *  using the given Ethereum network ID.  Use this call on the CLIENT side.
	 *
	 * @param {Object} web 3- A valid Web3 interface object.
 	 * @param {GameDetails} gameDetailsObj - A valid game details object.
 	 * @param {Object} options - A valid options object for the Web3 Contract constructor.
 	 * 	If NULL, then no options object is given then an empty options object will be
 	 * 	passed to the constructor.
 	 * @param {Boolean} bErrorIfNotFound - If this variable is TRUE, then an
 	 * 	error will be thrown if deployment address can not be found for the desired
 	 * 	Ethereum network.  Otherwise NULL will be returned.
 	 *
	 * @return {Object} - Returns a contract instance for the given Ethereum network
	 * 	using the last known deployment address for the contract
	 * 	on the given network.  If no entry can be found, then if bErrorIfNotFound
	 * 	is TRUE an error will be thrown, otherwise NULL will be returned.
	 */
	this.getContractInstance_client_side = function(web3, gameDetailsObj, options = {}, bErrorIfNotFound = true)
	{
		let errPrefix = '(getContractInstance_client_side) ';
		
		if (!web3)
			throw new Error(errPrefix + "The Web3 object is unassigned.");
			
		if (!gameDetailsObj)
			throw new Error(errPrefix + "The game details object is unassigned.");
			
		gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);;
		
		// Makes sure the ABI field was filled in.
		if (!this.abi)
			throw new Error(errPrefix + "The contract ABI is empty.");
		
		console.log(errPrefix + 'USING CONTRACT ADDRESS FROM GAME DETAILS OBJECT: ' + gameDetailsObj.contractAddress);
		
		let contractInstance = new web3.eth.Contract(this.abi, gameDetailsObj.contractAddress, options);
		
		return contractInstance;
	}
	
	return this;
})();

module.exports = {
	EtherBandBattlesManager_details: EtherBandBattlesManager_details
}