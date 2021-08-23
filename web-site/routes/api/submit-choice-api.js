/**
 * This route executes the request to add a video bookmark.  It also is the route with
 * 	most of the game play logic in it for calculating when to move to the next round
 * 	and determining when the game is over.
 */
 
// ----------------------------------------------------------------------

const Web3 = require('web3')
const web3 = new Web3()

// ----------------------------------------------------------------------

var express = require("express");
const http_status_codes = require('http-status-codes');
const router = express.Router();

const lodash_lib = require('lodash');

// const misc_shared_lib = new (require('../../public/javascripts/misc/misc-shared')).lib_misc();
const common_routines = require('../../common/common-routines');
const misc_shared_lib = require('../../public/javascripts/misc/misc-shared');
const redis_wrappers_lib = require('../../common/redis-wrappers');
const video_details_lib = require('../../public/javascripts/game-objects/video-details');
const gamemaster_lib = require('../../common/game-master');
const array_sort_lib = require('array-sort')
const winner_details_lib = require('../../public/javascripts/game-objects/winner-details');
const youtube_api_support = require('../../common/youtube-api-support');
const routes_support = require('../../common/routes-support');
const EnumGameState = require('../../common/solidity-helpers-misc').EnumGameState;
const FugoObjects_ebb_sso = require('../../private-objects/fugo').FugoObjects_ebb_sso;
const EnumValidateMeTypes = require('../../public/javascripts/misc/validation').EnumValidateMeTypes;
const EthPubAddrDetails = require('../../private-objects/ethpubaddr-details').EthPubAddrDetails;
const GameDetails = require('../../public/javascripts/game-objects/game-details').GameDetails;
const UserDetails = require('../../public/javascripts/game-objects/user-details').UserDetails;
const GameDetailsServerSideOnly = require('../../common/game-details-server-side-only').GameDetailsServerSideOnly;

const addGameRoundResult_promise = require('../../ethereum/ethtrans-add-game-round-result').addGameRoundResult_promise;

/**
 * Given an array of bookmarks, find the bookmark that is closest to
 * 	the average start point for all the bookmarks in the array, and
 * 	then return a Winner Details object built from that bookmark with
 * 	some additional fields calculate during the process.
 *
 * @param {Array} aryVideoBookmarks - An array of video bookmarks for
 * 	a single video.
 *
 * 	NOTE: In the event of a tie where more than one user chose the exact same
 * 		video location, select the bookmark that with the oldest server
 * 		timestamp (i.e. - the oldest bookmark in the tie).
 *
 * @param {Object} aryVideoBookmarks - an array of video bookmarks.
 */
 function compareBookmarks(b1, b2)
{
	// Sort by startPoint.
	if (b1.startPoint < b2.startPoint)
		return -1;
	if (b1.startPoint > b2.startPoint)
		return 1;
		
	// startPoint's are equal.  Sort by timeStampedByServer.
	if (b1.timeStampedByServer < b2.timeStampedByServer)
		return -1;
	if (b1.timeStampedByServer > b2.timeStampedByServer)
		return 1;

	// TODO: This should never happen since the timestamps should never be equal
	//  between bookmarks, but revisit this later to be sure.
	return 0;
}

/**
 * Given an array of video bookmarks, determine which player's choice is closest
 * 	to the most popular spot in the video.
 *
 * @param {Array} aryVideoBookmarks - An array of all the bookmarks for one video.
 *
 * @return {WinnerDetails} - Return a winner details object for the winning player.
 */
function calculateWinnerForOneVideo(aryVideoBookmarks)
{
	let errPrefix = '(calculateWinnerForOneVideo) ';
	
	if (!Array.isArray(aryVideoBookmarks))
		throw new Error('The video bookmarks parameter is not an array.');

	if (aryVideoBookmarks.length < 1)
		throw new Error('The video bookmarks array is empty.');
		
	// Sort the video bookmarks first by start point then by server timestamp.
	let arySortedBookmarks =
		array_sort_lib(aryVideoBookmarks, compareBookmarks);
			
	// Calculate the average start point across all the bookmarks.
	let sumStartPoints = 0;
	let avgStartPoint = 0;
	let firstVideoIdFound = aryVideoBookmarks[0].videoId;
	
	for (let ndx = 0; ndx < arySortedBookmarks.length; ndx++)
	{
		// Sanity check to make sure all the video IDs are the same in the bookmarks array.
		if (ndx > 0 && arySortedBookmarks[ndx].videoId != firstVideoIdFound)
			throw new Error(errPrefix + 'The bookmarks in the bookmarks array should all be for the same video.');
		
		sumStartPoints += arySortedBookmarks[ndx].startPoint;
	}
	
	if (sumStartPoints > 0)
		// Calculate the average start point.
		avgStartPoint = sumStartPoints / aryVideoBookmarks.length;
	
	// Now find the first bookmark whose start point is closest to the average.
	let smallestDiff = 0;
	let ndxOfFirstSmallestDiff = 0;
	
	for (let ndx = 0; ndx < arySortedBookmarks.length; ndx++)
	{
		// Sanity check to make sure all the video IDs are the same in the bookmarks array.
		let absDiffStartPoints = Math.abs(avgStartPoint - arySortedBookmarks[ndx].startPoint);
		
		if (absDiffStartPoints < smallestDiff)
		{
			// New champion.  Save it.
			smallestDiff = absDiffStartPoints;
			ndxOfFirstSmallestDiff = ndx;
		}
	}
	
	let winningBookmark = arySortedBookmarks[ndxOfFirstSmallestDiff];
	
	// Build the winner details object.
	let newWinnerDetailObj = new winner_details_lib.WinnerDetails();
	
	newWinnerDetailObj.userId = winningBookmark.userId;
	newWinnerDetailObj.videoId = winningBookmark.videoId;
	newWinnerDetailObj.videoTitle = winningBookmark.videoTitle;
	newWinnerDetailObj.startPoint = winningBookmark.startPoint;
	newWinnerDetailObj.avgStartPoint = avgStartPoint;
	
	// We have to set the timestamp since this user is not added to redis.
	newWinnerDetailObj.timeStampedByServer = misc_shared_lib.nowDateTime();
	
	// Validate it.
	newWinnerDetailObj.validateMe();

	// Return the winner details object.
	return newWinnerDetailObj;
}

/**
 * Given an array of video bookmarks and a desired video ID, extract all the
 * 	video bookmarks bearing that ID from the given array and return the filtered
 * 	array.
 *
 * @param {Array} aryVideoBookmarks - An array of video bookmarks.
 * @param {string} desiredVideoId - The ID of the video that we want bookmarks for.
 *
 * @return {Array} - Returns an array containing only those video bookmarks that
 * 	have the same video ID as the desired video ID.
 */
function extractVideoBookmarksForOneVideoId(aryVideoBookmarks, desiredVideoId) {
	let aryFilteredVideos =
		lodash_lib.filter(
			aryVideoBookmarks,
			function(userDetailsObj)
			{
				return userDetailsObj.videoId == desiredVideoId;
			});
			
	return aryFilteredVideos;
}

/**
 * Given all the users in a game and all the video bookmarks too, calculate the
 * 	winner for each round.
 *
 * @param {Object} gameDetailsObj - A valid game details object.
 * @param {Array} aryUsers - An array of all the users in the game.
 * @param {Array} aryVideoBookmarks - An array of all the video bookmarks in the game.
 *
 * @return	{Object} - Returns an object containing the game results that shows the
 * 	winner of each round.
 */
function calculateWinners(gameDetailsObj, aryUsers, aryVideoBookmarks)
{
	let errPrefix = '(calculateWinners) ';
	
	// First, create an array of all the video IDs, which currently
	//  are found in the users array.
	let aryVideoIds = lodash_lib.map(aryUsers, 'videoIdSubmitted');
	
	if (aryVideoIds.length < 0)
		throw new Error(errPrefix + 'The array of video IDs is empty.');
		
	let aryWinnersObj = new Array();
	
	// For each video ID, create an array of all the video bookmarks
	//  for that ID, and calculate the winning bookmark per video.
	for (let ndx = 0; ndx < aryVideoIds.length; ndx++)
	{
		if (!aryVideoIds[0])
			throw new Error(errPrefix + 'The array of video IDs is invalid.');
		
		let aryBookmarksPerVideo =
			extractVideoBookmarksForOneVideoId(aryVideoBookmarks, aryVideoIds[ndx]);
			
		// Calculate the winner for this video.
		let winnerDetailsObj = calculateWinnerForOneVideo(aryBookmarksPerVideo);
		
		aryWinnersObj.push(winnerDetailsObj);
	}
	
	return aryWinnersObj;
}

/**
 * This method is called when all the videos have been played and bookmarked.  It calculates
 * 	the winners and returns that data in a JSON object that is embedded in the game
 * 	details object.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {string} appEventId - An app event ID.
 * @param {GameDetails} gameDetailsObj - The game details object for the current game.
 *
 * @return {Promise}
 *
 */
function gameOverProcessing_promise(req, res, appEventId, gameDetailsObj)
{
	return new Promise(function(resolve, reject) {
		let errPrefix = '(gameOverProcessing_promise) ';
		let aryUsers = null;
		let aryVideoBookmarks = null;
		let aryWinnerDetailsObj = null;
		
		try {
			if (misc_shared_lib.isEmptySafeString(appEventId))
				throw new Error(errPrefix + 'The appEventId parameter is empty.');
				
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object is unassigned');
			
			if (!(gameDetailsObj instanceof GameDetails))
				throw new Error(errPrefix + 'The value in the gameDetailsObj parameter is not a GameDetails object.');

			// Get all the users in the game.
			redis_wrappers_lib.getAllUsers_promise(gameDetailsObj.id)
			.then(function(redisResponse)
			{
				// Validate the redis response as being a non-empty array of users.
				redis_wrappers_lib.validateRedisResponseAsArray(redisResponse, errPrefix + 'The response from Redis to our request to get all the users in the game is not an array.', true);
		
				aryUsers = redisResponse;
				
				// Get all the bookmarks in the game.
				return redis_wrappers_lib.getAllVideoBookmarks_promise(gameDetailsObj.id);
			})
			.then(function(redisResponse)
			{
				// Validate the redis response as being a non-empty array of video bookmarks.
				redis_wrappers_lib.validateRedisResponseAsArray(redisResponse, errPrefix + 'The response from Redis to our request to get all the video bookmarks in the game is not an array.', true);
		
				aryVideoBookmarks = redisResponse;
				
				// Return the results of the winner calculations
				aryWinnerDetailsObj = calculateWinners(gameDetailsObj, aryUsers, aryVideoBookmarks);
				
				if (aryWinnerDetailsObj.length < 0)
					throw new Error(errPrefix + 'We could not find any winners.');
					
				// Mark the game as completed and save to Redis.  Also, wipe the ID and title of the
				//  video currently playing.
				gameDetailsObj.state = EnumGameState.GAME_OVER;
				gameDetailsObj.videoIdCurrentlyPlaying = "";
				gameDetailsObj.videoTitleCurrentlyPlaying = "";
				gameDetailsObj.aryWinners = aryWinnerDetailsObj;
				
				return redis_wrappers_lib.addGame_promise(gameDetailsObj.id, gameDetailsObj);
			})
			.then(function(redisResponse)
			{
				// Broadcast the game results.
				let broadcastPayload =
					gamemaster_lib.gamemaster.buildPayload_game_over(gameDetailsObj, appEventId);
				
				return gamemaster_lib.gamemaster.broadcastMessage_promise(
					req,
					res,
					gameDetailsObj,
					broadcastPayload,
					'Game over!');
			})
			.then(function(broadcastResponse)
			{
				// Resolve the promise with the updated game details object.
				resolve(gameDetailsObj);
			})
			.catch(err => {
				reject(err);
			});
		}
		catch(err)
		{
			reject(err);
		}
	});
}

/**
 * This function returns a promise that does the necessary steps to advance the game
 * 	to the next round.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {string} appEventId - An app event ID.
 * @param {GameDetails} gameDetailsObj - The game details object for the current game.
 * @param {Array} aryUsersWithUnplayedVideos - The array of users with unplayed videos.
 *
 * @return {Promise}
 */
function continueGame_promise(req, res, appEventId, gameDetailsObj, aryUsersWithUnplayedVideos)
{
	let errPrefix = '(continueGame_promise) ';
	
	if (!req)
		throw new Error(errPrefix + 'The Express request object is unassigned.');
		
	if (!res)
		throw new Error(errPrefix + 'The Express response object is unassigned.');
		
	if (misc_shared_lib.isEmptySafeString(appEventId))
		throw new Error(errPrefix + 'The appEventId parameter is empty.');
	
	// Save a reference to the user details object selected for video playback, the
	//  first one found.
	let firstUserWithQueuedVideoObj = aryUsersWithUnplayedVideos[0];
	
	// Mark the user's video as no longer queued.
	//	TODO: Later, make this more robust by waiting for a 'playing' report from all the
	//		client video players.
	firstUserWithQueuedVideoObj.videoStatus = video_details_lib.VideoDetailsConstants.VIDEO_STATE_PLAYING;
	
	// Update the user details record with the modifications we made to it.
	redis_wrappers_lib.addUser_promise(gameDetailsObj.id, firstUserWithQueuedVideoObj.uuid, firstUserWithQueuedVideoObj)
	.then(function(redisResponse)
	{
		// Update the game details object field that tracks the video currently playing.
		//  current round.
		gameDetailsObj.videoIdCurrentlyPlaying = firstUserWithQueuedVideoObj.videoIdSubmitted;
		// Same for the field that tracks the video title.
		gameDetailsObj.videoTitleSubmitted = firstUserWithQueuedVideoObj.videoTitleSubmitted;
		
		// Update Redis with the modified game details object.
		return redis_wrappers_lib.addGame_promise(gameDetailsObj.id, gameDetailsObj);
	})
	.then(function(redisResponse)
	{
		// Broadcast the request to start the next round of play.
		let broadcastPayload =
			gamemaster_lib.gamemaster.buildPayload_play_next_round(gameDetailsObj, appEventId, firstUserWithQueuedVideoObj);
		
		return gamemaster_lib.gamemaster.broadcastMessage_promise(
			req,
			res,
			gameDetailsObj,
			broadcastPayload,
			'Start the next round by playing a new video.');
	})
	.then(function(broadcastResponse)
	{
		// Return a successfulConfirmation result object with the updated game details object.
		let retJsonObj = {
				is_error: false,
				game_details_obj: gameDetailsObj,
				message: 'Game continued to the next round successfully.'
			};
			
		res.status(http_status_codes.OK).send(retJsonObj);
		return;
	});
}

/**
 * This function just sends a successfulConfirmation response to the caller to let them know
 * 	we recorded the bookmark successfully.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {GameDetails} gameDetailsObj - The game details object for the current game.
 * @param {VideoBookmarkDetails} - The video bookmark to add.
 *
 * @return {Promise}
 */
function addBookmarkAndReturn_promise(req, res, gameDetailsObj, videoBookmarkDetailsObj)
{
	let errPrefix = '(addBookmarkAndReturn_promise) ';
	
	if (!req)
		throw new Error(errPrefix + 'The Express request object is unassigned.');
		
	if (!res)
		throw new Error(errPrefix + 'The Express response object is unassigned.');
		
	if (!gameDetailsObj)
		throw new Error(errPrefix + 'The game details object is unassigned.');
		
	if (!videoBookmarkDetailsObj)
		throw new Error(errPrefix + 'The video bookmark details object is unassigned.');
		
	// Get the user object for the user that recorded the bookmark.
	let userDetailsObj = null;
	
	redis_wrappers_lib.getUser_promise(gameDetailsObj.id, videoBookmarkDetailsObj.userId)
	.then(function(redisResponse)
	{
		if (!redisResponse)
			throw new Error(errPrefix + 'Redis could not find a user with the ID: ' + userId);
			
		userDetailsObj = redisResponse;
		
		// Store the bookmark.
		return redis_wrappers_lib.addVideoBookmark_promise(gameDetailsObj.id, videoBookmarkDetailsObj.id, videoBookmarkDetailsObj);
	});
}

/**
 * This function returns a promise that builds a game round result and then
 * 	calls the addGameRoundResult() smart contract method that adds game round
 * 	result to the correct game ID element.  It also extracts the band's
 * 	Ethereum public address from their YouTube channel, the one that owns
 * 	the target video ID, if an Ethereum public address was found in the channel's
 * 	description.
 *
 * @param {GameDetails} gameDetailsObj - The game details object for the current game.
 * @param {string} videoId - The ID for the video that was use during the game round
 * 	we are building a result object for.
 *
 * @return {Promise<string>} - The promise returns the transaction hash for the
 * 	Ethereum transaction we submitted to make the smart contract method that
 * 	adds a game round result.
 */
function doGameRoundResult_promise(gameDetailsObj, videoId) {
	return new Promise(function(resolve, reject) {
		try
		{
			let errPrefix = '(doGameRoundResult_promise) ';
			
			if (!gameDetailsObj)
				throw new Error(errPrefix + 'The game details object is unassigned.');
				
			if (misc_shared_lib.isEmptySafeString(videoId))
				throw new Error(errPrefix + 'The video ID is empty.');
				
			let aryVideoBookmarks = null;
			let winnerDetailsObj = null;
			let winningUserDetailsObj = null;
			let winningUserEthPubAddr = null;
			let txHash = null;
			
			let gameDetailsServerSideOnlyObj = null;
			
			// First, get the server side only game details object for this game.
			redis_wrappers_lib.getGameDetailsServerSideOnly_promise(gameDetailsObj.id)
			.then(redisResponse => {
				if (!redisResponse)
					throw new Error(errPrefix + 'Redis could not find a server side only game details object with the game ID: ' + gameDetailsObj.id);
				if (!(redisResponse instanceof GameDetailsServerSideOnly))
					throw new Error(errPrefix + 'The value in the redisResponse parameter is not a GameDetailsServerSideOnly object.');
					
				gameDetailsServerSideOnlyObj = redisResponse;
				
				// Increment the count of completed rounds of play.
				gameDetailsServerSideOnlyObj.countCompletedRoundsOfPlay++;
				
				// Update Redis.
				return redis_wrappers_lib.addGameDetailsServerSideOnly_promise(gameDetailsServerSideOnlyObj.gameId, gameDetailsServerSideOnlyObj);
			})
			.then(redisResponse =>
			{
				// TODO: Need better handling of redisResponse codes.
				
				// Now get all the bookmarks in the game.
				return redis_wrappers_lib.getAllVideoBookmarks_promise(gameDetailsObj.id)
			})
			.then(redisResponse =>
			{
				// Validate the redis response as being a non-empty array of video bookmarks.
				redis_wrappers_lib.validateRedisResponseAsArray(
					redisResponse,
					errPrefix
					+ 'The response from Redis to our request to get all the video bookmarks in the game is not an array.', true);
		
				aryVideoBookmarks = redisResponse;
				
				let aryBookmarksPerVideo =
					extractVideoBookmarksForOneVideoId(aryVideoBookmarks, videoId);
					
				if (aryBookmarksPerVideo.length < 1)
					throw new Error(errPrefix + 'The array of video bookmarks for a single video is empty.');
					
				// Calculate the winner for this video.
				winnerDetailsObj = calculateWinnerForOneVideo(aryBookmarksPerVideo);
				
				// Add the winner to the game's winners array.
				gameDetailsObj.aryWinners.push(winnerDetailsObj);

				// Get the user object for the winning user.
				return redis_wrappers_lib.getUser_promise(gameDetailsObj.id, winnerDetailsObj.userId);
			})
			.then(redisResponse => {
				if (!redisResponse)
					throw new Error(errPrefix + 'Redis could not find a user with the ID: ' + winnerDetailsObj.userId);
				
				if (!(redisResponse instanceof UserDetails))
					throw new Error(errPrefix + 'The value in the redisResponse parameter is not a UserDetails object.');
				
				// The result should contain the user details object for the winning user.
				winningUserDetailsObj = redisResponse;
				
				// Now get winning user's Ethereum public address.
				return redis_wrappers_lib.getEthPubAddr_promise(gameDetailsObj.id, winnerDetailsObj.userId);
			})
			.then(redisResponse => {
				if (!redisResponse)
					throw new Error(errPrefix + 'Redis could not find an Ethereum public address for user ID: ' + winnerDetailsObj.userId);
				
				if (!(redisResponse instanceof EthPubAddrDetails))
					throw new Error(errPrefix + 'The value in the redisResponse parameter is not an Ethereum public address details object.');
					
				winningUserEthPubAddr = redisResponse;
				
				winningUserEthPubAddr.validateMe();
				
				// Get the video details for the current video ID and details for the YouTube
				//  channel that owns the video.
				return youtube_api_support.getVideoAndChannelDetails_promise(videoId);
			})
			.then(result => {
				
				let ytChannelAndVideoDetails = result;
				let bandPublicAddr = ytChannelAndVideoDetails.ethereumPublicAddress;
				
				if (!bandPublicAddr || bandPublicAddr.length < 1)
				{
					// Conform empty or NULL band public addresses to 0.  0 tells the smart contract
					//  addGameRoundResult() method to put the payment amount due the band for this
					//	video in escrow, keyed to the owner channel ID, instead of paying the
					//  band directly, which we can't do because they haven't put their Ethereum
					//  public address in their channel description yet.
					bandPublicAddr = '0';
				}
				
				// Format the video ID in the way necessary to make an Ethereum smart contract call that
				//  is looking for a bytes32 method parameter.
				let formattedVideoId = web3.utils.fromAscii(videoId);
				
				// Do the same for the channel ID.
				let formattedChannelId = web3.utils.fromAscii(bandPublicAddr);
				
				// Validate the count of completed rounds of play.
				if (gameDetailsServerSideOnlyObj.countCompletedRoundsOfPlay < 1)
					throw new Error(errPrefix + ' The count of completed rounds of play is invalid for game ID: ' + gameDetailsObj.id);
				
				console.log(errPrefix + `ADD-GAME-ROUND-RESULT: Game ID: ${gameDetailsServerSideOnlyObj}, # rounds of play: ${gameDetailsServerSideOnlyObj.countCompletedRoundsOfPlay}, video ID: ${formattedVideoId}, channel ID: ${formattedChannelId}, addr of winner: ${winningUserEthPubAddr.ethereumPublicAddress}, band addr: ${bandPublicAddr}.`);
				console.log(errPrefix + `ADD-GAME-ROUND-RESULT: Game ID: ${gameDetailsServerSideOnlyObj}, # rounds of play: ${gameDetailsServerSideOnlyObj.countCompletedRoundsOfPlay}, video ID: ${formattedVideoId}, channel ID: ${formattedChannelId}, addr of winner: ${winningUserEthPubAddr.ethereumPublicAddress}, band addr: ${bandPublicAddr}.`);
				
				// Execute the promise that schedules an add game round result transaction.
				return addGameRoundResult_promise(
					gameDetailsObj,
					gameDetailsServerSideOnlyObj.countCompletedRoundsOfPlay,
					formattedVideoId,
					formattedChannelId,
					winningUserEthPubAddr.ethereumPublicAddress,
					bandPublicAddr);
			})
			.then(result => {
				if (result !== true)
					throw new Error(errPrefix + 'The result of the addGameRoundResult_promise() call is not TRUE or is not boolean.');
				
				// Save the updated game details object.
				return redis_wrappers_lib.addGame_promise(gameDetailsObj.id, gameDetailsObj);
			})
			.then(redisResponse => {
				// TODO: Need better Redis response code handling.
				resolve(true);
			})
			.catch(err => {
				reject(err);
			});
		}
		catch(err)
		{
			reject(err);
		}
	});
}


router.post('/submit-choice-api',function(req,res, next){
   	const errPrefix = '(submit-choice-api) ';
   	
   	// Find the game details object using the game ID provided.
   	let bResponseMade = false;
    
    try
    {
		const console = process.console;
		
		// ----->>>>> PARAMETER: Video Bookmark
		if (typeof req.body.video_bookmark_details_obj == 'undefined')
    		throw new Error('Missing video bookmark details object.');
    		
    	if (misc_shared_lib.isEmptySafeString(req.body.video_bookmark_details_obj))
    		throw new Error('The video bookmark details object is empty.');
    		
    	// Reconstitute the video bookmark details object.
    	let videoBookmarkDetailsObj = routes_support.recoverVideoBookmarkDetailsObjFromPostData(req);

    	let gameId = videoBookmarkDetailsObj.gameId;
    	let userId = videoBookmarkDetailsObj.userId;
    	let currentVideoId = videoBookmarkDetailsObj.videoId;
    	
		// ---------------------- APP EVENT ID -------------
		
		// We should have gotten an app event ID for tracking purposes.
		if (!req.body.app_event_id)
			throw new Error('Missing app event ID.');
			
		let appEventId = req.body.app_event_id;
		
		if (misc_shared_lib.isEmptySafeString(appEventId))
			throw new Error('The app event ID is empty.');
			
		// ------------------------------
    		
    	// ------------------------------ FUGO - Build the object that gets commonly used server side objects -------------------
    	
    	// Get the game details object with advanced validation, and then get the user details object
    	//  for the user that submitted the bookmark with advanced validation too.  Do not get the
    	//  user's Ethereum public address.
    	let fugoObj = new FugoObjects_ebb_sso(
    		gameId,
    		EnumValidateMeTypes.ADVANCED_VALIDATION,
    		videoBookmarkDetailsObj.userId,
    		EnumValidateMeTypes.ADVANCED_VALIDATION,
    		false);
    		
    	// Now execute the FUGO promise to actually get the desired objects.
    	fugoObj.getObjects_promise()
    	.then(result => {
    		// getObjects_promise should resolve to TRUE if all went well.  Otherwise the promise should reject.
    		//  The result check below is just for some extra insurance.
    		if (result !== true)
    			throw new Error(
    				errPrefix
    				+ 'The result of the method that gets the frequently used game objects from Redis did not return TRUE.  Using game ID: '
    				+ gameId);
    	
			console.log(errPrefix + 'Successfully found a game details object using ID: ' + gameId);
			
			// If we are not currently playing a game, return an error.
			if (fugoObj.gameDetailsObj.state != EnumGameState.PLAYING){
				// No.  Return an error.
				let errMsg =
					+ fugoObj.gameDetailsObj.state;
				
				// No.  Return an error.
				common_routines.returnStandardErrorObj(req, res, errMsg);
				bResponseMade = true;
				throw new Error(errMsg);
			}
			// If the video ID for the bookmark submitted does not match that
			//  of the one currently playing, that is an error.
			else if (fugoObj.gameDetailsObj.videoIdCurrentlyPlaying != currentVideoId){
				let errMsg = 'Unable to add a video bookmark because the bookmark is not for the video the game is currently playing.';
				
				// No.  Return an error.
				common_routines.returnStandardErrorObj(req, res, errMsg);
				bResponseMade = true;
				throw new Error(errMsg);
			}
			else
				// See if the user already submitted their choice for this video.
				return redis_wrappers_lib.isExistingVideoBookmarkChoice_promise(gameId, userId, currentVideoId);
		})
		.then(function(redisResponse)
		{
			if (typeof redisResponse != 'boolean')
				throw new Error(errPrefix + ' The response from Redis to our existing video bookmark check was not boolean.')
				
			if (redisResponse == true)
			{
				// User already submitted a bookmark for the currently playing video.  That is an error.
				let errMsg = 'Unable to add a video bookmark because you have already made your choice for this video (duplicate choice).';
				console.log(errPrefix + errMsg);
				common_routines.returnStandardErrorObj(req, res, errMsg);
				throw new Error(errMsg);
			}
			
			// Now record the bookmark.
			return addBookmarkAndReturn_promise(req, res, fugoObj.gameDetailsObj, videoBookmarkDetailsObj);
		})
		.then(function(redisResponse)
		{
			// TODO: Need better handling of Redis response codes.
			
			// Now check to see if all the video bookmarks have been submitted for the current round, indicating
			//  the current round is completed.
			//
			//  DEFINITION: If the currently playing video has bookmarks from all the participating users
			//		in the current game, then the current round of play is completed.
			return redis_wrappers_lib.getUsersWhoHaveNotBoomkmarkedVideo_promise(gameId, currentVideoId);
		})
		.then(function(aryPendingUsers)
		{
			redis_wrappers_lib.validateRedisResponseAsArray(aryPendingUsers, errPrefix + 'The response from Redis to our request for all the users who have not bookmarked a video is not an array.', false);
			
			// Has everyone bookmarked the currently playing video yet?
			let bIsVideoBookmarkedByAll = (aryPendingUsers.length < 1);
			
			if (bIsVideoBookmarkedByAll)
			{
				// Execute the promise that will calculate the winner of this round and then
				//  add the game round result to the game the video belongs to using
				//  an Ethereum transaction sent to the smart contract method that does that.
				//
				// NOTE: doGameRoundResult_promise() executes the transaction to add the game
				//  round result to the game.  Just the submission of that transaction has
				//  a long delay, then comes the delay of waiting for the Ethereum transaction
				// 	to be mined.
				return doGameRoundResult_promise(fugoObj.gameDetailsObj, currentVideoId)
				.then(result => {
					
					// The result should be a simple TRUE.
					if (result !== true)
						throw new Error(errPrefix + 'The result of the doGameRoundResult_promise() call is not TRUE or is not boolean.');
					
					
					// Now get a list of all the users who have not had their videos played yet.
					return gamemaster_lib.gamemaster.getAllUsersWithQueuedVideos_promise(fugoObj.gameDetailsObj.id);
				})
				.then(function(redisResponse){
					// The array may be empty if all the videos have been played.
					redis_wrappers_lib.validateRedisResponseAsArray(redisResponse, 'The response from the get all queued videos in the game returned an invalid response.', false);
					
					let aryUsersWithUnplayedVideos = redisResponse;
					
					// If we still have unplayed videos, continue the game.  Note, the make payments
					//  call is made from the add game round result on-success handler, once all
					//  the Ethereum transactions related to game round result processing have
					//  been mined/confirmed.
					if (aryUsersWithUnplayedVideos.length > 0)
						return continueGame_promise(req, res, appEventId, fugoObj.gameDetailsObj, aryUsersWithUnplayedVideos);
					else
					{
						// This game is done.  No more videos to play (i.e. - no more game rounds left).
						// We broadcast the message to the players that the game is over now so they
						//  don't have to wait for any of the game over Ethereum transactions to be
						//  confirmed/mined.
						// The game is over.  Calculate the winners and then initiate the make payments process.
						console.log(
							errPrefix
							+ 'Game ID('
							+ fugoObj.gameDetailsObj.id
						 	+ ') is over.  Post-processing will now begin.  Broadcasting game results now to the players.');
						return gameOverProcessing_promise(req, res, appEventId, fugoObj.gameDetailsObj)
					}
				});
			}
			else
			{
				// Just return a message indicating the bookmark was successfully added.
				console.log(errPrefix + 'Bookmark choice successfully recorded.  Awaiting confirmation of the game round result addition from the Ethereum network');
				
				// Return a successfulConfirmation result object with the updated game details object.
				let retJsonObj = {
						is_error: false,
						user_details_obj: fugoObj.userDetailsObj,
						game_details_obj: fugoObj.gameDetailsObj,
						message: 'Bookmark recorded successfully.'
					};
					
				res.status(http_status_codes.OK).send(retJsonObj);
				return;
			}
		})
		.catch(function(err)
		{
			// Handle the error.
			let errMsg =
				'[ERROR: '
				+ errPrefix
				+ '] Error during submit choice request (promise). Details -> '
				+ misc_shared_lib.conformErrorObjectMsg(err);
				
			console.error(errMsg);
			
			if (!bResponseMade)
				res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during submit choice request.');
			return;
		});
    }
    catch (err)
    {
        console.log('[ERROR: ' + errPrefix + '] Details -> ' + err.message);
		if (!bResponseMade)
       		res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during the submit choice request.');
        return;
    } // try/catch

});

module.exports = router;
