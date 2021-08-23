/**
 * This route accepts incoming requests for a game object based on its ID.
 */

var express = require("express");
var http_status_codes = require('http-status-codes');
var router = express.Router();

var redis_wrappers_lib = require('../../common/redis-wrappers');
var misc_shared_lib = require('../../public/javascripts/misc/misc-shared');

// const game_details_lib = require('../../public/javascripts/game-objects/game-details');
const GameDetails = require('../../public/javascripts/game-objects/game-details').GameDetails;
const common_routines = require("../../common/common-routines");

router.post('/get-game-object-api',function(req,res, next){
   	const errPrefix = '(get-game-object-api) ';
   	
   	let bResponseRequired = true;
    
    try
    {
		const console = process.console;
  
    	if (typeof req.body.game_id == 'undefined')
    		throw new Error(errPrefix + 'Missing game ID.');
    		
    	let gameId = req.body.game_id;
    	
    	if (misc_shared_lib.isEmptySafeString(gameId))
    		throw new Error(errPrefix + 'The game ID is empty.');
    		
    	console.log(errPrefix + 'GAME ID: Retrieving game details object that has the ID -> ' + gameId);
    	
    	// Find the game details object using the game ID provided.
    	let gameDetailsObj = null;
    	
		// Execute a Redis query to get the game details object.
		redis_wrappers_lib.getGame_promise(gameId)
			.then(function(redisResponse)
			{
				if (redisResponse instanceof GameDetails)
					gameDetailsObj = redisResponse;
					
				// Did we find a game with the given game ID?
				if (gameDetailsObj ==  null){
					// No.  Return an error.
					let objAuxArgs = { game_id: gameId }
					
					let errMsg = 'Unable to find a game with the given ID.  Invalid game ID: ' + gameId;

					bResponseRequired = false;
					
					common_routines.returnStandardErrorObj(
						req,
						res,
						errMsg,
						// We do not show the error to the user since they can't do anything about it.
						false,
						// We return an HTTP OK so the client knows it is not a catastrophic error.
						http_status_codes.OK,
						objAuxArgs);
						
					throw new Error(errPrefix + 'Unable to find a game with the ID: ' + gameId);
				}
				
				console.log(errPrefix + 'Successfully found a game details object using ID: ' + gameId);
				
				var objAuxArgs = {  game_details_obj: gameDetailsObj }
				
				bResponseRequired = false;
				
				common_routines.returnStandardSuccessJsonObj(
					req,
					res,
					'Game details object found and returned for game ID: ' + gameId,
					objAuxArgs);
				return(true);
			})
			.catch(function(err)
			{
				// Handle the error.
				console.error('[ERROR: ' + errPrefix + '] Error during get game details object request (promise). Details -> ' + err.message);
				
				if (bResponseRequired)
        			res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during get game details object request.');
        		return;
			});
    }
    catch (err)
    {
        console.log('[ERROR: ' + errPrefix + '] Details -> ' + err.message);
        
        if (bResponseRequired)
        	res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the get game object request.');
        return;
    } // try/catch

});

module.exports = router;
