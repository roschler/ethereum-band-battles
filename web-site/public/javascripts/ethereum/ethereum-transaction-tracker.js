/**
 * This module contains code that helps with tracking an app event through the
 * 	many stages it undergoes while working its way through parts of this system.
 */
 
const misc_shared_lib = require ('../../../public/javascripts/misc/misc-shared');
const DelayedPromiseExecution = require('../../../ethereum/delayed-promise-execution').DelayedPromiseExecution;
const SimpleProcessAppEventResultPromiseBuilder = require('../../../ethereum/delayed-promise-execution').SimpleProcessAppEventResultPromiseBuilder;
// const ethereum_transactions = require('../../../process/ethereum-transactions');
const AppEventResult = require('../../../public/javascripts/game-objects/app-events').AppEventResult;

const uuidv4 = require('uuid/v4');

/**
 * This object helps track an App event throughout our system.
 *
 * @constructor
 */
function AppEventTracker()
{
	/** @property {string} id - A unique ID for the appEvent we will track. */
	this.id = uuidv4();
	
	/** @property {DelayedPromiseExecution} processAppEventResult_promise
	 *
	 * Any code that should be executed when the app event has been successfully
	 *  executed by our server should be placed into this
	 *  property.  It should be a promise and the promise will be executed
	 *  when we receive the PubNub notification from the server telling us
	 *  that the app event has successfully completed.
	 *
	 * WARNING: Do not execute this promise directly!  Only execute it through the
	 * 	AppEventTrackingManager that hosts a collection of these.  These
	 * 	objects should be deleted after the promise completes or we will have
	 * 	an every expanding collection of these objects in AppEventTrackingManager.
	 */
	this.processAppEventResult_promise = null;
}

/**
 * This object is responsible for maintaining a collection of active app event tracking objects
 */
var AppEventTrackingManager = (function() {
	var self = this;
	
	/** @property {Array<AppEventTracker>} - an array of the app events
	 * 	we are tracking.
	 *
	 * @private
	 */
	this.aryTrackedAppEvents = new Array();
	
	/**
	 * This method searches the app event collection for an app event with the given ID
	 * 	and returns its index in the array.
	 *
	 * @param {String} - The desired app event tracker ID.
	 *
	 * @return {Object|null| - Returns the object associated with the given ID
	 * 	if one exists, otherwise NULL is returned.
	 */
	this.findAppEventById = function(appEventId)
	{
		var errPrefix = '(AppEventTrackingManager::findAppEventById) ';
		
		if (misc_shared_lib.isEmptySafeString(appEventId))
			throw new Error(errPrefix + 'The app event ID parameter is empty.')
			
		// Find it.
		if (!self.aryTrackedAppEvents[appEventId])
			// Not found.
			return null;

		// Return it.
		return self.aryTrackedAppEvents[appEventId];
	}
	
	/**
	 * This method adds a new app event tracking object to our collection.
	 *
	 * @param {AppEventTracker} appEventToTrack - The app event
	 * 	tracking object to add.
	 *
	 * @return {string} - Returns the ID of the new app event tracking
	 * 	object.
	 */
	this.addAppEventToBeTracked = function(appEventToTrack)
	{
		let errPrefix = '(AppEventTrackingManager::addAppEventToBeTracked) ';
		
		if (!appEventToTrack)
			throw new Error(errPrefix + 'The app event object to track is unassigned.');
			
		// No duplicates.
		if (self.findAppEventById(appEventToTrack.id))
			throw new Error(errPrefix + 'The ID belonging to the app event tracker already exists in our collection: ' + appEventToTrack.id);
			
		// Add it.
		self.aryTrackedAppEvents[appEventToTrack.id] = appEventToTrack;
		
		// Return ID of the new app event tracking.
		return appEventToTrack.id;
	}
	
	/**
	 * This method adds a new app event tracking object to our collection, but
	 * 	rather than expecting a fully built AppEventTracker object, it accepts
	 * 	a Promise that should be curried with an AppEventTracker object, builds
	 * 	that object, and then adds that object to our collection.
	 *
	 * @param {Promise<any>} processAppEventResult_promise - The promise that
	 * 	should be executed when we are notified via PubNub by the server that the
	 * 	app event we are tracking has been confirmed or timed out.
	 *
	 * @return {string} - Returns the ID of the new app event tracking
	 * 	object.
	 */
	this.addPromiseAsAppEventToBeTracked = function(processAppEventResult_promise)
	{
		let errPrefix = '(AppEventTrackingManager::addPromiseAsAppEventToBeTracked) ';
		
		if (!processAppEventResult_promise)
			throw new Error(errPrefix + 'The promise that processes the app event is unassigned.');
			
		if (!(processAppEventResult_promise instanceof DelayedPromiseExecution))
			throw new Error(errPrefix + 'The promise that processes the app event is not a DelayedPromiseExecution object.');
			
		// Build an app event tracking object around the promise.
		let appEventToTrack = new AppEventTracker();
		appEventToTrack.processAppEventResult_promise = processAppEventResult_promise;
			
		// No duplicates.
		if (self.findAppEventById(appEventToTrack.id))
			throw new Error(errPrefix + 'The ID belonging to the app event tracker already exists in our collection: ' + appEventToTrack.id);
			
		// Add it.
		self.aryTrackedAppEvents[appEventToTrack.id] = appEventToTrack;
		
		// Return ID of the new app event tracking.
		return appEventToTrack.id;
	}
	
	/**
	 * This method takes a simple function that takes an single object as its
	 * 	only argument, builds a promise from it, and then assembles an AppEventTracker
	 * 	object with that promise before inserting into our collection of those.
	 *
	 * @param {Function<any>} funcCodeToExecute - The function to execute on the
	 * 	app event result.  It is expected to take an app event result
	 * 		as its only argument.
	 *
	 * @return {string} - Returns the ID of the new app event tracking
	 * 	object.
	 */
	this.addSimpleFuncAsTransToBeTracked = function(funcCodeToExecute)
	{
		let errPrefix = '(AppEventTrackingManager::addSimpleFuncAsTransToBeTracked) ';
		
		// Build an app event tracking object around the promise.
		let appEventToTrack = new AppEventTracker();

		// Store an object that will build a promise that will execute the code
		// 	to execute the desired function, but only when it is needed
		//  by calling the buildPromise().
		appEventToTrack.processAppEventResult_promise =
			new SimpleProcessAppEventResultPromiseBuilder(funcCodeToExecute);
		
		// No duplicates.
		if (self.findAppEventById(appEventToTrack.id))
			throw new Error(errPrefix + 'The ID belonging to the app event tracker already exists in our collection: ' + appEventToTrack.id);
			
		// Add it.
		self.aryTrackedAppEvents[appEventToTrack.id] = appEventToTrack;
		
		// Return ID of the new app event tracking.
		return appEventToTrack.id;
	}
	
	/**
	 * This method deletes an app event tracking object from our collection,
	 * 	using its ID as the search key.  If an object does not exist with that ID,
	 * 	the call is ignored.
	 *
	 * @param {string} transactionId - The ID Of the app event
	 * 	tracking object to delete.
	 */
	this.deleteTransactionById = function(transactionId)
	{
		let errPrefix = '(AppEventTrackingManager::deleteTransactionById) ';
		
		if (misc_shared_lib.isEmptySafeString(transactionId))
			throw new Error(errPrefix + 'The app event ID parameter is empty.')
			
		// Does the element exist.
		if (self.findAppEventById(transactionId))
			// Yes, delete it.
			delete self.aryTrackedAppEvents[transactionId];
	}
	
	/**
	 * Use this function to do the necessary final processing that was attached
	 * 	to the app event object associated with the given app event
	 * 	ID.  The tracking object will be deleted after the promise that does
	 * 	processing completes.
	 *
	 * @param {AppEventResult} appEventResultObj - An object that is the result of an app event
	 * 	completing.
	 *
	 * @return {*|Promise<T>} - Returns a promise that will execute the final app event
	 * 	processing promise and then deletes the tracking object so that our collection
	 * 	of those objects doesn't keep expanding.
	 */
	this.callProcessAppEventResult_promise = function(appEventResultObj) {
		let errPrefix = '(AppEventTrackingManager::deleteTransactionById) ';
		
		// Get the app event ID.
		if (!appEventResultObj)
			throw new Error(errPrefix + 'The app event result is unassigned.');
			
		if (!(appEventResultObj instanceof AppEventResult))
			throw new Error(errPrefix + 'The app event result parameter is not an AppEventResult object.');

		appEventResultObj.validateMe();
		
		// Do we have a promise builder for the app event ID associated with
		//  the app event result object?
		let ethTransTracker = self.aryTrackedAppEvents[appEventResultObj.appEventId];
		
		if (ethTransTracker)
		{
			// Yes.  Return a promise that will execute the code that should handle the app event
			//  result.  After that code completes, delete the associated transaction tracking object
			//	since we are done with it.
			return ethTransTracker.processAppEventResult_promise.buildPromise(appEventResultObj)
				.then(function(ignoreResult) {
					// We are completely done with this app event now.  Delete the
					//  tracking object associated with it.
					self.deleteTransactionById(appEventResultObj.appEventId);
					return true; // Done.
				})
				.catch(function(err) {
					// Just log the error for now.
					console.error(errPrefix + err.messages);
				});
		}
		else
		{
		 
			// No.  If the app event was initiated on a station other than this one
			//  there won't be a app event tracker for this app event result.
			//	Remember, app event results are received by all stations as the
			//  result of a PubNub broadcast.  We allow this situation because we
			//  still want the OPTION to update our game details, and/or user details,
			// 	and perhaps later other objects as a result of the app event result
			//	notification.  But only the station that initiated the app event
			//  will have an app event tracking object for the given
			//  app event ID, and therefore only it will have any follow-up
			//  code that needs to be executed.
			//
			// A clear example of this is when a new game is created.  Only the station
			//  that belongs to the game creator will need to update as a result of the
			//	new game app event being successfully completed.  In this case, switching
			//  from the game creation screen to the waiting for players screen that
			//	provides the invite link.  The other stations belong to players that
			//  are simply joining the game.  (UPDATE: In reality, the phase switch
			//  happens after the "set house public address" Ethereum transaction
			//  that follows the "make game" transaction, not the "make game"
			//  transaction itself").
			
			// Log the message so that in case it's an error condition due to a station
			//  not adding an app event tracker when it should have, we at
			//  least have some evidence to follow-up on.
			let warnMsg =
				errPrefix
				+ 'Could not find an app event tracker for the app event ' +
				+ ' ID found in the app event result object.  If this is because'
				+ ' the source of the app event was a station other than this one, than'
				+ ' that is alright.  If not, it may be an error condition due to a station'
				+ ' not creating an app event tracking object when it should have.';
				
			console.warn(warnMsg);
			
			return Promise.resolve(warnMsg);
		}
	}
	
	return this;
})();

module.exports = {
	AppEventTracker: AppEventTracker,
	AppEventTrackerManager: AppEventTrackingManager
}