/**
 * This file contains additional middleware used by the app.
 */
 
var http_status_codes = require('http-status-codes');
var common_routines = require('./common-routines');

// ----------------------- MIDDLEWARE ------------------

/**
 * This function looks for a valid Twitter user ID in a request's session object.
 * 	If trying to access that property path fails for any reason, or the that
 * 	property is an empty string, return NULL.  Otherwise return the Twitter user
 * 	ID found.
 *
 * @param {Object} req - A valid Node.JS Express request object.
 * @return {string | null} - The Twitter user ID found or NULL if none were found.
 */
function getTwitterUserIdFromSession(req)
{
	try
	{
		// If the session variable does not contain a Twitter User Id,
		//  return null;
		if (common_routines.isEmptyString(req.session.twitter.user_id))
			return null;

		// Return the Twitter user ID found in the session object.
		return req.session.twitter.user_id.trim();
	}
	catch(err)
	{
		// Assume any error is due to a problem somewhere along the property path
		//  to the Twitter user ID.
		return null;
	}
}

/**
 * A Person object.  This object represents a particular user.
 *
 * @param {string} firstName - The user's first name.
 * @param {string} lastName - The user's last name.
 * @param {string} uuid - A unique user ID for the user.
 * @param {string} avatarUrl - The URL to the user's avatar image.
 *
 */
function PersonObject(firstName, lastName, uuid, avatarUrl)
{
	// Validate parameters.
	if (common_routines.isEmptyString(firstName))
		throw new Error("The first name parameter is empty.");
	// Last name can be empty, but not NULL or undefined.
	if (!common_routines.isDefinedAndNotNull(lastName))
		throw new Error("The last name parameter is undefined or NULL.");
	if (common_routines.isEmptyString(uuid))
		throw new Error("The unique user ID parameter is empty.");
	if (common_routines.isEmptyString(avatarUrl))
		throw new Error("The avatar URL is empty.");
		
	// Build the object properties.
	this.first = firstName.trim();
	this.last = lastName.trim();
	
	// Build the full name from the first and last name.
	if (this.last.length > 0)
		this.full = [this.first, this.last].join(" ");
	else
		this.full = this.first;
		
	this.avatar = avatarUrl.trim();
	
	// Treat "now" as the last seen time.
	this.lastSeen = Date.now();
}

/**
 * Builds a new Person object.
 *
 * @param {string} firstName - The user's first name.
 * @param {string} lastName - The user's last name.
 * @param {string} uuid - A unique user ID for the user.
 * @param {string} avatarUrl - The URL to the user's avatar image.
 *
 * @return	{Object | null} - Returns a fully built Person object or NULL
 *  if there was an error during the construction of the object.
 */
function newPerson(firstName, lastName, uuid, avatarUrl)
{
	try
	{
		return new PersonObject(firstName, lastName, uuid, avatarUrl);
	}
	catch(err)
	{
		// Log the error and return NULL.
		console.log("(newPerson) Error building new person object: " + err.message);
		return null;
	}
}

/**
 * This function builds the object required by our user facing code that
 *  represents a Twitter user.
 *
 * @param {Object} req - A valid Node.JS Express request object.
 * @return {Object | null} - A valid Person object or NULL if there was
 *  a problem building the Person object.
 */
function buildPersonObjectFromTwitterUser(req)
{
	try
	{
		// Build a new Person object using the Twitter user data fields.
		
		// Use their Twitter screen name as the first name.
		let firstName = req.session.twitter.screen_name;
		// The last name is empty since we are using the screen name.
		let lastName = "";
		// Use their Twitter user ID as our user ID.
		let uuid = req.session.twitter.user_id;
		// Use their SSL Twitter profile image URL as our avatar image URL.
		let avatarUrl = req.session.twitter.profile_image_https;
		
		return newPerson(firstName, lastName, uuid, avatarUrl);
		
	}
	catch(err)
	{
		// Assume any error is due to a problem somewhere along the property path
		//  to the Twitter user ID.
		// Log the error and return NULL.
		console.log("(buildPersonObjectFromTwitterUser) Error building new person object from Twitter user data: " + err.message);
		return null;
	}
}

/**
 * Twitter User level authorization.  We put this middleware first
 *  in the stack so we can enforce the site level requirement that
 *  the user must be logged in on certain pages.
 *
 * NOTE: Remember to update this list of use statements if new
 *  routes/pages are added that require the user to be logged in to
 *  Twitter!
 *
 * @param {Object} req - Node.JS Express request object.
 * @param {Object} res - Node.JS Express result object.
 * @param {Object} next - Node.JS Express next object.
 */
function ensureTwitterUserLoggedIn(req, res, next) {
	try
	{
		if (getTwitterUserIdFromSession(req))
		{
			// The user is already authenticated.  Build a person object from their Twitter details
			//  and store it in the session variable for use by other code.
			let person = buildPersonObjectFromTwitterUser(req);
			
			if (!person)
				// Treat the inability to build a person object as an authorization failure.
				throw new Error('(ensureTwitterUserLoggedIn) Unable to build a Person object for the current user.');
			 
			// Store it.
			req.session.person = person;
			
			// Continue.
			next();
		}
		else {
			// We don't have a Twitter user ID.  Assume the current user needs to authenticate
			//  with Twitter.
			
			// Save the request path so we can return to it after the Twitter
			//  OAuth process completes in the twitter-post-authenticate
			//  route.
			req.session.redirect_to_original_request_path = req.path.trim();
			
			// Start the Twitter authorization process by redirecting to the
			//  twitter-pre-authenticate route.
			res.redirect('/auth/twitter');
		}
	}
	catch(err)
	{
        console.log('[ERROR: app.js] Error details  -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error during OAuth pre-authentication.');
	};
}

module.exports =
    {
    	ensureTwitterUserLoggedIn: ensureTwitterUserLoggedIn,
    	getTwitterUserIdFromSession: getTwitterUserIdFromSession,
    	newPerson: newPerson,
    	buildPersonObjectFromTwitterUser: buildPersonObjectFromTwitterUser
    };