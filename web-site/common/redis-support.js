/**
 * This file contains helper routines for interfacing with a Redis instance.
 */

const common_routines = require("./common-routines");
const misc_shared_lib = require('../public/javascripts/misc/misc-shared');
const redis = require("redis");
// const redisClient = require('redis').createClient(process.env.REDIS_URL || redis);
// const redisClient = require('redis').createClient(process.env.REDIS_PATH);
const redisClient = redis.createClient({
          host: process.env.REDIS_URL,
          port: process.env.REDIS_PORT,
          no_ready_check: true,
          auth_pass: process.env.REDIS_PASSWORD,
});

// Set up some event handlers for the Redis client.
redisClient.on("error", function (err) {
  console.error("Redis reported the following error: ", err);
});

redisClient.on("ready", function () {
  console.error("The Redis client is now ready.");
});

redisClient.on("end", function() {
  console.log("The Redis connection has closed.");
});

/**
 * This function retrieves a string value from the Redis store, using the given Redis
 *  hash name and the child key name.
 *
 * @param {String} hashName - A Redis key set name.
 * @param {String} fieldName - A child key name associated with the key set name.
 *
 * @return - The desired string value if found, NULL if not..
 */
function getString_From_Redis_promise(hashName, fieldName)
{
    var errPrefix = "(" + arguments.callee.name + ") ";

    if (misc_shared_lib.isEmptySafeString(hashName))
        throw new Error(errPrefix + "The Redis hash name parameter is empty.");

    if (misc_shared_lib.isEmptySafeString(fieldName))
        throw new Error(errPrefix + "The Redis field name parameter is empty.");

    return new Promise(
        function(resolve, reject)
        {
            try
            {
                // Return a promise that gets the desired value.
                return redisClient.hgetAsync(
                    hashName,
                    // The field name for this retrieval.
                    fieldName)
                    .then(function(strValueRetrieved)
                    {
                        if (misc_shared_lib.isEmptySafeString(strValueRetrieved))
                            // A string value was not found for the given Redis hash/field path.
                            // Resolve the Promise with a NULL response.
                            resolve(null);
                        else
                            // We have a string value.  Resolve the promise with it.
                            resolve(strValueRetrieved);
                    });
            }
            catch (err)
            {
                common_routines.myRejectPromise(errPrefix, err.message, err, resolve, reject);
            } // try}
        }
    );
}

/**
 * This function retrieves a string value from the Redis store, using the given Redis
 *  hash name and the field name.
 *
 * @param {String} hashName - A Redis hash name.
 * @param {String} fieldName - A field name associated with the hash name.
 * @param {string} strValueToStore - A string value.  Can be empty but not NULL
 *  or undefined.
 *
 * @return - {string} Returns the string value passed to us for storage.
 */
function setString_To_Redis_promise(hashName, fieldName, strValueToStore)
{
    var errPrefix = "(" + arguments.callee.name + ") ";

    if (misc_shared_lib.isEmptySafeString(hashName))
        throw new Error(errPrefix + "The Redis hash name parameter is empty.");

    if (misc_shared_lib.isEmptySafeString(fieldName))
        throw new Error(errPrefix + "The Redis field name parameter is empty.");

    if (misc_shared_lib.isEmptySafeString(strValueToStore))
        throw new Error(errPrefix + "The string value to store parameter is empty.");

    // Build a promise to set the field value for the given hash to Redis.
	return new Promise(function(resolve, reject)
   	{
		return redisClient.hsetAsync(
			hashName,
			// The field name for this retrieval.
			fieldName,
			// The value for the key-value pair.
			strValueToStore)
		.then(function(redisResponse)
		{
			// Success.  Resolve the promise with the string value given to us for storage.
			resolve(redisResponse);
		})
		.catch(function(err)
        {
        	// Convert the error to a promise rejection.
            common_routines.myRejectPromise(errPrefix, err.message, err, resolve, reject);
        });
    });
}

/**
 * This function retrieves a string value from the Redis store, using the given Redis
 *  hash name and the child key name.
 *
 * @param {String} hashName - A Redis key set name.
 *
 * @return - {Array|null} - An array of name/value pairs.
 */
function getAllStrings_From_Redis_promise(hashName)
{
    var errPrefix = "(" + arguments.callee.name + ") ";

    if (misc_shared_lib.isEmptySafeString(hashName))
        throw new Error(errPrefix + "The Redis hash name parameter is empty.");

    return new Promise(
        function(resolve, reject)
        {
            try
            {
                // Return a promise that gets ALL the desired values for the given hash name..
                return redisClient.hgetallAsync(
                    hashName)
                    .then(function(strValueRetrieved)
                    {
                        if (misc_shared_lib.isEmptySafeString(strValueRetrieved))
                            // A string value was not found for the given Redis hash/field path.
                            // Resolve the Promise with a NULL response.
                            resolve(null);
                        else
                            // We have a string value.  Resolve the promise with it.
                            resolve(strValueRetrieved);
                    });
            }
            catch (err)
            {
                common_routines.myRejectPromise(errPrefix, err.message, err, resolve, reject);
            } // try}
        }
    );
}


module.exports = {
    getString_From_Redis_promise: getString_From_Redis_promise,
    setString_To_Redis_promise: setString_To_Redis_promise,
    getAllStrings_From_Redis_promise: getAllStrings_From_Redis_promise
}