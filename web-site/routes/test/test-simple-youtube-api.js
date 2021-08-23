/**
 * This module contains code that tests various functions of the simple YouTube API package.
 */


/**
 * Test a sending of a signed transaction.
 *
 */

// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

const express = require('express');
const router = express.Router();

const http_status_codes = require('http-status-codes');

// Lodash utility library.  Load the full build.
const _ = require('lodash');

const common_routines = require('../../common/common-routines');
const youtube_api_support = require('../../common/youtube-api-support');
const YouTubeSimpleApiClass = require('simple-youtube-api');

router.get('/test/test-simple-youtube-api', function(req, res, next) {
	// At first, we assume any errors are due to a bad PIN.
	let httpRetStatusCode = http_status_codes.UNAUTHORIZED;
	
    try
    {
		let errPrefix = '(test-simple-youtube-api) ';
		
		let youTubeSimpleApi = new YouTubeSimpleApiClass(process.env.YOUTUBE_API_KEY);
		
		// Public address extraction pre-test.
		let bandEthereumPublicAddr =
			youtube_api_support.extractBandPublicAddrFromChannelDesc(
			'https://EtherBandBattles.com/?band_addr=0x1888183747383847&check_balance=1')

		console.log(errPrefix + "Extracted the following Ethereum public address: " + bandEthereumPublicAddr);
		
		youTubeSimpleApi.getVideoByID('lkRbB8GgQjI')
 		.then(results => {
 			// TODO: TIP - Remember this format string logic for log statements.
   			console.log(`The video's title is ${results.title}`);

			// Get the channel description.
			let channelId = results.channel.id;
			
			if (common_routines.isEmptyString(channelId))
				throw new Error(errPrefix + "The video channel ID is empty.");
				
			// Get the channel.
 			return youTubeSimpleApi.getChannelByID(channelId)
 		})
		.then(results => {
			let channelDesc = results.raw.snippet.description;
			let publicAddr = youtube_api_support.extractBandPublicAddrFromChannelDesc(channelDesc);
			
			console.log('Extracted public address from YouTube Channel description: ' + publicAddr);
			
			console.log(`The channel's title is ${results.raw.snippet.title}`);
			console.log(`The channel's description is ${channelDesc}`);
			
   			res.status(http_status_codes.OK).send("success");
 		})
		.catch(function(err)
		{
			// Handle the error.
			console.error('[ERROR: ' + errPrefix + '] Error during transaction signing test while getting accounts (promise). Details -> ' + err.message);
			res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during get game object request.');
			return;
		});
	}
    catch (err)
    {
        console.log('[ERROR: test-signing-transaction-1] Error during request -> ' + err.message);
        res.status(httpRetStatusCode).send(err.message);
        return;
    } // try/catch
});

module.exports = router;

