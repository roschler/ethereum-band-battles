/**
 * This module should be included in all routes that need access to the SERVER SIDE
 *  global application configuration settings.  It also includes some helper functions
 *  to prepare various derivative objects based on the server side settings.
 */
var common_routines = require('./common-routines');

// OAuth support.
// Twitter OAuth support.
// var OAuth = require('oauth').OAuth;

// Twitter API support
// var Twitter = require('twitter');

var g_ServerConfig = null;
var g_OAuth = null;

// ---------------- INITIALIZE --------------------
try
{
	if (g_ServerConfig != null)
		// We've already initialized.
		return;
		
	g_ServerConfig = new Object();
	
	// ------------------------ TWITTER CONFIGURATION --------------
	
	g_ServerConfig.twitter = new Object();
	

	// ------------------------ SESSION SECRET ------------------------------
	
	// The "secret" string for the Express session object.
	let expressSessionSecret = process.env.EXPRESS_SESSION_SECRET;
	
	if (common_routines.isEmptyString(expressSessionSecret))
		throw new Error("The Express session secret string was not found in the system environment");
	
	g_ServerConfig.express_session_secret = expressSessionSecret.trim();
}
catch (err)
{
	console.log('[ERROR: config-settings-server-side.js] Error during server side configuration initialization -> ' + err.message);
	throw err;
} // try/catch


module.exports =
    {
        g_ServerConfig: g_ServerConfig,
        g_Oauth: g_OAuth,
    };

