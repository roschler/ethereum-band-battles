/**
 * This file contains code related to the object that is used to keep a record of all payments made.
 */

const common_routines = require("./common-routines");
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const web3utils_lib = require('web3-utils');
const EnumPaymentType = require('./solidity-helpers-misc').EnumPaymentType;
const enumPaymentTypeToString = require('./solidity-helpers-misc').enumPaymentTypeToString;
const isValidPaymentType = require('./solidity-helpers-misc').isValidPaymentType;
const uuidv4 = require('uuid/v4');

/**
 * This object stores the details about a payment that was made to the Ethereum network.
 *
 * NOTE: This object is intended to be created AFTER the block containing the Ethereum
 * 	payment has been confirmed/mined.
 *
 * @constructor
 */
function PaymentMadeRecord() {
	
	/** @property {string} - id */
	var self = this;
	
	let objectName = 'PaymentMadeRecord';
	let errPrefix = '(' + objectName + '::' + 'constructor)';

	/** @property {string} - Automatically generated unique ID. */
	this.id = uuidv4();
	
	/** @property {Date} - The date/time the payment was made.  The default is when the object was created */
	this.dtCreated = Date.now();
	
	/** @property {string} - This field contains the ID of the entity that made the payment.
	 *	It is taken automatically from the PAYMENT_SOURCE_ID environment variable.
	 */
	this.paymentSourceId = null;
	
	/** @property {string} - This is the context the payment was made in.  (e.g. - This would contain a game
	 *		ID if the payment was associated with an EtherBandBattles game, aka the "gameId" field in this
	 *		context.)
 	 */
	this.paymentContextId = null;
	
	
	/** @property {string} - If the payment is being made that involves a resource a payment is associated
	 * 		with, it will have the ID of that resource here.  If not, there will be a constant (label)
	 * 		that describes the payment type in general.
	 *
	 * EXAMPLE (EtherBandBattles):
	 *
	 * 		If the payment was to a player or a band this field would contain the video ID associated with
	 * 		the payment.  If it was made to the House or anything else, it will be NULL.
	 */
	this.paymentResourceId = null;
	
	/** @property {string} - A valid Ethereum address that represents the payee. */
	this.payeeAddr = null;
	
	/** @property {number} - The amount of the payment in Gwei.  Must be a positive non-zero integer. */
	this.paymentAmountGwei = null;
	
	/** @property {EnumPaymentType} - The type of payment this is. */
	this.paymentType = EnumPaymentType.NOTSET;
	
	/** @property {Date} - The timestamp that marks the time the payment was scheduled for being paid. */
	this.startTimestamp = null;
	
	/** @property {Date} - The timestamp that marks the time the Ethereum block containing the
	 * 		payment transaction was confirmed/mined (i.e. - the time the payment was actually "paid"). */
	this.endTimestamp = null;
	
	this.getPaymentRoundTripTime_milliseconds = function() {
		let methodName = 'getPaymentRoundTripTime_milliseconds';
		let errPrefix = '(' + methodName + ') ';
		
		if (!self.startTimestamp && !self.endTimestamp)
			throw new Error(errPrefix + ' The start and end timestamps for the payment were never set.');
		if (!self.startTimestamp)
			throw new Error(errPrefix + ' The start timestamp for the payment was never set.');
		if (!self.endTimestamp)
			throw new Error(errPrefix + ' The end timestamp for the payment was never set.');
		if (self.startTimestamp > self.endTimestamp)
			throw new Error(errPrefix + ' The start timestamp is greater than the end timestamps for the payment.');
			
		// Return the total time in seconds it took for the payment to be made, from the time
		//  it was scheduled for payment until the time the Ethereum block containing the
		//  payment transaction was actually confirmed/mined.
		return self.endTimestamp - self.startTimestamp;
	}
	
	/**
	 * This function validates the fields of this object.
 	 */
	this.validateMe = function() {
		let methodName = 'validateMe';
		let errPrefix = '(' + objectName + '::' + methodName + ') ';
		
		if (misc_shared_lib.isEmptySafeString(self.id))
			throw new Error(errPrefix + 'The ID is empty.');
			
		if (self.dtCreated == 0 || self.dtCreated == null)
			throw new Error(errPrefix + 'The creation date/time is invalid.');
		
		if (misc_shared_lib.isEmptySafeString(self.paymentSourceId))
			throw new Error(errPrefix + ' The source or name of the entity that made the payment is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.paymentResourceId))
			throw new Error(errPrefix + ' The source or name of the entity that made the payment is empty.');
			
		if (misc_shared_lib.isEmptySafeString(self.payeeAddr))
			throw new Error(errPrefix + ' The field that holds the Ethereum public address of the payee to pay is empty.');
			
		if (!web3utils_lib.isHexStrict(self.payeeAddr))
			throw new Error(errPrefix + ' The Ethereum public address of the payee is not a valid hex address string.');
			
		if (!isValidPaymentType(self.paymentType))
			throw new Error(errPrefix + ' the payment type is not set or is invalid: ' + self.paymentType.toString());
			
		// The payee amount should be an integer and greater than 0.
		common_routines.validateAsIntegerGreaterThanZero(objectName + '::' + methodName + '::payeeAmountGwei', self.payeeAmountGwei);
	}
	
	// -------------------- CONSTRUCTOR CODE -----------------
	// Grab the payment source ID from the environment.  Throw an error if it is not found.
	if (!process.env.hasOwnProperty('PAYMENT_SOURCE_ID'))
		throw new Error(errPrefix + 'The payment source ID is not set in the environment.');
		
	self.paymentSourceId = process.env.PAYMENT_SOURCE_ID;
}

module.exports = {
	PaymentMadeRecord: PaymentMadeRecord
}