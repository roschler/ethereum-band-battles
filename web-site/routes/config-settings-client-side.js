// This route produces the CLIENT SIDE Javascript file "myconfig.js", which is requested
//  by other files and is expected to contain various settings the app
//  needs to fulfill its operations.
const express = require('express');
const router = express.Router();

const http_status_codes = require('http-status-codes');

// Lodash utility library.  Load the full build.
const _ = require('lodash');

const pubnub_support = require('../common/pubnub-support-server-side');
const ebbDetails = require('../common/contract-details').EtherBandBattlesManager_details;
const solidity_helpers_misc = require('../common/solidity-helpers-misc');

router.get('/js/myconfig.js', function(req, res, next) {
    try
    {
    	let errPrefix = "(/js/myconfig.js) ";
    	let locals = {};
    	
		// Get the PubNub publish & subscribe keys from the environment.
 		locals.pubnub_publish_key = pubnub_support.getPubNubPublishKeyFromEnvironment();
 		locals.pubnub_subscribe_key = pubnub_support.getPubNubSubscribeKeyFromEnvironment();
 		
 		// The client side needs access to the EtherBandBattlesManager contract ABI.
 		let str = '\\\"';
 		locals.ebb_abi_str = JSON.stringify(ebbDetails.abi).replace(/\"/g, str);
 		
 		// Our YouTube API key for client side use.
 		if (!process.env.YOUTUBE_API_KEY)
 			throw new Error(errPrefix + 'The YouTube API key has not been set in the environment.');
 			
 		// See what Ethereum network we are currently running/testing on.
 		locals.ethereum_network_id  = solidity_helpers_misc.getTargetEthereumNetworkId();
 		
 		// We provide the Web3 provider URL here to the client.
 		// locals.web3_provider_url = solidity_helpers_misc.getWeb3ProviderUrl(locals.ethereum_network_id);
 		
        // Just return the rendered view.
        res.setHeader('content-type', 'text/javascript');
        res.render(
            "myconfig",
            locals,
            function (err, html)
            {
                if (err)
                {
                    // A rendering error occurred.
                    throw new Error("Rendering error(type:" + err.type + ", message: " + err.message);
                }
                else
                {
                    // Send/return our image of the myconfig.js file.
                    res.status(http_status_codes.OK).send(html);
                    return;
                }
            });
	}
    catch (err)
    {
        console.log('[ERROR: config-settings-client-side.js] Error during request -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('An error occurred while processing the request for /js/myconfig.js.');
        return;
    } // try/catch
});

module.exports = router;
