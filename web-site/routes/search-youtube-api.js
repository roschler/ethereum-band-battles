/**
 * This API route does a YouTube search and returns the video search results.
 */
 
var express = require("express");
var http_status_codes = require('http-status-codes');
var common_routines = require('../common/common-routines');
var youtube_api_support = require('../common/youtube-api-support');

var router = express.Router();


router.post('/search-youtube-api',function(req,res, next){
    try
    {
		let console = process.console;
	
    	// Make sure we have a query.
    	if (common_routines.isEmptyString(req.body.search_query))
		{
			let errStr = 'Missing search query.';
			
			throw new Error(errStr);
		}
		
		let searchQuery = req.body.search_query;
		
		// Execute a YouTube search.
		youtube_api_support.doYouTubeSearch_promise(searchQuery)
			.then(function(youtubeSearchResponse)
				{
					// Check for error code.
					if (typeof youtubeSearchResponse.error != 'undefined' && youtubeSearchResponse.error.code != http_status_codes.OK)
					{
						let errMsg =
							'YouTube search query failed with error code: ' + youtubeSearchResponse.error.code;
							
						if (youtubeSearchResponse.error.errors.length > 0)
							errMsg += "\n " + common_routines.prettyPrintObject(youtubeSearchResponse.error.errors[0]);
							
						// Log the error and throw an error.  Let the catch block handle it.
						throw new Error(errMsg);
					}
					// Return it.
					res.status(http_status_codes.OK).send(youtubeSearchResponse);
				})
			.catch(function(err)
			{
				// Handle the error.
				console.error('[ERROR: search-youtube-api] Error during YouTube API search request (promise). Details -> ' + err.message);
        		res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during YouTube video search request.');
        		return;
			});
   
    }
    catch (err)
    {
        console.log('[ERROR: search-youtube-api] Details -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during YouTube video search request.');
        return;
    } // try/catch

});

module.exports = router;
