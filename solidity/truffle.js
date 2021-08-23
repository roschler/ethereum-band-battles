// Parse out the target network from the script arguments.
const argv = require('minimist')(process.argv);
let networkName = argv.network;

// If a network name is not provided, default to local.
if (networkName) {
	console.warn(`Network name provided: ${networkName}.`);
} else {
	console.warn(`Network name not provided.  Assuming "local".`);
	networkName = 'local';
}

/** Dump the script arguments before and after parsing them with minimist.
 *
console.log('arguments: ');
console.log(process.argv);
console.log('arguments parsed: ');
console.log(argv);

var networkName = argv.network;
console.log('Target network: ' + networkName);
 */

let infuraApiKey = process.env.INFURA_API_KEY;
const HDWalletProvider = require("truffle-hdwallet-provider");
const urlRinkebyWithInfuraApiKey = "https://rinkeby.infura.io/" + infuraApiKey;
const urlThetaSmartContractSandbox = "https://api-wallet.thetatoken.org/smart-contract/call?network=privatenet";
const urlRopstenWithInfuraApiKey = "https://ropsten.infura.io/" + infuraApiKey;
const truffleMigrateFrom = process.env.TRUFFLE_MIGRATE_FROM;

let mnemonic = null;
let accountNdx = -1;

// For Ganache, Use the environment value for the Ganache house public address.
let ganacheHousePublicAddr = process.env.GANACHE_HOUSE_PUBLIC_ADDRESS;

if (!ganacheHousePublicAddr) {
	// No house address provided for Ganache.  Use the one shown below.
	//  Note, if the account addresses change in Ganache this must be
	//  updated!  Currently taking this address from account index #2.
	ganacheHousePublicAddr = '0xd867c5512566ef75F797B31Dd623B450e43725Ff';
	
	console.warn(`A house public address was not provided for Ganache.  Using: ${ganacheHousePublicAddr}.`);
}

if (networkName == 'local') {

	mnemonic = process.env.MNEMONIC_TEST_NETWORK_GANACHE;

	if (!mnemonic) {
		// No mnemonic provided for Ganache.  Use the one shown below.
		//  Note, if the mnemonic changes in Ganache this must be
		//  updated!  Currently taking this address from account index #2.
		mnemonic = 'glory voice pole toilet industry visa inmate invest gas flock essence keep';
		
		console.warn(`A mnemonic not provided for Ganache.  Using: ${mnemonic}.`);
	}
	
	if (!infuraApiKey) {
		// Use this value for the Infura API key.  This value must be updated
		//  if the API key changes.
		infuraApiKey = 'WiSKCxIhTLDEEaP4KBSw';
	}
}


// For Theta, Use the environment value for the Theta house public address.
const thetaHousePublicAddr = process.env.THETA_HOUSE_PUBLIC_ADDRESS;

console.log(`networkName: ${networkName}.`);
console.log(`ganacheHousePublicAddr: ${ganacheHousePublicAddr}.`);
console.log(`thetaHousePublicAddr: ${thetaHousePublicAddr}.`);


// console.log('Using migrate "from" address: ' + truffleMigrateFrom);

if (networkName == 'local')
{
	if (!ganacheHousePublicAddr)
	{
		let errMsg = 'The house public address is not set in the environment for the Ganache network (local).';
		console.log (errMsg);
		throw new Error(errMsg);
	}
	
	if (!mnemonic)
		throw new Error(errPrefix + `The mnemonic was not set for Ganache/local.`);
		
	accountNdx = 1;
	
	console.warn(`'[GANACHE LOCAL] network: ${networkName}.`);
	console.warn(`    Using mnemonic: ${mnemonic}.`);
	console.warn(`    Infura API key: ${infuraApiKey}.`);
	console.warn(`    accountNdx: ${accountNdx}.`);
	
}
else if (networkName == 'rinkeby')
{
	mnemonic = process.env.MNEMONIC_TEST_NETWORK_RINKEBY;
	accountNdx = 1;
}
else if (networkName == 'ropsten')
{
	mnemonic = process.env.MNEMONIC_TEST_NETWORK_ROPSTEN;
	accountNdx = 1;
}
else if (networkName == 'theta_scs') {
	// Theta Smart Contracts Sandbox network.
	mnemonic = process.env.MNEMONIC_THETA_SCS;
	accountNdx = 1;
}

if (mnemonic == null)
{
	let errMsg = 'The mnemonic is undefined for the target network.';
	console.log (errMsg);
	throw new Error(errMsg);
}

// Validate settings.
if (!mnemonic)
	throw new Error('The server side mnemonic is not set!');
if (!infuraApiKey)
	throw new Error('The Infura API key is not set!');
	
console.log('Deployment settings: ');
console.log('    Using MNEMONIC: ' + mnemonic);
if (networkName == 'local')
	console.log('    Using FROM address: ' + ganacheHousePublicAddr);
else
	console.log('    Using account index: ' + accountNdx.toString());
console.log('    Target network: ' + networkName);

// NOTE: The ropsten and rinkeby provider function calls used to have a '+' sign before
//  the account index.
module.exports = {
  networks: {
    local: {
      host: "127.0.0.1",
      port: 8545,
      // port: 7545,
      from: ganacheHousePublicAddr,
      network_id: "*" // Match any network id
    },
  	/**
    local: {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          '127.0.0.1:8545',
          accountNdx);
	  },
      network_id: "*" // Match any network id
    },
    */
    ropsten: {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          urlRopstenWithInfuraApiKey,
          accountNdx);
	  },
	  network_id: 3
	},
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          urlRinkebyWithInfuraApiKey,
          accountNdx);
	  },
	  network_id: 4
	},
    // Theta smart contact sandbox.
    theta_scs: {
      provider: function() {
        return new HDWalletProvider(
          mnemonic,
          urlThetaSmartContractSandbox,
          accountNdx);
	  },
	  network_id: 5
	}
  },
  compilers: {
     solc: {
       /* version: "0.4.23" */
       version: "0.8.1"
       /*  version: "0.5.0" */
     }
  },
  /** Added solidity optimize in attempt to combat out of gas errors during migrates to Ganache. **/
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }  
};
