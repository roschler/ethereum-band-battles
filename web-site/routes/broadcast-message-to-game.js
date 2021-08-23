/**
 * This is the route for the page that lets broadcast a message to particular game.
 */
var express = require("express");
var http_status_codes = require('http-status-codes');
var router = express.Router();
var pubnub_lib = require('pubnub');

var common_routines = require('../common/common-routines');
var misc_shared_lib = require ('../public/javascripts/misc/misc-shared');
var pubnub_support = require('../common/pubnub-support-server-side');

/**
 * Sends a text message to the given channel name using PubNub
 *
 * @param {String} channelName - The desired channel name to send the text to.
 * @param {String} messageText - The message text to send.
 *
 * @return {Object} - Returns the status object if the operation failed.  Returns
 * 	the response object if it succeeded.
 */
function broadcastMessage(req, res, channelName, messageText) {
	var errPrefix = '(broadcastMessage) ';
	
	if (misc_shared_lib.isEmptySafeString(channelName))
		throw new Error(errPrefix + 'The channel name parameter is empty.');
		
	if (misc_shared_lib.isEmptySafeString(messageText))
		throw new Error(errPrefix + 'The message text parameter is empty.');
		
	const pubnubInstance = new pubnub_lib(
	{
		publishKey: pubnub_support.getPubNubPublishKeyFromEnvironment(),
		subscribeKey: pubnub_support.getPubNubSubscribeKeyFromEnvironment()
	});
	
	console.log(errPrefix + 'Broadcasting the message shown below to this PubNub channel: ' + channelName);
	console.log(messageText);
	
	var publishConfig = {
		channel : channelName,
		message : {
			sender: 'game-server',
			text: messageText,
		}
	}
	
	pubnubInstance.publish(
		publishConfig,
		function(status, response)
		{
			if (status.hasOwnProperty('error') && status.error){
				console.warn(errPrefix + 'The PubNub broadcast attempt failed.')
				console.warn(status);
				res.status(http_status_codes.OK).send(status);
			}
			else
			{
				// Successful publish.
				console.log(errPrefix + 'Broadcast succeeded, status and response objects shown below: ');
				console.log(status, response);
				res.status(http_status_codes.OK).send(response);
			}
		});
}


router.get('/broadcast-message-to-game',function(req,res, next){
    try
    {
    	if (!req.query.hasOwnProperty('channelName'))
    		throw new Error('Missing channel parameter.');
    		
    	if (common_routines.isEmptyString(req.query.channelName))
    		throw new Error('The channel name is empty.');
    		
    	if (!req.query.hasOwnProperty('messageText'))
    		throw new Error('Missing message text parameter.');
    		
    	if (common_routines.isEmptyString(req.query.messageText))
    		throw new Error('The message text is empty.');
    		
    	// Broadcast the message using the given channel and text.
    	broadcastMessage(req, res, req.query.channelName, req.query.messageText);
    }
    catch (err)
    {
        console.log('[ERROR: broadcast-message-to-game] Details -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the broadcast message to game request.');
        return;
    } // try/catch

});

module.exports = router;
