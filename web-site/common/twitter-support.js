// This file contains code for commonly used Twitter API support operations.

var common_routines = require("./common-routines");

/**
 * This function returns the user's SSL Twitter profile image in the given tweets
 *  object or NULL if there is a failure anywhere along the path to that property value.
 *
 *  @param {Object} tweets - A "tweets" object returned by a Twitter authentication
 *  	operation.
 * @return {string | null}
 */
function getProfileImage_https(tweets)
{
	try
	{
		if (common_routines.isEmptyString(tweets.profile_image_url_https))
			return null;
			
		return tweets.profile_image_url_https;
	}
	catch(err)
	{
		// Treat all errors as a failure somewhere in the response object property path.
		return null;
	}
}

module.exports =
	{
		getProfileImage_https: getProfileImage_https
	};