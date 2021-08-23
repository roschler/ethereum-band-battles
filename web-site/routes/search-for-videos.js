/**
 * This route services the web page that lets users search for YouTube videos to bookmark.
 */
 
var express = require("express");
var http_status_codes= require('http-status-codes');
var router = express.Router();

router.get('/search-for-videos',function(req,res, next){
    try
    {
		let locals =
		{
		};

		res.render('search-for-videos', locals , function (err, html)
		{
			if (err)
			{
				// A rendering error occurred.
				throw new Error("Rendering error(type:" + err.type + ", message: " + err.message);
			}
			else
			{
				// Send/return it.
				res.status(http_status_codes.OK).send(html);
				return;
			}
		}); // res.render('test-player', locals , function (err, html)
    }
    catch (err)
    {
        console.log('[ERROR: search-for-videos] Details -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during search for videos page creation.');
        return;
    } // try/catch

});

module.exports = router;
