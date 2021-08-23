/**
 * This file contains code for the PaymentDetailsRecord object.
 */

const EnumPaymentType = require('../common/solidity-helpers-misc').EnumPaymentType;
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const common_routines = require("../common/common-routines");
const web3utils_lib = require('web3-utils');
const solidity_helpers_misc = require('../common//solidity-helpers-misc');

/**
 * This object is built directly from the fields returned by the call to
 * 	the smart contract's getNextPendingPaymentDetails().  It MUST BE
 * 	a mirror image of the EtherBandBattlesManager's structPendingPaymentDetails
 * 	structure.
 * 	
 * @constructor
 */
function EBB_PaymentDetailsRecord() {
	var self = this;
	
	let objectName = 'EBB_PaymentDetailsRecord';
	let methodName = objectName + '::' + 'constructor';
	let errPrefix = '(' + methodName  + ') ';
	
	/** @property {number} -  The ID of the game the payment is associated with.
	 *
	 * The reference date/time we pass to the smart contract's finalizeGame() call.  This
	 * 	value is attached to all the payments scheduled by the method call and ends up being
	 *	the start-time value for the payment round trip duration tracking fields in the
	 *	PaymentMadeRecord stored in Redis.
	 */
	this.clientReferenceTimestamp = null;

	/** @property {number} -  The ID of the game the payment is associated with.
	 *
	 * NOTE: This is the game ID the smart contract uses NOT the one used on the server side.
	 * 	It should be a positive integer greater than 0.
	 */
	this.idInSmartContract = null;
	
	/** @property {string} - The video ID the payment is associated with.
	 *
	 * If the pending payments record belongs to a band, than this is the
	 *  ID of the video that this payment is for, except for payments to
	 *  House.  In that case this field will contain the word "house".
	 */
	this.videoId = null;
	
	/** @property {string} - The Ethereum address to be paid.
	 */
	this.payeeAddr = null;

	/** @property {number} -  The amount of the payment, in Gwei.
	 */
	this.paymentAmountGwei = null;
	
	/** @property {EnumPaymentType} - The payment type. */
	this.paymentType = null;
	
	/**
	 * Validates the content of this object.
	 */
	this.validateMe = function() {
		let methodName = objectName + '::' + 'validateMe';
		let errPrefix = '(' + methodName + ') ';
		
		if (!(self.clientReferenceTimestamp instanceof Date))
			throw new Error(errPrefix + 'The clientReferenceTimestamp field is invalid or not a number.');
			
		common_routines.validateAsIntegerGreaterThanZero(methodName, self.idInSmartContract);
		
		if (misc_shared_lib.isEmptySafeString(self.videoId))
			throw new Error(errPrefix + 'The videoId parameter is empty.');
		
		if (misc_shared_lib.isEmptySafeString(self.payeeAddr))
			throw new Error(errPrefix + 'The payeeAddr parameter is empty.');
			
		if (!web3utils_lib.isHexStrict(self.payeeAddr))
			throw new Error(errPrefix + 'The Ethereum public address of the payee is not a valid hex address string.');
			
		if (!solidity_helpers_misc.isValidPaymentType(self.paymentType))
			throw new Error(errPrefix + 'The payment type is invalid');
			
		common_routines.validateAsIntegerGreaterThanZero(methodName, self.paymentAmountGwei);
	}
	
}

// ------------------------------ STATIC "CLASS" LEVEL FUNCTIONS --------------

/**
 * This function initializes all the fields from the object returned by the
 * 	smart contract's getNextPendingPaymentDetails() method.
 *
 * 	NOTE: The validateMe() method is called at the end of this method.
 *
 * @param {Object} solidityTupleFormatObj - An object formatted in Solidity tuple
 * 	format, returned by the getNextPendingPaymentDetails() method.
 *
 * @return {EBB_PaymentDetailsRecord} - Returns a EBB_PaymentDetailsRecord
 * 	whose content is derived from the given Solidity tuple format object.
 */
EBB_PaymentDetailsRecord.initializeFromObj = function(solidityTupleFormatObj) {
	let methodName = 'EBB_PaymentDetailsRecord' + '::' + 'initializeFromObj';
	let errPrefix = '(' + methodName + ') ';

	let resultObj =
		solidity_helpers_misc.solidityTupleResultToMirrorObject(
			solidityTupleFormatObj,
			EBB_PaymentDetailsRecord,
			(resultObj) =>
			{
				if (!resultObj)
					throw new Error(errPrefix + 'The result object is unassigned.');
				if (!(resultObj instanceof EBB_PaymentDetailsRecord))
					throw new Error(errPrefix + 'The value in the resultObj parameter is not a EBB_PaymentDetailsRecord object.');

				// Check for empty tuple result return, which we test for by checking the idInSmartContract
				//	for a zero value in string format.
				if (resultObj.idInSmartContract === "0")
					// Empty tuple result. Just get out.
					return;
				
				// The result object has strings for all the properties.  Convert them to the correct type.
				let n = parseInt(resultObj.clientReferenceTimestamp);
				resultObj.clientReferenceTimestamp = new Date(n);
				
				resultObj.idInSmartContract = parseInt(resultObj.idInSmartContract);
				
				/*
				if (resultObj.idInSmartContract == 0)
					throw new Error(errPrefix
					+ "The smart contract game ID in the Solidity tuple is 0.  "
					+ "This means the smart contract can't find a pending payment using the game ID/video ID/payeeAddr "
					+ "combination we gave it when requesting the details for a pending payment (i.e. pending payment "
					+ "not found.  Call the static EBB_PaymentDetailsRecord.IsEmptyTupleResult() method before calling " +
					+ "EBB_PaymentDetailsRecord.initializeFromObj to avoid this error.");
				*/
				
				common_routines.validateAsIntegerGreaterThanZero(
					'EBB_PaymentDetailsRecord.initializeFromObj',
					resultObj.idInSmartContract);
				
				// The video ID is in Solidity compatible format.  Undo that conversion.
				resultObj.videoId = web3utils_lib.toAscii(resultObj.videoId);
				
				resultObj.paymentAmountGwei = parseInt(resultObj.paymentAmountGwei);
				
				// Convert the payment type back to an enum.
				resultObj.paymentType = solidity_helpers_misc.numberToEnumPaymentType(resultObj.paymentType);
			});

	// Validate it if it is not an empty tuple result.
	if (resultObj.idInSmartContract !== "0")
		resultObj.validateMe();
	
	return resultObj;
}

module.exports = {
	EBB_PaymentDetailsRecord: EBB_PaymentDetailsRecord
}























