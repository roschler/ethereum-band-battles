/**
 * This file contains the code related to the videos participating in a game.
 *
 */

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No. The needed routines should be in the global namespace.
}
else
{
	// Yes.  Need to require some modules.
	// var misc_shared_lib = new (require('../misc/misc-shared')).lib_misc();
}

/** Handy object to hold some constants we use when interacting with user objects. */
var VideoDetailsConstants = new function()
{
	/** Various user states. */
	this.VIDEO_STATE_QUEUED = 'queued';
	this.VIDEO_STATE_PLAYING = 'playing';
	this.VIDEO_STATE_COMPLETED = 'completed';
}

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	// No, make it part of the global Javascript namespace.
	window.video_details_lib = {};
    window.video_details_lib.VideoDetailsConstants = VideoDetailsConstants;
}
else
{
	// Yes.  Export the code so it works with require().
    module.exports =
		{
			VideoDetailsConstants: VideoDetailsConstants
		};
}
