/**
 * This module contains code related to server side only data objects and elements.
 */

const common_routines = require("./common-routines");
const conformErrorObjectMsg = require("../public/javascripts/misc/misc-shared").conformErrorObjectMsg;
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const conformResultToNumber = require('../ethereum/ethereum-ebb-helpers').conformResultToNumber;

function GamePaymentsSummary() {
	var self = this;
	
	let objectName = 'GamePaymentsSummary';
	let methodName = objectName + '::' + 'GamePaymentsSummary';
	let errPrefix = '(' + methodName + ') ';
	
	/** @property {number} -  The total payments made to the House in o particular game. */
    this.totalHousePayment = 0;
    
	/** @property {number} -  The total payments made or put in escrow for all the bands that
	 *		had videos played in o particular game. */
    this.totalBandPaymentsOrEscrows = 0;
    
	/** @property {number} -  The total payments to all the players in o particular game. */
	this.totalPlayerPayments = 0;
	
	/**
	 * This method initializes our values from the result object returned by a call to the
	 * 	EtherBandBattlesManager smart contract to get the payments summary.
	 *
	 * @param {Object} ebb_gamePaymentsTuple - A result object received from a call to the
	 * 	smart contract's getGamePaymentsSummary() method.
	 */
	this.initializeFromGamePaymentsSummary = function(ebb_gamePaymentsTuple) {
		let methodName = objectName + '::' + 'initializeFromGamePaymentsSummary';
		let errPrefix = '(' + methodName + ') ';
		
		if (typeof ebb_gamePaymentsTuple == 'undefined' || ebb_gamePaymentsTuple == null)
			throw new Error(errPrefix + 'The ebb_gamePaymentsTuple parameter is unassigned.');
			
		try {
			// There should be 3 fields in the tuple received from the EtherBandBattlesManager smart contract.
			let numFieldsExpected = 3;
			
			// Make sure all the expected fields are there.
			for (let i = 0; i < numFieldsExpected; i++) {
				let tuplePropKey = i.toString();
				let ourPropKey = null;
				
				switch(i) {
					case 0:
						ourPropKey = 'totalHousePayment';
						break;
					case 1:
						ourPropKey = 'totalBandPaymentsOrEscrows';
						break;
					case 2:
						ourPropKey = 'totalPlayerPayments';
						break;
					default:
						throw new Error(errPrefix + 'Invalid tuple field index.');
				}
			
				if (!self.hasOwnProperty(ourPropKey))
					throw new Error(
						errPrefix
						+ 'Our game payments summary object is missing the property named: '
						+ ourPropKey);
						
				self[ourPropKey] = conformResultToNumber(ebb_gamePaymentsTuple[tuplePropKey]);
			}
		}
		catch (err) {
			throw new Error(errPrefix + conformErrorObjectMsg(err));
		}
	}
}

/**
 * This object is for storing details about a game that should be known only on the
 * 	server side, to prevent improper manipulation of certain data elements important
 * 	to the game mechanics, and also because some of the fields contain sensitive
 * 	information.
 *
 * @constructor
 */
function GameDetailsServerSideOnly()
{
	let errPrefix = '(GameDetailsServerSideOnly) ';
	
	var self = this;
	
	/** @property {String|null} gameId - The game ID. */
	this.gameId = null;
	
	/** @property {number} totalNumberOfRounds - The total number of rounds of game play in the game.
	 *
	 * Note: This will be equal to the number of players in the game and therefore the number
	 * 	of videos in the game too.  All three values should be equal.  This value is filled in
	 * 	when the game is started because that is when the number of players/rounds/videos i
	 * 	locked for the game.
	 */
	this.totalNumberOfRounds = -1;
	
	/**
	 * Zero is an invalid count of completed rounds of play.  The server side code should increment
	 *  this value before adding a game round result to the smart contract.
	 *
	/** @property {number} countCompletedRoundsOfPlay - The number of completed rounds of game play. */
	this.countCompletedRoundsOfPlay = 0;
	
	// -------------------- BEGIN: Gas Usage Details --------------
	
	// The fields below are filled in by the various on-completion handlers for all the
	//	server side paid transactions that occur during the execution of a game.  They
	//	assist in making per-game ROI and profitability calculations for the server.
	
	/** @property {number} - The amount of gas in Gwei used during the Metamask transaction that created the
	 * 		game.  (i.e. - the amount of gas the game creator paid to create the game.)  */
	this.gameCreatorGasUsed = 0;
	
	/** @property {number} - The amount of gas in Gwei used during the Metamask transaction that added
	 * 		a new player to the game that was not the game creator.  (i.e. - the amount of gas the
	 * 		player paid to enter the game.)  */
	this.ngcPlayersGasUsed = 0;
	
	/** @property {number} - The total amount of gas in Gwei paid by the server on behalf of the
	 *		game.  This is our expenses for the game except for the gas used in making payments.
	 *		Currently payments are only tracked by the smart contract by the payee Ethereum
	 *		public address.  Therefore, to calculate the total profitability for a game we
	 *		will need to subtract an estimate of the gas used in making the payments from the
	 *		main profitability calculation.
	 */
	this.serverPaidGasUsed = 0;
	
	/** @property {string} - The House address assigned to the game. */
	this.houseAddr = null;
	
	// -------------------- END  : Gas Usage Details --------------
	
	// -------------------- BEGIN: Income/Accounting --------------
	
	/** @property {string} - The amount of Ether the House received as payment for the game. */
	// this.paymentToHouse = null;
	
	
	/** @property {GamePaymentsSummary} - The summary of payments made to players and bands. */
	this.gamePaymentsSummary = null;
	
	// -------------------- END  : Income/Accounting --------------
	
	/**
	 * This function tells you if the game is over based on the number of rounds of play that
	 * 	have been completed, when compared to the total number of rounds of play in the game.
	 *
	 * @return {boolean} - Returns TRUE if the count of completed rounds of game play equals
	 * 	the total number of rounds of play in the game.
	 */
	this.isGameOver = function()
	{
		let errPrefix = '(GameDetailsServerSideOnly::isGameOver) ';
		
		// Sanity checks.
		if (self.countCompletedRoundsOfPlay < 0)
			throw new Error(errPrefix + 'The count of completed rounds of game play is less than 0.');
			
		if (self.countCompletedRoundsOfPlay > self.totalNumberOfRounds)
			throw new Error(errPrefix + 'The count of completed rounds of game play exceeds the total number of rounds of play in the game.');
			
		return (self.totalNumberOfRounds == self.countCompletedRoundsOfPlay);
	}
}

module.exports = {
	GameDetailsServerSideOnly: GameDetailsServerSideOnly,
	GamePaymentsSummary: GamePaymentsSummary
}