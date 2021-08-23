/**
 * Helpful support code for using the YouTube API.
 */
 
const common_routines = require("./common-routines");
const youtube_search = require('youtube-api-v3-search');
const YouTubeSimpleApiClass = require('simple-youtube-api');

let youTubeApiKey = process.env.YOUTUBE_API_KEY;
if (!youTubeApiKey)
	// We must be running on the browser.  The YouTube API key should be in the
	//  global App config variable.
	youTubeApiKey = g_AppConfig.youtube_api_key;

const youtubeSimpleApi = new YouTubeSimpleApiClass(youTubeApiKey);
const misc_shared_lib = require ('../public/javascripts/misc/misc-shared');


function YouTubeChannelAndVideoDetails() {
	/** @property {Object|null} video - A YouTube video object */
	this.video =  null;
	
	/** @property {Object|null} channel - A YouTube channel object */
	this.channel = null;
	
	/** @property {string|null} extractedEthereumPublicAddress - The Ethereum public address, if one
	 *	 was found in the channel description.
	 */
	this.extractedEthereumPublicAddress = null;
}

/**
 * This function gets our YouTube API key from the environment.  It throws an
 * 	error if it does not exist.
 *
 * @return {String}
 */
function getYouTubeApiKey()
{
	try
	{
		var errPrefix = '(getYouTubeApiKey) ';
		
		let youTubeApiKey = process.env.YOUTUBE_API_KEY;
	
		if (common_routines.isEmptyString(youTubeApiKey))
			throw new Error(errPrefix + 'Unable to find the YouTube API key in the process environment.  Was it set properly?');
			
		return youTubeApiKey
	}
	catch(err)
	{
		// Treat errors as a failure to provide a YouTube API key.
		throw new Error(errPrefix + 'Unable to find the YouTube API key in the process environment.  Was it set properly?');
	}
}

/**
 * This function returns a promise that does a typical YouTube video search
 * 	using the given search query.
 *
 * @param {String} searchQuery - The search query.
 */
function doYouTubeSearch_promise(searchQuery)
{
	// Return a promise that execute a YouTube search. NOT passing callback as the 3rd argument
	//	returns a promise that executes the YouTube search.
	/**
	 * Searching YouTube.
	 * @param {string} $YOUTUBE_KEY youtube api-key
	 * @param {Object} $options search parameters.
	 * @return {Promise} The result of the search .
	 */
	let youTubeApiKey = getYouTubeApiKey();
	
	console.log('Executing YouTube API search with key: ' + youTubeApiKey);
	
	const searchOptions =
		{
			maxResults: 25,
			part: 'snippet',
			q: searchQuery,
			type: 'video'
		}
		
	return youtube_search(youTubeApiKey, searchOptions);
}

// -------------------------- YOUTUBE SIMPLE API ---------------------------

function getVideoById_promise(videoId)
{
	let errPrefix = '(getVideoById_promise) ';
	
	if (common_routines.isEmptyString(videoId))
		throw new Error(errPrefix + 'The video ID is empty.');
		
	return youtubeSimpleApi.getVideoByID(videoId);
}

function getChannelById_promise(channelId)
{
	let errPrefix = '(getChannelById_promise) ';
	
	if (common_routines.isEmptyString(channelId))
		throw new Error(errPrefix + 'The channel ID is empty.');
		
	return youtubeSimpleApi.getChannelByID(channelId);
}

/**
 * This function returns a promise that gets the channel description for the
 * 	channel that owns the given video ID.
 *
 * @param {string} videoId - The ID of the video whose channel description we
 * 	are interested in.
 *
 * @return {Promise<string|null>} - The promise resolves to a string that contains
 * 	the channel's description or NULL if none could be found.
 */
function getChannelDescriptionByVideoId_promise(videoId)
{
	let errPrefix = '(getChannelDescriptionByVideoId) ';
	
	if (common_routines.isEmptyString(videoId))
		throw new Error(errPrefix + 'The video ID is empty.');
	
	return new Promise(function(resolve, reject) {
	 	let channelId = null;
	
		getVideoById_promise(videoId)
		.then(youtubeVideo => {
			if (!youtubeVideo)
				throw new Error(errPrefix + 'Unable to find a video for video ID: ' + videoId);
				
			channelId = youtubeVideo.channel.id;
			
			return getChannelById_promise(channelId);
		})
		.then(youtubeChannel => {
			if (!youtubeChannel)
				throw new Error(errPrefix + 'Unable to find a chanel with channel id: ' + channelId);
				
			resolve(youtubeChannel.raw.snippet.description);
		})
		.catch(err => {
			// Reject the promise with the error.
			reject(err);
		});
	});
}

/**
 * This function returns a promise that gets the channel description for the
 * 	channel that owns the given video ID and extracts an Ethereum public
 * 	address from it if the description contains one of our EtherBandBattles
 * 	balance-check links we create for bands to put in their channel
 * 	description.
 *
 * @param {string} videoId - The ID of a video a band owns.
 *
 * @return {Promise<string|null>} - The promise resolves to a string that contains
 * 	the Ethereum public address or NULL if none could be found.
 */
function getBandPublicAddressByVideoId_promise(videoId)
{
	let errPrefix = '(getBandPublicAddressByVideoId_promise) ';
	
	if (common_routines.isEmptyString(videoId))
		throw new Error(errPrefix + 'The video ID is empty.');
	
	return new Promise(function(resolve, reject) {
		getChannelDescriptionByVideoId_promise(videoId)
		.then(channelDescription => {
			let bandAddr = extractBandPublicAddrFromChannelDesc(channelDescription);
			resolve(bandAddr);
		})
		.catch(err => {
			// Reject the promise with the error.
			reject(err);
		});
	});
}

/**
 * This function will extract the band's Ethereum public address from their channel description
 * 	if that description has one of our custom balance checking links in it.
 *
 * @param {string} channelDescription - The description of the channel that hosts a band's
 * 	videos.
 *
 * @return {string|null} - Returns the Ethereum address embedded in the link if found, otherwise
 * 	NULL is returned.
 */
function extractBandPublicAddrFromChannelDesc(channelDescription) {
	let errPrefix = '(extractBandPublicAddrFromChannelDesc) ';
	
	if (!misc_shared_lib.isEmptySafeString(channelDescription))
	{
		// Is our EtherBandBattles link that carries their public address embedded
		//  in the channel's description?
		//
		//	EXAMPLE: 'https://EtherBandBattles.com/?band_addr=0x1888183747383847&check_balance=1'
		let aryElements = channelDescription.match(/https\:\/\/EtherBandBattles\.com\/\?band_addr\=(.*?)\&check_balance=1/i);
		
		// Array element 1 should have the capture group contents.
		if (aryElements && (aryElements.length > 1) && !misc_shared_lib.isEmptySafeString(aryElements[1]))
		{
			let bandAddr = aryElements[1];
			return bandAddr;
		}
	}
	
	return null;
}

/**
 * Give a YouTube video ID, get the video object for the ID and the channel object for the
 * 	channel that owns that video.  Also, extract the Ethereum public address we find in the
 * 	Channel description, if one exists.
 *
 * @param {string} videoId - The desired video ID.
 *
 * @return {Promise<YouTubeChannelAndVideoDetails>}
 */
function getVideoAndChannelDetails_promise(videoId) {
	let errPrefix = '(getVideoAndChannelDetails_promise) ';
	
	if (common_routines.isEmptyString(videoId))
		throw new Error(errPrefix + 'The video ID is empty.');
	
	return new Promise(function(resolve, reject) {
		try {
			let channelId = null;
			let ytChannelAndVideoDetails = new YouTubeChannelAndVideoDetails();
		
			getVideoById_promise(videoId)
			.then(youtubeVideo => {
				if (!youtubeVideo)
					throw new Error(errPrefix + 'Unable to find a video for video ID: ' + videoId);
					
				ytChannelAndVideoDetails.video = youtubeVideo;
				
				channelId = youtubeVideo.channel.id;
				
				return getChannelById_promise(channelId);
			})
			.then(youtubeChannel => {
				if (!youtubeChannel)
					throw new Error(errPrefix + 'Unable to find a chanel with channel id: ' + channelId);
					
				ytChannelAndVideoDetails.channel = youtubeChannel;
				let channelDesc = youtubeChannel.raw.snippet.description;
				ytChannelAndVideoDetails.extractedEthereumPublicAddress = extractBandPublicAddrFromChannelDesc(channelDesc);
				
				// Resolve the promise with the object we just built.
				resolve(ytChannelAndVideoDetails);
			})
			.catch(err => {
				// Reject the promise with the error.
				reject(err);
			});
		} catch(err) {
			reject(err);
		}
	});
}

// ------------------- ADDITIONAL PLAYER SUPPORT ------------------

/**
 * This file contains routines helpful to all pages that have a YouTube player on them.
 */
var YouTubeSupport = (function() {
	var self = this;
	
	this.testVideoId = 'lkRbB8GgQjI';

	/** @property {Boolean} - Set this to TRUE to have the video stop playing the instant
	 * 	it starts.  It will be reset to FALSE after that occurs.
	 */
	this.autoStopForVideoData = false;
	
	/** @property {Object} youTubePlayer - A YouTubePlayer instance. */
	this.youtubePlayer = null;
	
	/**
	 * Make the playback LED visible.
	 */
	this.showPlaybackLed = function()
	{
		$('#playback-led-img').removeClass('hidden');
	}
	
	/**
	 * Make the playback LED invisible.
	 */
	this.hidePlaybackLed = function()
	{
		$('#playback-led-img').addClass('hidden');
	}
	
	/**
	 * Toggle the visibility of the playback LED.
	 */
	this.togglePlaybackLed = function()
	{
		$('#playback-led-img').toggleClass('hidden');
	}
	
	/**
	 * This function marks all sortable list elements marked as sortable
	 * 	that are not disabled, actually sortable.  It should be called
	 * 	every time the bookmark list is modified.
	 */
	this.updateSortableStatus = function()
	{
		// Specify the elements to be sortable.
		$('.sortable').sortable({
			items: ':not(.disabled)'
		});
	}
	
	/**
	 * Initialize the HTML5 Jquery sortable/draggable plugin.
	 */
	this.initializeHtml5Sortable = function()
	{
		// Activate the plugin on a Bootstrap table and customize the drag and drop handler.
		$('table tbody').sortable({
			handle: 'span'
		});
		
		// Activate the plugin on bookmark list groups and customize the dragging placeholder
		//  using the placeholderClass option.
		$('.list-group-sortable').sortable({
			placeholderClass: 'list-group-item'
		});
		
		// Initial activation of the sortable flag on all items in the sortable list
		//  that are not marked as disabled.
		this.updateSortableStatus();
		
		// Create the event handler that triggers when the user has finished a drag-and-drop
		//  operation ("sortupdate" event).  Triggered when the user has stopped sorting and
		//  the position of the related DOM elements has finished changing.
		//
		/*
		SOURCE: https://npm.taobao.org/package/html5sortable
		
		This event is triggered when the user starts sorting and the DOM position has not yet changed.
		
		e.detail.item - {HTMLElement} dragged element
		
		Origin Container Data
		e.detail.origin.index - {Integer} Index of the element within Sortable Items Only
		e.detail.origin.elementIndex - {Integer} Index of the element in all elements in the Sortable Container
		e.detail.origin.container - {HTMLElement} Sortable Container that element was moved out of (or copied from)
		*/
		$('.sortable').bind(
			'sortupdate',
			function(e)
			{
				// Unused.
				console.log("Drag and drop operation completed (sorting completed).");
			}
		);
	}
	
	/** @property {Object|null} - This property works with the timeupdate handler to
	 * 	resolve promises waiting on a video's data to become available after play
	 * 	is started and auto-stopped.  Assign this property the resolve() method
	 * 	of your promise and that method will be called when auto-stop occurs with
	 * 	the video details as the sole parameter to your function.
	 *
	 * 	NOTE: This method is automatically wiped clean after being called to avoid
	 * 		accidental triggering later on.  You'll have to re-assign it as needed!
	 *
	 * @private
	 */
	this.callMeWhenVideoDetailsAreAvailable = null;
	
	/**
	 * This function checks to see if the video player has details available for the currently loaded
	 * 	video.
	 *
	 * @return {boolean} - Returns TRUE if the YouTube player has details data for the currently loaded
	 * 	video, FALSE if not.
	 */
	this.isVideoDataAvailable = function()
	{
		// If the video title is available we assume that the rest of the data is available too.
		if (misc_shared_lib.isEmptySafeString(self.youtubePlayer._player.getVideoData().title))
			return false;
			
		return true;
	}
	
	
	/**
	 * Initialize the YouTube player instance.
	 *
	 */
	this.initializeYouTubePlayerAPI = function()
	{
		console.log("Initializing YouTube player.");
		
		// yt-player.
		var opts = {};
		
		opts.width = 640;
		opts.height = 360;
		
		
		self.youtubePlayer = new YouTubePlayer('#youtube-player', opts);
		
		// Load a test video.
		// self.youtubePlayer.load(this.testVideoId);
		
		// This event fires when a video starts playing.
		self.youtubePlayer.on('playing', () => {
			console.log(self.youtubePlayer.getDuration());
		})
		
		// Event handler for when the YouTube video reports that the desired video is unplayable.
		self.youtubePlayer.on('unplayable',
				(videoId) => {
					console.error("Unable to play video with the ID: " + videoId);
				}
			);
			
		// This event fires each time the YouTube player reports a change in the video's location.
		self.youtubePlayer.on(
			'timeupdate',
			(currentSeconds) =>
			{
				var strTime = misc_shared_lib.secondsToHoursMinutesSecondsString(currentSeconds);

				// Update the current location span.
				$('#current-video-location-span').text(strTime);
				
				// If the auto-stop flag is set and we have video details data available,
				//  stop playback now.
				if (self.autoStopForVideoData && self.isVideoDataAvailable())
				{
					self.youtubePlayer.stop();
					
					// Clear the flag.
					self.autoStopForVideoData = false;
					
					// If there's a promise waiting on us, resolve it now with the video details.
					if (self.callMeWhenVideoDetailsAreAvailable)
					{
						self.callMeWhenVideoDetailsAreAvailable(self.youtubePlayer._player.getVideoData());
						// Clear the resolve callback so it doesn't fire accidentally.
						self.callMeWhenVideoDetailsAreAvailable = null;
					}
					return;
				}

				// Flash the playback LED.
				self.togglePlaybackLed();
			});
	}
	
	/**
	 * This function returns a promise that gets the video details.  If the video
	 * 	details are not available yet, the video will be played for an instant in
	 * 	order to have them loaded in the YouTube player.
	 *
	 * @return {Promise} - Returns a promise that gets the video details.
	 */
	this.getCurrentVideoDetails_promise = function(videoId)
	{
		var errPrefix = '(getCurrentVideoTitle) ';
		
		return new Promise(
			function(resolve, reject)
			{
				if (!self.youtubePlayer)
					reject(errPrefix + 'The YouTube iframe API is not available yet.');
			
				if (misc_shared_lib.isEmptySafeString(videoId))
					reject(errPrefix + 'The video ID is empty.');
				
				var bIsPlaybackRequired = false;
			
				// Is the video ID already in the player?
				if (self.youtubePlayer.videoId != videoId)
				{
					// No.  Load the desired video and set the flag to auto-play and auto-stop.
					self.youtubePlayer.load(videoId, false);
					bIsPlaybackRequired = true;
				}
				else
				{
					// The video ID already assigned to the player.  Do we have the video
					// 	details? If we can't find the video title, we assume the details
					// 	are not available yet and playback is required.
					var videoTitle = self.youtubePlayer._player.getVideoData().title;
					bIsPlaybackRequired = misc_shared_lib.isEmptySafeString(videoTitle);
				}
		
				if (bIsPlaybackRequired)
				{
					// Playback is required.  Assign our resolve method to the property
					//  the function that services the YouTube player "timeupdate" event
					//	so our promise resolves once playback has begun and been
					//	auto-stopped.
					self.callMeWhenVideoDetailsAreAvailable = resolve;
					
					// Set the auto-stop flag and play the video.
					self.autoStopForVideoData = true;
					self.youtubePlayer.play();
				}
				else
				{
					// No playback required.  Resolve the promise immediately.
					resolve(self.youtubePlayer._player.getVideoData());
				}
			});
	}
	
	return self;
})();

module.exports = {
	extractBandPublicAddrFromChannelDesc: extractBandPublicAddrFromChannelDesc,
	getBandPublicAddressByVideoId_promise: getBandPublicAddressByVideoId_promise,
	getVideoById_promise: getVideoById_promise,
	getChannelById_promise: getChannelById_promise,
	getChannelDescriptionByVideoId_promise: getChannelDescriptionByVideoId_promise,
	getVideoAndChannelDetails_promise: getVideoAndChannelDetails_promise,
	getYouTubeApiKey: getYouTubeApiKey,
	doYouTubeSearch_promise: doYouTubeSearch_promise,
	YouTubeChannelAndVideoDetails: YouTubeChannelAndVideoDetails,
	YouTubeSupport: YouTubeSupport
}