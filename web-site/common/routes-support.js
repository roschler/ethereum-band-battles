/**
 * This module contains some helper functions to recover various game object passed to
 * 	us as POST request parameters.
 */

const user_details_lib = require('../public/javascripts/game-objects/user-details');
const game_details_lib = require('../public/javascripts/game-objects/game-details');
const video_bookmark_details_lib = require('../public/javascripts/game-objects/video-bookmark-details');

/**
 * This method recovers a game details object passed to us via an HTTP POST request
 * 	via an Express request object.
 *
 * @param {Object} req - A valid Express request object.
 *
 * @return {GameDetails}
 */
function recoverGameDetailsObjFromPostData(req) {
	// ---------------------- RECOVER THE GAME DETAILS OBJECT -------------
	if (!req)
		throw new Error('The Express request object is unassigned.');
	 
	if (!req.body)
		throw new Error('Missing POST parameters (body).');
		
	if (!req.body.game_details_obj)
		throw new Error('The game details object is missing.');
		
	// The body contains the JSON object we want.
	let gameDetailsObjRaw = req.body.game_details_obj;
	
	return game_details_lib.postDataToGameDetailsObject(gameDetailsObjRaw);
}

/**
 * This method recovers a user details object passed to us via an HTTP POST request
 * 	via an Express request object.
 *
 * @param {Object} req - A valid Express request object.
 *
 * @return {UserDetails}
 */
function recoverUserDetailsObjFromPostData(req) {
	// ---------------------- RECOVER THE USER DETAILS OBJECT -------------
	if (!req)
		throw new Error('The Express request object is unassigned.');
	 
	if (!req.body)
		throw new Error('Missing POST parameters (body).');
		
	if (!req.body.user_details_obj)
		throw new Error('The user details object is missing.');
		
	// The body contains the JSON object we want.
	let userDetailsObjRaw = req.body.user_details_obj;
	
	return user_details_lib.postDataToUserDetailsObject(userDetailsObjRaw);
}


/**
 * This method recovers a video bookmark details object passed to us via an HTTP POST request
 * 	via an Express request object.
 *
 * @param {Object} req - A valid Express request object.
 *
 * @return {VideoBookmarkDetails}
 */
function recoverVideoBookmarkDetailsObjFromPostData(req) {
	// ---------------------- RECOVER THE VIDEO BOOKMARK DETAILS OBJECT -------------
	if (!req)
		throw new Error('The Express request object is unassigned.');
	 
	if (!req.body)
		throw new Error('Missing POST parameters (body).');
		
	if (!req.body.user_details_obj)
		throw new Error('The video bookmark details object is missing.');
		
	// The body contains the JSON object we want.
	let videoBookmarkDetailsObjRaw = req.body.video_bookmark_details_obj;
	
	return video_bookmark_details_lib.postDataToVideoBookmarkDetailsObject(videoBookmarkDetailsObjRaw);
}

module.exports = {
	recoverGameDetailsObjFromPostData: recoverGameDetailsObjFromPostData,
	recoverUserDetailsObjFromPostData: recoverUserDetailsObjFromPostData,
	recoverVideoBookmarkDetailsObjFromPostData: recoverVideoBookmarkDetailsObjFromPostData
}