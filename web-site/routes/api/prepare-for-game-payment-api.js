/**
 * This route accepts a game details object and stores it, and then creates
 * 	a server side only object for the game and stores it too.
 *
 */

// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

const express = require("express");
const http_status_codes = require('http-status-codes');
const router = express.Router();
const common_routines = require('../../common/common-routines');
const game_details_lib = require('../../public/javascripts/game-objects/game-details');
const solidity_helpers_misc = require('../../common/solidity-helpers-misc');
const ebbDetails = require('../../common/contract-details').EtherBandBattlesManager_details;
const redis_wrappers_lib = require('../../common/redis-wrappers');
const GameDetailsServerSideOnly = require('../../common/game-details-server-side-only').GameDetailsServerSideOnly;
const routes_support = require('../../common/routes-support');
const EnumValidateMeTypes = require('../../public/javascripts/misc/validation').EnumValidateMeTypes;

const misc_shared_lib = require ('../../public/javascripts/misc/misc-shared');

// ======================================= POST REQUEST HANDLER ==========================


// NOTE: This call must be made before the Metamask payment is made by the game creator
//  to pay for the game, because we provide the request nonce to the client so it can
//  make that call.
router.post('/prepare-for-game-payment-api',function(req,res, next){
	let errPrefix = '(prepare-for-game-payment-api) ';
	
	let bResponseRequired = true;
	
    try
    {
    	console.error('Testing console.error');
    	
		// ---------------------- RECOVER GAME OBJECTS -------------
		   
    	// The body contains the JSON object we want.
    	let gameDetailsObj = routes_support.recoverGameDetailsObjFromPostData(req);
    	
    	// Validate it.
    	gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);
    	
    	let serverEthNetworkId = solidity_helpers_misc.getTargetEthereumNetworkId();
    	if (gameDetailsObj.ethereumNetworkId != serverEthNetworkId)
		{
			let errMsg =
				errPrefix + 'The Ethereum network ID of the game details object('
				+ solidity_helpers_misc.ethereumNetworkIdToString(gameDetailsObj.ethereumNetworkId)
				+ ') does not match the one the server is set to: '
				+ solidity_helpers_misc.ethereumNetworkIdToString(serverEthNetworkId);
				
    		throw new Error(errMsg);
		}
    		
    	// Create a request nonce for the upcoming makeGame() request.
    	gameDetailsObj.requestNonce = solidity_helpers_misc.getNonceViaUuid();
    	
    	// Format the nonce for direct use in a smart contract call that takes a bytes32 parameter.
    	gameDetailsObj.requestNonceFormatted = solidity_helpers_misc.stringToBytes32(gameDetailsObj.requestNonce);
    	
    	// Fill in the EtherBandBattles contract address field in the game details object now.
    	gameDetailsObj.contractAddress = ebbDetails.findDeployedAt(gameDetailsObj.ethereumNetworkId);
    	
		// Update the Redis store with the new game details object image.
		redis_wrappers_lib.addGame_promise(gameDetailsObj.id, gameDetailsObj)
		.then(function(redisResponse) {
			// TODO: Validate Redis response.
			console.log(errPrefix + 'Successfully saved game details object using ID: ' + gameDetailsObj.id);
			
			// Now create a server side only game details object and store it.
			let gameDetailsSSO = new GameDetailsServerSideOnly();
			gameDetailsSSO.gameId = gameDetailsObj.id;
			
			// Store it.
			return redis_wrappers_lib.addGameDetailsServerSideOnly_promise(gameDetailsObj.id, gameDetailsSSO);
		})
		.then(function(redisResponse) {
			// TODO: Validate Redis response.
			// Send back the game details object created.
			// res.status(http_status_codes.OK).send(returnObj);
			
			// Return the modified game details object along with a success result object.
			let objAuxArgs = {
				game_details_obj: gameDetailsObj
			}

			bResponseRequired = false;
			
			common_routines.returnStandardSuccessJsonObj(req, res, "Success.", objAuxArgs);
			return null;
		})
		.catch(function(err)
		{
			let errMsg = misc_shared_lib.conformErrorObjectMsg(err);
			
			// Handle the error.
			console.log('[ERROR: ' + errPrefix + '] Error during the execution of the prepare create game payment api request. Details -> ' + errMsg);
			
			if (bResponseRequired)
				res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during a request to set the ethereum public address for a given owner.');
			return;
		});
    }
    catch (err)
    {
		if (bResponseRequired)
    	    console.log('[ERROR: prepare-for-game-payment-api] Details -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the execution of the prepare create game payment api request.');
        return;
    } // try/catch

});

module.exports = router;
