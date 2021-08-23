/**
 * This file contains the code related to payments that are part of the game.
 *
 * 	IT SHOULD NOT BE SHARED WITH THE CLIENT CODE!
 */

var misc_shared_lib = require('../public/javascripts/misc/misc-shared');

/** Handy object to hold some constants we use when interacting with user objects. */
var PaymentStatusConstants = new function()
{
	/** Various user states. */
	this.UNPAID = 'unpaid';
	this.PENDING = 'waiting for payment';
	this.PAID = 'paid';
}

/**
 * This method returns TRUE if the current environment variable settings indicate that
 *  we are ignoring entry fee payments, FALSE if not.
 *
 * @return {boolean}
 */
function isIgnoringEntryFeePayments()
{
	if (process.env.IGNORE_ENTRY_FEES && misc_shared_lib.isTrueOrStrTrue(process.env.IGNORE_ENTRY_FEES))
		// We are ignoring entry fee payments.
		return true;

	return false;
}

/**
 * Validate a payment details object.
 *
 * @param {Object} objToValidate - The object to validate as a payment details object.
 */
function validatePaymentForEntryFee(objToValidate)
{
	var errPrefix = '(validatePaymentPaymentForEntryFee) ';
	
	if (typeof objToValidate == 'undefined' || objToValidate == null)
		throw new Error(errPrefix + 'The object to validate is unassigned.');

	// We must have a user ID.
	if (misc_shared_lib.isEmptySafeString(objToValidate.userId))
		throw new Error(errPrefix + 'The user ID is empty.');
}

function PaymentForEntryFee()
{
	var self = this;
	
    // Make a user ID for this object.
    this.id = 'payment_' + misc_shared_lib.getSimplifiedUuid()
	
    /** @property {String} userId - The ID user that made this payment. */
    this.userId = null;
    
    /** @property {String} status - The status of the payment. */
    this.status = PaymentStatusConstants.UNPAID;
    
    
    /**
	 * Validate this payment details object.
	 */
	this.validateMe = function ()
	{
		return validatePaymentForEntryFee(this);
	}
	
	/**
	 * This function checks if the user has paid the entry fee yet.
	 *
	 * @return {Boolean} - Returns TRUE if this user has paid their
	 * 	entry fee, FALSE if not.
	 */
	this.isEntryFeePaid = function()
	{
		return (this.status == PaymentStatusConstants.PAID);
	}

	/**
	 * This function checks if the user has paid the entry fee yet.
	 *
	 * @return {Boolean} - Returns TRUE if this user has paid their
	 * 	entry fee, FALSE if not.
	 */
	this.isEntryNotPaid = function()
	{
		return (this.status != PaymentStatusConstants.PAID);
	}
	
    // Return a reference to this object to support method chaining.
    return self;
}

module.exports =
	{
		isIgnoringEntryFeePayments: isIgnoringEntryFeePayments,
		PaymentForEntryFee: PaymentForEntryFee,
		PaymentDetailsConstants: PaymentStatusConstants
	};

