/**
 * This route checks to see if the video a new player wants to submit to the game has
 *  already been entered. (i.e. - checks for duplicate video submission).
 *
 */
 
// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

var express = require("express");
var http_status_codes = require('http-status-codes');
var router = express.Router();
const solidity_helpers_misc = require('../../common/solidity-helpers-misc');

const redis_wrappers_lib = require('../../common/redis-wrappers');
const user_details_lib = require('../../public/javascripts/game-objects/user-details');
const game_details_lib = require('../../public/javascripts/game-objects/game-details');
const misc_shared_lib = require('../../public/javascripts/misc/misc-shared');
const ethereum_transactions = require('../../process/ethereum-transactions');
const ethereum_payment_details_lib = require('../../public/javascripts/game-objects/ethereum-payment-details');
const common_routines = require('../../common/common-routines');
const waitForEthTransactions = require('../../process/wait-for-ethereum-blocks.js').WaitForEthereumBlocks;

router.post('/prepare-for-enter-game-api',function(req,res, next){
   	let bResponseNeeded = true;
			
    try
    {
    	var errPrefix = '(prepare-for-enter-game-api) ';

		// ---------------------- RECOVER THE GAME DETAILS OBJECT -------------
		   
    	// The req object has a NULL prototype so we have to use Object.prototype.hasOwnProperty.
    	if (typeof req.body.game_details_obj == 'undefined')
    		throw new Error('Missing game details object.');
    		
    	var plainGameDetailsObj  = req.body.game_details_obj;
    	
    	if (misc_shared_lib.isEmptySafeString(plainGameDetailsObj))
    		throw new Error('The game details object in plain format is empty.');
    	
    	let gameDetailsObj = game_details_lib.postDataToGameDetailsObject(plainGameDetailsObj);
    	
		// ---------------------- RECOVER THE USER DETAILS OBJECT -------------
		   
    	// The req object has a NULL prototype so we have to use Object.prototype.hasOwnProperty.
    	if (typeof req.body.user_details_obj == 'undefined')
    		throw new Error('Missing user details object.');
    		
    	let plainUserDetailsObj = req.body.user_details_obj;
    	
    	let userDetailsObj = user_details_lib.postDataToUserDetailsObject(plainUserDetailsObj);
    	
    	let aryExistingUsers = null;
    	
		// Execute a Redis query to get the users in the game so far, so we can check for
		//  a duplicate video submission.
		redis_wrappers_lib.getAllUsers_promise(gameDetailsObj.id)
		.then(redisResponse => 
		{
			// Did we find any users for the given game ID.
			redis_wrappers_lib.validateRedisResponseAsArray(redisResponse, errPrefix + 'Unable to find any existing users for game ID: ' + gameDetailsObj.id, true);
			
			aryExistingUsers = redisResponse;
			
			let errMsg = '(none)';
    		let bIsDuplicateVideo = false;
			
			// See if the given video ID matches any of videos already submitted to the game
			//  by other players.
			for (let ndx = 0; ndx < aryExistingUsers.length; ndx++)
			{
				if (aryExistingUsers[ndx].videoIdSubmitted == userDetailsObj.videoIdSubmitted)
				{
					// Return a standard error object.
					errMsg = 'The video you have selected was already submitted by another player.  Please choose another.';
					bIsDuplicateVideo = true;
					break;
				}
			}
			
			if (bIsDuplicateVideo)
			{
				// Return an error object so the caller know.
				common_routines.returnStandardErrorObj(req, res, errMsg);
				
				// We have already sent an error response to the user.
				bResponseNeeded = false;
				
				throw new Error(errPrefix + 'The video submitted by the new player is a duplicate video.');
			}

			// Add the user record to the user table with updated information.
			return redis_wrappers_lib.addUser_promise(gameDetailsObj.id, userDetailsObj.id, userDetailsObj)
		})
		.then(redisResponse => 
		{
			// Did the user add request succeed?
			if (redisResponse !=  1)
			{
				// TODO: Really need to figure out a better system-wide handling mechanism
				//  for the Redis response calls.  For some reason, the user ID appears to
				//  be the same between games, leading to add requests ending up being
				//  replace requests and thus a Redis response that is not 1.
				
				// No.  Return an error.
				// throw new Error(errPrefix + 'User add request failed');
			
				console.log(errPrefix + "Response from addUser_promise was not 1");
			}
			
			// Return a success object to the client.
			common_routines.returnStandardSuccessJsonObj(req, res, 'The given video has not been added to the current game as of this time.');
			
			return(true);
		})
		.catch(function(err)
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during the execution of the prepare enter game api request (promise). Details -> ' + err.message);
			
			if (bResponseNeeded)
				res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error prepare enter game api request.');
				
			return;
		});
    }
    catch (err)
    {
        console.log('[ERROR: prepare-for-enter-game-api] Details -> ' + err.message);
        
		if (bResponseNeeded)
        	res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the prepare enter game api request (try/catch).');
        return;
    } // try/catch

});

module.exports = router;
