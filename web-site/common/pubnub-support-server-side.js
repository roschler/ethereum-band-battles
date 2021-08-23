/**
 * A few support routines for server side PubNub work.
 */

var common_routines = require('../common/common-routines');

 /**
 * This function checks the local environment for the PubNub Publish key and
 * 	and returns it.  If it is not found, an error is thrown.
 *
 * @return {String}
 */
function getPubNubPublishKeyFromEnvironment()
{
	// --->>> PubNub PUBLISH key
	
	// If the PubNub publish key has not been set in the environment, then
	//  that is a fatal error.
	let pubnubPublishKey = process.env.PUBNUB_PUBLISH_KEY;
	
	if (common_routines.isEmptyString(pubnubPublishKey))
		throw new Error("The PubNub publish key was not found in the system environment.");

	return pubnubPublishKey;
}

/**
 * This function checks the local environment for the PubNub Subscribe key and
 * 	and returns it.  If it is not found, an error is thrown.
 *
 * @return {String}
 */
function getPubNubSubscribeKeyFromEnvironment()
{
	// --->>> PubNub SUBSCRIBE key
	
	// If the PubNub subscribe key has not been set in the environment, then
	//  that is a fatal error.
	let pubnubSubscribeKey = process.env.PUBNUB_SUBSCRIBE_KEY;
	
	if (common_routines.isEmptyString(pubnubSubscribeKey))
		throw new Error("The PubNub subscribe key was not found in the system environment.");

	return pubnubSubscribeKey;
}

/**
 * This function checks the local environment for the PubNub SECRET key associated
 *  with the PubNub app this Node.JS app is tied to and and returns it.  If it is 
 *  not found, an error is thrown.
 *
 * @return {String}
 */
function getPubNubSecretKey()
{
	// --->>> PubNub SECRET key
	
	// If the PubNub SECRET key has not been set in the environment, then
	//  that is a fatal error.
	let pubnubSecretKey = process.env.PUBNUB_SECRET_KEY;
	
	if (common_routines.isEmptyString(pubnubSecretKey))
		throw new Error("The PubNub secret key was not found in the system environment.");

	return pubnubSecretKey;
}

/**
 * This function checks the local environment for name of the MAIN channel we have selected for
 *  the app that all authorized Twitter users share.
 *
 * @return {String}
 */
function getPubNubMainChannel()
{
	// --->>> PubNub MAIN channel name
	
	// If the PubNub MAIN channel name has not been set in the environment, then
	//  that is a fatal error.
	let pubnubChannelName = process.env.PUBNUB_MAIN_CHANNEL;
	
	if (common_routines.isEmptyString(pubnubChannelName))
		throw new Error("The PubNub MAIN channel name was not found in the system environment.");

	return pubnubChannelName;
}


module.exports = {
	getPubNubPublishKeyFromEnvironment: getPubNubPublishKeyFromEnvironment,
	getPubNubSubscribeKeyFromEnvironment: getPubNubSubscribeKeyFromEnvironment,
	getPubNubSecretKey: getPubNubSecretKey,
	getPubNubMainChannel: getPubNubMainChannel
}