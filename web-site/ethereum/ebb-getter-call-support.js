/**
 * This module contains code to make calling various getter methods in the EtherBandBattlesManager smart
 * 	contract easier.
 */

const conformErrorObjectMsg = require('../public/javascripts/misc/misc-shared').conformErrorObjectMsg;
const GameDetailsServerSideOnly = require('../common/game-details-server-side-only').GameDetailsServerSideOnly;
const GamePaymentsSummary = require('../common/game-details-server-side-only').GamePaymentsSummary;
const GameDetails = require('../public/javascripts/game-objects/game-details').GameDetails;
const EthereumGlobals = require('./ethereum-globals').EthereumGlobals;
const EnumValidateMeTypes = require('../public/javascripts/misc/validation').EnumValidateMeTypes;

/**
 * This function returns a promise that calls the getGamePaymentsSummary() method in the EtherBandBattlesManager
 *  smart contract and returns a GamePaymentsSummary object derived from that call's result object.
 *
 *  @param {GameDetails} gameDetailsObj - A valid game details object.
 *
 * @return {Promise<any>} - The promise returns a GamePaymentsSummary object.
 */
function getGamePaymentsSummary_promise(gameDetailsObj) {
	let errPrefix = '(getGamePaymentsSummary_promise) ';
	
	return new Promise(function(resolve, reject) {
		try	{
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object parameter is unassigned.');
			if (!(gameDetailsObj instanceof GameDetails))
				throw new Error(errPrefix + 'The value in the gameDetailsObj parameter is not a GameDetails object.');
				
			// Validate it.
			gameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);
				
			let gamePaymentsSummaryObj = new GamePaymentsSummary();
			
			EthereumGlobals.ebbContractInstance.methods.getGamePaymentsSummary(gameDetailsObj.idInSmartContract).call()
			.then(result => {
				// Initialize our game payments summary object from the object returned by the
				//		getGamePaymentsSummary() call.
				gamePaymentsSummaryObj.initializeFromGamePaymentsSummary(result);
				
				// Resolve the promise with the object we built containing the game payments summary.
				resolve(gamePaymentsSummaryObj);
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

module.exports = {
	getGamePaymentsSummary_promise: getGamePaymentsSummary_promise
}
