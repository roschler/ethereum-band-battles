/**
 * This Object is used to delay a Promise that we don't want any part of to
 * 	be called until we need it's functionality.
 *
 * @param {Promise} promiseToDelay - The promise to delay.
 * @param {Array} args - Any arguments required by the promiseToDelay
 * 	function.
 *
 * @constructor
 */
function DelayedPromiseExecution(promiseToDelay, args)
{
	var self = this;
	
	let errPrefix = '(DelayedPromiseExecution) ';
	
	if (!promiseToDelay)
		throw new Error(errPrefix + 'The promise to delay is unassigned.');
		
	this.promiseToDelay = promiseToDelay;
	this.argsForPromiseToDelay = args;
	
	/**
	 * This function returns the promise containing the onSuccess promise that
	 * 	needed to be delayed.  Call it when you need the functionality of the
	 * 	promise.  Just hang a "then" method off of it like any other Promise
	 * 	to trigger it's execution.  Note, the main promise function code
	 * 	will execute as soon as you call this method.  That is a function
	 * 	of the way Promise's are executed and has nothing to do with this
	 * 	method or the containing Object type.
	 *
	 * @return {Promise} - Returns the delayed promise.
	 */
	this.buildPromise = function()
	{
		return this.promiseToDelay(...this.argsForPromiseToDelay);
	}
}

/**
 * This function is for those cases where the code you have that needs to process an
 * 	Ethereum transaction result can be put in a very simple function that does
 * 	not need to be a promise.
 *
 * @param {Function<any>} funcCodeToExecute - The function to execute on the
 * 	Ethereum transaction result.  It is expected to take an Ethereum transaction result
 * 		as its only argument.
 *
 * @return {Promise<any>} - Returns a promise that executes the given function and
 * 	resolves the promise with the return value of that function.
 */
function SimpleProcessAppEventResultPromiseBuilder(funcCodeToExecute)
{
	/**
	 * This method will build a return a promise that executes the function that was given to
	 * 	us when this object was constructed.
	 *
	 * @param {EthereumTransactionResult_ebb} ethTransResult - A valid Ethereum transaction result.
	 *
	 * @return {Promise<any>}
	 */
	this.buildPromise = function(ethTransResult) {
		return new Promise(function(resolve, reject) {
			try {
				let errPrefix = '(SimpleProcessAppEventResultPromiseBuilder) ';
				
				if (!ethTransResult)
					throw new Error(errPrefix +'The ethereum transaction result is unassigned.')
					
				if (!funcCodeToExecute)
					throw new Error(errPrefix +'The function to execute on the Ethereum transaction result is unassigned.');
					
				if (!(typeof funcCodeToExecute == 'function'))
					throw new Error(errPrefix +'The Ethereum transaction result is not a EthereumTransactionResult_ebb object.');
					
				// Resolve the promise with the result of the function that was given to us.
				let result = funcCodeToExecute(ethTransResult);
				resolve(result);
			}
			catch(err)
			{
				// Reject the promise with the error.
				reject(err);
			}
		});
	}
}

module.exports = {
	DelayedPromiseExecution: DelayedPromiseExecution,
	SimpleProcessAppEventResultPromiseBuilder: SimpleProcessAppEventResultPromiseBuilder
}