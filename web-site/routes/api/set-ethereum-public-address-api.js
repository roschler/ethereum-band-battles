/**
 * This route stores an Ethereum public address for a given owner.
 */

var express = require("express");
var http_status_codes = require('http-status-codes');
var router = express.Router();

const common_routines = require('../../common/common-routines');
const misc_shared_lib = require('../../public/javascripts/misc/misc-shared');

const redis_wrappers_lib = require('../../common/redis-wrappers');
const EthPubAddrDetails = require('../../private-objects/ethpubaddr-details').EthPubAddrDetails;

// ======================================= POST REQUEST HANDLER ==========================

router.post('/set-ethereum-public-address-api',function(req, res, next){
   	const errPrefix = '(set-ethereum-public-address-api) ';
    
    try
    {
		const console = process.console;

		// ---------------- POST DATA PARAMETER: Group ID ----------------------------
		
		// We expect to find a group ID.
    	if (typeof req.body.group_id == 'undefined')
    		throw new Error('Missing group ID.');
    		
    	let groupId = req.body.group_id;
    	
    	if (misc_shared_lib.isEmptySafeString(groupId))
    		throw new Error('The group ID is empty.');
    		
		// ---------------- POST DATA PARAMETER: Owner ID ----------------------------
		
		// We expect to find a owner ID.
    	if (typeof req.body.owner_id == 'undefined')
    		throw new Error('Missing owner ID.');
    		
    	let ownerId = req.body.owner_id;
    	
    	if (misc_shared_lib.isEmptySafeString(ownerId))
    		throw new Error('The owner ID is empty.');
    		
		// ---------------- POST DATA PARAMETER: Ethereum public address ----------------------------
		
		// We expect to find a ethereum public address.
    	if (typeof req.body.ethereum_public_address == 'undefined')
    		throw new Error('Missing ethereum public address.');
    		
    	let ethereumPublicAddress = req.body.ethereum_public_address;
    	
    	if (misc_shared_lib.isEmptySafeString(ethereumPublicAddress))
    		throw new Error('The ethereum public address is empty.');
    		
    	let bResponseRequired = true;
    	
		// Create an EthPubAddrDetails object and save/replace it.
		let ethPubAddrDetails = new EthPubAddrDetails();
		
		ethPubAddrDetails.groupId = groupId;
		ethPubAddrDetails.ownerId = ownerId;
		ethPubAddrDetails.ethereumPublicAddress = ethereumPublicAddress;
		ethPubAddrDetails.validateMe();
			
    	// Store it.
    	redis_wrappers_lib.addEthPubAddr_promise(ethPubAddrDetails)
		.then(function(redisResponse)
		{
			// TODO:  Need to check Redis response for successful add or replace here.
			let objAuxArgs = {
			};
			
			// Return a successfulConfirmation result object with the updated game details object.
			common_routines.returnStandardSuccessJsonObj(req, res, 'Update of Ethereum public address record creation succeeded.', objAuxArgs);
			return null;
		})
		.catch(function(err)
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during a request to set the ethereum public address for a given owner (promise). Details -> ' + err.message);
			
			if (bResponseRequired)
				res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during a request to set the ethereum public address for a given owner.');
			return;
		});
    }
    catch (err)
    {
        console.log('[ERROR: ' + errPrefix + '] Details -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during a request to set the ethereum public address for a given owner.');
        return;
    } // try/catch

});

module.exports = router;
