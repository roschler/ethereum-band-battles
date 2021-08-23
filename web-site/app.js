/**
 * Initialize Node.js server app.
 */

// Get the server side configuration elements.
const server_config = require("./common/config-settings-server-side");

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
// const logger = require('morgan');

// Using Express session storage for user specific data, especially OAuth related items.
const express_session = require('express-session');

const submit_choice_api = require('./routes/api/submit-choice-api');

const bodyParser = require('body-parser');

const indexRouter = require('./routes/index');
// const users_router = require('./routes/users');
const config_settings_client_side = require('./routes/config-settings-client-side');

const search_for_videos = require('./routes/search-for-videos');

const search_youtube_api = require('./routes/search-youtube-api');

const broadcast_message_to_game = require('./routes/broadcast-message-to-game');

const create_game = require('./routes/api/create-game');

const set_ethereum_public_address_api = require('./routes/api/set-ethereum-public-address-api');

const wait_for_game_creation_api = require('./routes/api/wait-for-game-creation-api');

const prepare_for_game_payment_api = require('./routes/api/prepare-for-game-payment-api');

const prepare_for_enter_game_api = require('./routes/api/prepare-for-enter-game-api');

const wait_for_entry_fee_confirmation_api = require('./routes/api/wait-for-entry-fee-confirmation-api');

const start_game_api = require('./routes/api/start-game-api');

const get_game_object_api = require('./routes/api/get-game-object-api');

const test_1 = require('./routes/test/test-1');

const test_signing_transaction_1 = require('./routes/test/test-signing-transaction-1');

const test_simple_youtube_api = require('./routes/test/test-simple-youtube-api');

const http = require('http');

const common_routines = require('./common/common-routines');

// We add this reference solely to trigger the creation of the EtherBandBattles payment manager
//  singleton object.  Since that code is not brought into play by a require statement by one
//  of the routes like the EthereumTransactionManager, we have to do this to instantiate the
//	singleton instance of the payment manager.
const ethereum_ebb_payment_manager = require('../web-site/ethereum/ethereum-ebb-payment-manager');
// console.log('EtherBandBattles payment manager is turned off.  See App.js');

const app = express();

// Scribe.JS logging.
const scribe = require('scribe-js')();

// We promisify the request and redis client libraries to get access to the
//  postAsync() method.
var Promise = require('bluebird');
var redis = require('redis');

Promise.promisifyAll(require("request"));
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

app.use(scribe.express.logger()); //Log each request

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

/**
 * Visit this page for detailed explanations of the Express session object
 * 	initialization options.
 *
 *	https://www.npmjs.com/package/express-session
 *
 * NOTE: We are using the default memory store for storing session data.
*/
app.use(express_session(
	{
		// Cookie path.
		path: '/',
		// The secret string used to sign the session ID cookie.  It should
		//  be a unique string that does not contain or encode any sensitive
		//  data.  A random string is best.
		secret: server_config.g_ServerConfig.express_session_secret,
		// Do not resave the session if it has not changed, otherwise race
		//	conditions (not due to multi-threading), between async requests
		//	made by the client could cause unwanted overwrites resulting
		//  in the loss of session object changes.  (See Express session
		//  docs for details).
		resave: false,
		/*
		Forces a session that is "uninitialized" to be saved to the store.
		A session is uninitialized when it is new but not modified. Choosing
		false is useful for implementing login sessions, reducing server
		storage usage, or complying with laws that require permission before
		setting a cookie. Choosing false will also help with race conditions
		where a client makes multiple parallel requests without a session.
		 */
		saveUninitialized: false,
		/*
		From the Express session document regarding the "secure" option:
		
		Please note that secure: TRUE is the recommended option. However,
		it requires an https-enabled website, i.e., HTTPS is necessary
		for secure cookies. If secure is set, and you access your site
		over HTTP, the cookie will not be set. If you have your node.js
		behind a proxy and are using secure: true, you need to set
		"trust proxy" in express.
		 */
		secure: true,
		// Do not allow client side modification.
		httpOnly: true,
		/*
		From the Express session document regarding the "secure" option:
		
		Specifies the number (in milliseconds) to use when calculating the
		Expires Set-Cookie attribute. This is done by taking the current
		server time and adding maxAge milliseconds to the value to calculate
		an Expires datetime. By default, no maximum age is set.
		 */
		maxAge: null
	}));

// -------------------- BEGIN: Winston logging -----------------------

// --------------- Winston logger quick test.

/*
const winstonLogger = require('./common/winston-logging-module').winstonLogger;

winstonLogger.log("info", 'NEW - Winston logging active for Ethereum transactions.');
winstonLogger.log("warn", 'NEW - Winston logging: fail.');
winstonLogger.log("info", 'NEW - Winston logging: success.');
winstonLogger.log("error", 'NEW - Winston logging: timeout.');
*/

// -------------------- END : Winston logging -----------------------

// app.use(logger('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cookieParser());

// ------------------------- STATIC CONTENT DIRECTORIES --------------

console.log('__dirname = ' + __dirname);

app.use(express.static(path.join(__dirname, 'public')));

/**
  Add the PubNub ChatEngine distribution directories to the static files source directory list.
   Remember, these are mount points so any files served up from these directories are not
   preceded with a directory themselves.  The only exception is any files located in
   sub-directories of the mount points and in that case you prepend only the sub-directories
   that are children of the mount point directory to the desired filename when accessing
   the needed files from a client side view.

*/
// The MAIN ChatEngine Javascript files.
app.use(express.static(path.join(__dirname, 'node_modules/chat-engine/dist')));

// Jquery plugins.
app.use(express.static(path.join(__dirname, 'jquery-plugins')));

app.use('/', indexRouter);
// app.use('/users', usersRouter);

app.use('/', config_settings_client_side);

app.use('/', search_for_videos);
app.use('/', search_youtube_api);
app.use('/', create_game);
app.use('/', set_ethereum_public_address_api);
app.use('/', wait_for_game_creation_api);
app.use('/', prepare_for_game_payment_api);
app.use('/', prepare_for_enter_game_api);
app.use('/', wait_for_entry_fee_confirmation_api);
app.use('/', start_game_api);
app.use('/', get_game_object_api);
app.use('/', test_1);
app.use('/', submit_choice_api);
app.use('/', broadcast_message_to_game);
app.use('/', test_signing_transaction_1);
app.use('/', test_simple_youtube_api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};
	
	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

// Global unhandled Promise rejection handler.
process.on("unhandledRejection", function(reason, promise) {
    // Log it.
    console.warn(
        "Unhandled promise rejection.  Reason: " + reason
        + "\n"
        + "Promise: " + promise
        + "\n");

    // If it's an http.IncomingMessage object, show the error message
    //  that object carries.
    if (reason instanceof http.IncomingMessage)
    {
        if (!common_routines.isEmptyString(reason.body.error))
            console.warn("Reason is an IncomingMessage object.  Error message: " + reason.body.error);
    }
    // See if the object has a message field.
    else if (!common_routines.isEmptyString(reason.message))
    {
        console.warn("Reason contains the error message: " + reason.message);
    }

    // Show the stack trace if we have one.
    if (reason != null && reason.stack != null)
    {
        console.warn(
            +"Reason stack: "
            + reason.stack);
    }
});

module.exports = app;
