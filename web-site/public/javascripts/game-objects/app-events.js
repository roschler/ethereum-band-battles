/**
 * This file contains the generic code related to app events.
 */
 
 const misc_shared_lib = require('../misc/misc-shared');
 
 /**
 * Assign an object of this type to the "customDataObj" property of an AppEventResult object if it doesn't need
 * 	a custom data object.
 *
 * @constructor
 */
function customDataObj()
{
	/** @property {string} - A simple string property to let us know during debugging this is a proper
	 * 		empty data bag object.
	 */
	this.dummyProperty = '(empty custom data object)';
}


/**
 * This is the object typically sent/published by the server over the PubNub network
 * 	as part of the various notifications the server sends to the client regarding
 * 	transactions the client is waiting on.  It is also used server side only
 * 	too.
 *
 * @constructor
 */
function AppEventResult() {
	var self = this;
	
 	let errPrefix = '(AppEventResult) ';
	
	/** @property {Object} - A custom data object to associate with the result.  If one is not needed,
	 * 		assign an EmptyAppResult object to this property.
	 */
 	this.customDataObj = null;
 	
	/** @property {string} - The ID of the app event associated with this result. */
 	this.appEventId = null;
	
	 /**
	  * Validate this object.
	  */
 	this.validateMe = function () {
 		if (!self.customDataObj)
 			throw new Error(errPrefix + 'The data bag is unassigned.  If one is not needed.  Please assign an EmptyDataBag object to the "bag" property.');
 		if (misc_shared_lib.isEmptySafeString(self.appEventId))
 			throw new Error(errPrefix + 'The app event ID is empty.');
	}
}

/**
 * This function does a deep integrity test to make sure a PubNub MESSAGE event
 * 	is one that carries one of our app event result objects in plain JSON object
 * 	format.
 *
 * @param {Object} pubnubMessageEvent - A PubNub status event object.
 *
 * @return {boolean} - Returns TRUE if the message event carries one of our app
 * 	event result objects in plain JSON object, FALSE if not.
 */
function isAppEventResultObjInMessageEvent(pubnubMessageEvent)
{
	var errPrefix = '(isAppEventResultObjInMessageEvent) ';
	
	if (typeof pubnubMessageEvent == 'undefined' || pubnubMessageEvent == null)
	{
		console.warn(errPrefix + 'The PubNub message event is unassigned.');
		return false;
	}

	if (!pubnubMessageEvent.hasOwnProperty('messageText'))
	{
		console.warn(errPrefix + 'The PubNub message event does not have a messageText property.');
		return false;
	}
	
	if (!pubnubMessageEvent.hasOwnProperty('app_event_result'))
	{
		console.warn(errPrefix + 'The PubNub message event does not have an app_event_result property.');
		return false;
	}
	
	// Make sure it is indeed an AppEventResult object.
	if (!(pubnubMessageEvent.app_event_result instanceof AppEventResult))
	{
		console.warn(errPrefix + 'The PubNub message event does have an app_event_result property but it is not of type AppEventResult.');
		return false;
	}
	
	// All checks passed.
	return true;
}

/**
 * Simple function used with objects that are used as the source for an app event ID
 * 	extracts the app event ID from an object of any type.  The app event ID is expected
 * 	to be a top level property of the object.
 *
 * @param {Object}  obj - A valid object.
 *
 * @return {string}
 */
function extractAppEventIdFromObj(caller, obj) {
	let errPrefix = '(extractAppEventIdFromObj) ';
	
	if (misc_shared_lib.isEmptySafeString(caller))
		throw new error('The caller parameter is empty.');
		
	// Add the caller to the error prefix.
	errPrefix = '(' + caller + '::' + 'extractAppEventIdFromObj' + ') ';
	
	if (!obj)
		throw new Error(errPrefix + 'The object is unassigned.');
		
	if (typeof obj !== 'object')
		throw new Error(errPrefix + 'The object parameter is not of type "object".');
		
	if (!obj.hasOwnProperty('appEventId'))
		throw new Error(errPrefix + 'The object does not have an appEventId property.');
		
	let appEventId = obj.appEventId;
		
	if (misc_shared_lib.isEmptySafeString(appEventId))
		throw new Error(errPrefix + 'The app event ID is empty.');
		
	return appEventId;
}

// Yes.  Export the code so it works with require().
module.exports =
	{
		AppEventResult: AppEventResult,
		extractAppEventIdFromObj: extractAppEventIdFromObj
	};
/*
// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
	window.app_events_lib = {};
	window.app_events_lib.AppEventResult = AppEventResult,
	window.app_events_lib.extractAppEventIdFromObj = extractAppEventIdFromObj,
	window.app_events_lib.recoverAppEventResultFromPubNubMessageEvent = recoverAppEventResultFromPubNubMessageEvent
}
else
{
}
*/