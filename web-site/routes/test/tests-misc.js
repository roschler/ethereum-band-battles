/**
 * A few ad hoc tests for testing various parts of the system.
 */

/**
 * Ad hoc test of the adding and retrieving of user details objects to and from
 * 	the Redis instance.
 *
 * TODO: Turn this into a standard unit test.
 */
function testUserDetailsRedisOperations()
{
	let phonyGameId = "phony-game-uuid";
	
	let newUser_1 = new user_details_lib.UserDetails();
	
	newUser_1.uuid = "new_user_1";
	newUser_1.isGameCreator = false;
	newUser_1.videoIdSubmitted = "dummy_video_1";
	newUser_1.screenName = "chat room user 1";
	newUser_1.gameId = phonyGameId;
	newUser_1.ethereumPublicAddress = "ethereum-1";
	newUser_1.validateMe();
	
	// Add a user.
	redis_wrappers_lib.addUser_promise(phonyGameId, newUser_1.id, newUser_1)
	.then(function(redisResponse)
	{
		console.log('Response from addUser_promise');
		console.log(redisResponse);
		return redis_wrappers_lib.getUser_promise(phonyGameId, newUser_1.id);
	})
	.then(function(redisResponse)
	{
		console.log('Response from getUser_promise');
		console.log(redisResponse);
		
		// Add another user.
		let newUser_2 = new user_details_lib.UserDetails();
		
		newUser_2.uuid = "new_user_2";
		newUser_2.isGameCreator = false;
		newUser_2.videoIdSubmitted = "dummy_video_2";
		newUser_2.screenName = "chat room user 2";
		newUser_2.gameId = phonyGameId;
		newUser_2.ethereumPublicAddress = "ethereum-2";
		newUser_2.validateMe();

		return redis_wrappers_lib.addUser_promise(phonyGameId, newUser_2.id, newUser_2);
	})
	.then(function(redisResponse)
	{
		console.log('Response from SECOND addUser_promise');
		console.log(redisResponse);
		
		// Now get ALL the users added.
		return redis_wrappers_lib.getAllUsers_promise(phonyGameId);
	})
	.then(function(redisResponse)
	{
		console.log('Response from getAllUsers_promise');
		console.log(redisResponse);
		
		// Done.
		return true;
	})
}

/**
 * Ad hoc test of the adding and retrieving of video bookmark details objects to and from
 * 	the Redis instance.
 *
 * TODO: Turn this into a standard unit test.
 */
function testVideoBookmarkDetailsRedisOperations()
{
	let phonyGameId = "phony-game-uuid";
	
	// The ID for video bookmarks is automatically created during object construction.
	let newVideoBookmark_1 = new video_bookmark_details_lib.VideoBookmarkDetails();
	
	newVideoBookmark_1.gameId = phonyGameId;
	newVideoBookmark_1.videoId = 'phony_video_1';
	newVideoBookmark_1.userId = 'phony_user_1';
	newVideoBookmark_1.startPoint = 10;
	newVideoBookmark_1.endPoint = 0;
	newVideoBookmark_1.comment = "Bookmark 1";
	newVideoBookmark_1.finishBookmark();
	newVideoBookmark_1.validateMe();
	
	// Add a video bookmark. Remember, the bookmark ID is NOT the YouTube video ID but a randomly
	//  generated string to represent the bookmark since there could be multiple bookmarks per
	//  video.
	redis_wrappers_lib.addVideoBookmark_promise(phonyGameId, newVideoBookmark_1.id, newVideoBookmark_1)
	.then(function(redisResponse)
	{
		console.log('Response from addVideoBookmark_promise');
		console.log(redisResponse);
		return redis_wrappers_lib.getVideoBookmark_promise(phonyGameId, newVideoBookmark_1.id);
	})
	.then(function(redisResponse)
	{
		console.log('Response from getVideoBookmark_promise');
		console.log(redisResponse);
		
		// Add another user.
		let newVideoBookmark_2 = new video_bookmark_details_lib.VideoBookmarkDetails();
		
		newVideoBookmark_2.gameId = phonyGameId;
		newVideoBookmark_2.videoId = 'phony_video_2';
		newVideoBookmark_2.userId = 'phony_user_2';
		newVideoBookmark_2.startPoint = 20;
		newVideoBookmark_2.endPoint = 0;
		newVideoBookmark_2.comment = "Bookmark 2";
		newVideoBookmark_2.finishBookmark();
		newVideoBookmark_2.validateMe();

		return redis_wrappers_lib.addVideoBookmark_promise(phonyGameId, newVideoBookmark_2.id, newVideoBookmark_2);
	})
	.then(function(redisResponse)
	{
		console.log('Response from SECOND addVideoBookmark_promise');
		console.log(redisResponse);
		
		// Now get ALL the video bookmarks added added.
		return redis_wrappers_lib.getAllVideoBookmarks_promise(phonyGameId);
	})
	.then(function(redisResponse)
	{
		console.log('Response from getAllVideoBookmarks_promise');
		console.log(redisResponse);
		
		// Done.
		return true;
	})
}

/**
 * Ad hoc test of the adding and retrieving of band details objects to and from
 * 	the Redis instance.
 *
 * TODO: Turn this into a standard unit test.
 */
function testBandDetailsRedisOperations()
{
	let phonyGameId = "phony-game-uuid";
	
	let newBand_1 = new band_details_lib.BandDetails();
	
	newBand_1.uuid = "new_band_1";
	newBand_1.videoIdSubmitted = "dummy_band_video_1";
	newBand_1.gameId = phonyGameId;
	newBand_1.ethereumPublicAddress = "band_ethereum-1";
	newBand_1.validateMe();
	
	// Add a user.
	redis_wrappers_lib.addBand_promise(phonyGameId, newBand_1.id, newBand_1)
	.then(function(redisResponse)
	{
		console.log('Response from addBand_promise');
		console.log(redisResponse);
		return redis_wrappers_lib.getBand_promise(phonyGameId, newBand_1.id);
	})
	.then(function(redisResponse)
	{
		console.log('Response from getBand_promise');
		console.log(redisResponse);
		
		// Add another user.
		let newBand_2 = new band_details_lib.BandDetails();
		
		newBand_2.uuid = "new_band_2";
		newBand_2.videoIdSubmitted = "dummy_band_video_2";
		newBand_2.gameId = phonyGameId;
		newBand_2.ethereumPublicAddress = "band_ethereum-2";
		newBand_2.validateMe();

		return redis_wrappers_lib.addBand_promise(phonyGameId, newBand_2.id, newBand_2);
	})
	.then(function(redisResponse)
	{
		console.log('Response from SECOND addBand_promise');
		console.log(redisResponse);
		
		// Now get ALL the users added.
		return redis_wrappers_lib.getAllBands_promise(phonyGameId);
	})
	.then(function(redisResponse)
	{
		console.log('Response from getAllBands_promise');
		console.log(redisResponse);
		
		// Done.
		return true;
	})
}

module.exports = {
	testBandDetailsRedisOperations: testBandDetailsRedisOperations,
	testUserDetailsRedisOperations: testUserDetailsRedisOperations,
	testVideoBookmarkDetailsRedisOperations: testVideoBookmarkDetailsRedisOperations
}