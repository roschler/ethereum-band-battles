/**
 * This module initializes and exports a Winston logging logger.
 */

// Using Winston for custom logging like that of Ethereum transactions.
// const winston = require('winston');
// Winston daily rotating log file.
const {createLogger, format, config } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

/*
const ethCustomLevels = {
  levels: {
    info: 0,
    success: 1,
    fail: 2,
    timeout: 3
  },
  colors: {
    info: 'white',
    success: 'green',
    fail: 'red',
    timeout: 'yellow'
  }
};
*/

const winstonTransport =
	// Separate transport for Ethereum transaction logging messages.
	new DailyRotateFile({
		filename: './logs/winston/ethtrans-%DATE%.json',
		datePattern: 'YYYY-MM-DD',
		level: 'verbose'
		// TODO: Enable zipped archives once things stabilize.  For now we want
		//  easy viewing of the log files.
		// zippedArchive: true
	})
	
// Event that fires when the log file rotates.  Currently not used.
/*
transport.on('rotate', function(oldFilename, newFilename) {
    // do something here
});
*/

/**
 * A Winston logger object for use by all code.
 */
const winstonLogger = createLogger({
	format: format.combine(
		format.timestamp(),
		format.json()
	),
    levels: config.npm.levels,
	transports: [ winstonTransport ]
});

function testLoggingLevelsToConsole() {
	Object.entries(config.npm.levels).forEach(([level, index]) => {
  		console.log(level + `Logging to "${level}" with a numeric index of ${index}`)
	});
}

module.exports = {
	winstonLogger: winstonLogger
}