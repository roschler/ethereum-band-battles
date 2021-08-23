/**
 * This module contains code to service the PubNub chat and inter-app synchronization activities
 * 	using the PubNub set of services.
 */
 
const ETT_Tracker = require('../ethereum/ethereum-transaction-tracker').AppEventTrackerManager;
const youtubeSupport = require('../../../common/youtube-api-support').YouTubeSupport;
const _ = require('lodash');

const game_details_lib = require('../game-objects/game-details');
const user_details_lib = require('../game-objects/user-details');
const EnumValidateMeTypes = require('../misc/validation').EnumValidateMeTypes;
const isChatRoomUserObjInStateChange = require('../game-objects/user-details').isChatRoomUserObjInStateChange;

const reconstitute_lib = require('../game-objects/reconstituteGameObjects');

const PUBNUB_MESSAGE_TYPE_LINKED_VIDEO_SEEK = "linked_video_seek";

function setLinkedVideoSeekSlider(value) {
	$("#linked-seek-slider-input").slider('setValue', value, true);
	$("#linked-2-seek-slider-input").slider('setValue', value, true);
	// $("input.linked-seek-slider").slider('refresh');
}

/**
 * Common handling for rendering new PubNub messages as they are received.
 *
 * @param {Object} - A jQuery selector that selects a chat room message list.
 * @param {Object} messageEvent - A PubNub message event.
 */
function processMessageEvent(chatRoomMessagesListSelector, messageEvent)
{
	let errPrefix = '(processMessageEvent) ';
	
	if (typeof messageEvent == 'undefined' || messageEvent == null)
		throw new Error(errPrefix + 'The message event object is unassigned.');
	
	// Yes.  Reconstitute the original PlayerDetails object.  We don't update
	//  the form elements because at least for now, we want to centralize that
	//  activity within the STATUS events.
	let chatRoomUserObj = reconstitute_lib.recoverUserFromMessageEvent(messageEvent);
	
	// Add the user to the online user's list if not there already.
	global.appObject.listOnlineUsers.addOrReplaceUser(chatRoomUserObj);
	
	// Rebuild the screen elements.
	global.appObject.rebuildOnlineUsersList();
	
	// Add the chat message to the chat area.
	chatRoomMessagesListSelector.append(global.appObject.templateChatMessage(messageEvent));
	
	// Automatically scroll to the bottom.
	chatRoomMessagesListSelector.scrollTop = chatRoomMessagesListSelector.scrollHeight;
}

/**
 * Simple object to help create the winners report.
 *
 * @constructor
 */
function WinnerDetails()
{
	this.winningRoundDetails = null;
	this.userDetailsObj = null;
}

/**
 * This object manages PubNub related operations for the app.
 *
 * @constructor
 */
function PubnubSupportClientSide()
{
	// Save a reference to the PubNub object so that the code inside the addListener anonymous
	// 	functions can access it.
	const self = this;

	/** @property {Object} pubNubInstance - An instance of the PubNub library */
	this.pubnubInstance = null;
	/** @property {String} publishKey - The PubNub publish key for this app */
	this.publishKey = null;
	/** @property {String} subscribeKey - The PubNub subscribe key for this app */
	this.subscribeKey = null;
	/** @property {Array} onlineUsersListSelector - An array of the users participating in the game */
	this.onlineUsersListSelector = null;
	/** @property {Object} pubNubInstance - A jQuery selector that selects the chat room message area */
	this.chatRoomMessagesListSelector = null;
	
	/** @property {String} channelName - The name of the PubNub channel servicing this game */
	this.channelName = null;

	this.validateMe = function(funcCaller)
	{
		if (misc_shared_lib.isEmptySafeString(funcCaller))
			throw new Error('(validateMe) The parameter that should contain the name of the calling function is empty.');
	
		let errPrefix = '(' + funcCaller + ') ';
	
		// We must have a valid game ID.
		if (misc_shared_lib.isEmptySafeString(this.gameId))
			throw new Error(errPrefix + 'The game ID is empty.');
		
		// We must have a valid PubNub instance, publish key, and subscribe key, which
		//  should have been set for us by the server in the MAIN app configuration
		//  object and saved to our data members during the call to initializePubNub().
		if (misc_shared_lib.isEmptySafeString(this.publishKey))
			throw new Error(errPrefix + 'The PubNub publish key is empty.');
		
		if (misc_shared_lib.isEmptySafeString(this.subscribeKey))
			throw new Error(errPrefix + 'The PubNub subscribe key is empty.');
			
		if (typeof this.pubnubInstance == 'undefined' || this.pubnubInstance == null)
			throw new Error(errPrefix + 'The PubNub instance is unassigned.');
			
		// We must have a DOM element to add new people to as they enter the chat room.
		if (!isValidJQuerySelector(global.appObject.onlineUsersListSelector))
			throw new Error(errPrefix + 'The DOM element for adding new chat room participants is unassigned.');
			
		this.onlineUsersListSelector = global.appObject.onlineUsersListSelector;
		
		// We must have a DOM element to add new chat messages to as they appear.
		if (!isValidJQuerySelector(global.appObject.chatRoomMessagesListSelector))
			throw new Error(errPrefix + 'The DOM element for adding new chat room messages is unassigned.');
			
		this.chatRoomMessagesListSelector = global.appObject.chatRoomMessagesListSelector
		
		// We must have a non-empty PubNub user ID.
		if (misc_shared_lib.isEmptySafeString(this.currentUserId))
			throw new Error(errPrefix + 'The current PubNub user ID is empty.');
		
	}
	
	/**
	 * Process an app event result notification sent by the game server.
	 *
	 * @param {GameDetails} gameDetailsObj - The updated game details object received
	 * 	with the game master task request.  Note, since Ethereum transactions can
	 * 	take a long time to mine sometimes, it may not be a good idea to use it to
	 * 	update the app global game details object.
	 * 	
	 * @param {Object} pubnubMessageEvent - A PubNub message event that contains an
	 * 	 app event result object carrying a game master task notification.
	 */
	this.doGameMasterTask_app_event_result = function(gameDetailsObj, pubnubMessageEvent)
	{
		let errPrefix = '(doGameMasterTask_app_event_result) ';
		
		if (!gameDetailsObj)
			throw new Error(errPrefix + 'The game details object is unassigned.');
			
		// The PubNub message event's payload should be an app result object.
		let appEventResultObj = reconstitute_lib.recoverAppEventResultFromPubNubMessageEvent(pubnubMessageEvent);
			
		// Execute the promise, if any, designed to do further processing
		//  when an Ethereum transaction is mined.
		ETT_Tracker.callProcessAppEventResult_promise(appEventResultObj)
		.then(function(result) {
			console.log(errPrefix + 'The result of calling callProcessAppEventResult_promise() is: ');
			console.log(result);
		});
	}
	
	/**
	 * Execute the game task of playing the next round.
	 *
	 * @param {GameDetails} gameDetailsObj - The updated game details object received
	 * 	with the game master task request.
	 * @param {Object} messageEvent - A message event that contains a game master task.
	 */
	this.doGameMasterTask_play_next_round = function(gameDetailsObj, messageEvent)
	{
		let errPrefix = '(doGameMasterTask_play_next_round) ';
		
		if (!gameDetailsObj)
			throw new Error(errPrefix + 'The game details object is unassigned.');
		
		if (!messageEvent.message.payload.customDataObj.user_details_obj)
			throw new Error(errPrefix + 'The message event is missing a user details object.');
			
		// Make sure we have a valid video ID in the game details object field that tells us
		//  what video ID is currently playing.
		if (misc_shared_lib.isEmptySafeString(gameDetailsObj.videoIdCurrentlyPlaying))
			throw new Error(errPrefix + 'The message event is missing the video ID that we should play now.');
		
		// Load the video and play it.
		youtubeSupport.youtubePlayer.load(gameDetailsObj.videoIdCurrentlyPlaying, true);
		
		// Show the playing game form.
		global.appObject.showPlayingGameform();
	}
	
	/**
	 * Execute the tasks needed after a game completes.
	 *
	 * @param {GameDetails} gameDetailsObj - The updated game details object received
	 * 	with the game master task request.
	 * @param {Object} messageEvent - A message event that contains a game master task.
	 */
	this.doGameMasterTask_game_over = function (gameDetailsObj, messageEvent)
	{
		let errPrefix = '(doGameMasterTask_game_over) ';
		
		if (!gameDetailsObj)
			throw new Error(errPrefix + 'The game details object is unassigned.');
		
		// Stop video playback.
		// youtubeSupport.youtubePlayer.stop();
		
		// Build a simple scoreboard for now.
		if (gameDetailsObj.aryWinners)
		{
			let aryWinnerDetails = new Array();
			
			for (let ndx = 0; ndx < gameDetailsObj.aryWinners.length; ndx++)
			{
				// Get the winners screen name.
				let winner = new WinnerDetails();
				
				winner.winningRoundDetails = gameDetailsObj.aryWinners[ndx];
				winner.userDetailsObj = global.appObject.getUserById(gameDetailsObj.aryWinners[ndx].userId);
				
				aryWinnerDetails.push(winner);
			}
			
			if (aryWinnerDetails.length > 0)
			{
				// Sort by user.
				let sortedWinnerDetails = _.sortBy(aryWinnerDetails, 'userDetailsObj.screenName');

				
				// Build the HTML directly as a table.
				let tableHtml = "<table><tbody>";
				
				let lastUserId = "";
				_.forEach(sortedWinnerDetails, function (winnerDetails) {
					if (winnerDetails.winningRoundDetails.userId != lastUserId)
					{
						lastUserId = winnerDetails.winningRoundDetails.userId;
						
						tableHtml += "<tr class='winner_name'><td COLSPAN='2'>" + winnerDetails.userDetailsObj.screenName + "</td></tr>";
					}
					
					tableHtml += "<tr><td>" + "&nbsp;&nbsp;&nbsp;&nbsp;" + "</td><td class='winner_video_title'>" + winnerDetails.winningRoundDetails.videoTitle + "</td></tr>";
				})
				
				tableHtml += "</tbody></table>";
				
				$('#gmov-winners-report').html(tableHtml);
			}
		}
		else
		{
			throw new Error(errPrefix + 'The winners array is missing!');
		}
		
		// Iterate the winners array and add the videos found in the winners array
		//  to the video picker select box.
		if (!global.appObject.gameDetailsObj.aryWinners || global.appObject.gameDetailsObj.aryWinners.length < 1)
			console.error(errPrefix + 'The winners array is missing or empty.');
		else
		{
			let aryWinners = global.appObject.gameDetailsObj.aryWinners;
			
			for (let ndx = 0; ndx < aryWinners.length; ndx++)
			{
				$('#pick-video-select')
					.append(
						$('<option>',
						{ value: aryWinners[ndx].videoId, text: aryWinners[ndx].videoTitle }
				));
			}
			
			// Set the current selection in the drop-down box to match the video
			//  currently loaded in the YouTube player.
			let currentlyLoadedVideoId = youtubeSupport.youtubePlayer.videoId;
			
			if (!misc_shared_lib.isEmptySafeString(currentlyLoadedVideoId))
			{
				let jquerySelector = 'select option[value=' + currentlyLoadedVideoId + ']';
				$(jquerySelector).attr("selected", "selected");
			}
		}
		
		// Show the game over form.
		global.appObject.showFormEntryHostDiv('form-game-over-host-div');
	}
	
	/**
	 * This function processes a message from the game master (i.e. - the server).
	 *
	 * @param {Object} pubnubMessageEvent - A PubNub message event.
	 *
	 * NOTE: This function is not common/external like processMessageEvent()
	 * 	because we don't want to process game master events in the message
	 * 	history.
 	 */
	this.processGameMasterMessage = function(pubnubMessageEvent)
	{
		let errPrefix = '(processGameMasterMessage) ';
		
		if (typeof pubnubMessageEvent == 'undefined' || pubnubMessageEvent == null)
			throw new Error(errPrefix + 'The PubNub message event is unassigned');
			
		// Make sure it's from the game master.
		if (!game_details_lib.isSenderTheGameMaster(pubnubMessageEvent.message.sender))
			throw new Error(errPrefix + 'The PubNub message event is not from the game master.');

		let gameDetailsObjRaw = game_details_lib.extractGameDetailsObjFromPubNubMessageEvent(pubnubMessageEvent);
		
		let gameDetailsObj = reconstitute_lib.reconstituteGameDetailsObject(gameDetailsObjRaw);
		
		// Find out what the game master is telling us to do.
		let currentTask = game_details_lib.extractTaskFromPubNubMessageEvent(pubnubMessageEvent);
		
		// Sync our game details object to the one just sent to us.  Reconstitute it first.
		global.appObject.gameDetailsObj = gameDetailsObj;
		
		// Did we also receive a user details object?
		if (pubnubMessageEvent.message.payload.user_details_obj)
		{
			// Yes. Update the user's list with the user object sent to us and rebuild the online user's list
			//  to reflect any potential change in status for this user.
			let userDetailsObj = reconstitute_lib.reconstituteUserDetailsObject(pubnubMessageEvent.message.payload.user_details_obj);
			
			global.appObject.listOnlineUsers.addOrReplaceUser(userDetailsObj);
			global.appObject.rebuildOnlineUsersList();
		}
		
		// Execute the desired game master task.
		if (currentTask == game_details_lib.GameDetailsConstants.APP_EVENT_NEW_GAME_IS_READY)
		{
			// Take any follow-up processing we have scheduled for the new game creation
			//  event in the Ethereum transaction tracker.
			this.doGameMasterTask_app_event_result(gameDetailsObj, pubnubMessageEvent);
		}
		else if (currentTask == game_details_lib.GameDetailsConstants.APP_EVENT_NEW_PLAYER_ADDED)
		{
			// Take any follow-up processing we have scheduled for the new player added
			//  event in the Ethereum transaction tracker.
			this.doGameMasterTask_app_event_result(gameDetailsObj, pubnubMessageEvent);
		}
		else if (currentTask == game_details_lib.GameDetailsConstants.APP_EVENT_PLAY_NEXT_ROUND)
		{
			// Take the actions necessary to initiate a new round of game play.
			this.doGameMasterTask_play_next_round(gameDetailsObj, pubnubMessageEvent);
		}
		else if (currentTask == game_details_lib.GameDetailsConstants.APP_EVENT_GAME_OVER)
		{
			// Take the actions necessary now that the game is finished.
			this.doGameMasterTask_game_over(gameDetailsObj, pubnubMessageEvent);
		}
		// THIS BLOCK SHOULD NEVER HIT SINCE IT IS LEGACY CODE THAT HAS BEEN REMOVED!
		else if (currentTask == game_details_lib.GameDetailsConstants.TASK_ETHEREUM_TRANSACTION_RESULT)
		{
			// We have just received notification regarding one of the Ethereum
			//  transactions involved with the game.  Make the call that
			//  will execute any client side deferred event handling code we
			//  set up for the transaction that we are being notified about,
			//  if any such code exists.
			// this.doGameMasterTask_ethereum_transaction_result(gameDetailsObj, messageEvent);
			
			// WARNING: This is legacy code that should never be called anymore!
			throw new Error(errPrefix + 'The Ethereum transaction result game server message is no longer valid.');
		}
		else
			throw new Error(errPrefix + 'Invalid task request from game master.  Task name: ' + currentTask);
	}
	
	/**
	 * Initializes this object using the given game ID, which is used to
	 * 	create a unique PubNub channel for chatting and synchronizing operations
	 * 	between players (clients).
	 *
 	 * @param {Object} gameDetailsObj - The game details object for this game.  The
 	 * 	channel name that will be used for the PubNub channel created to
 	 * 	service the game is found in this object in the channelName field.
 	 * 	That field must have a valid value.
 	 * @param {Object} currentUserObj - The user object that represents the current user.
	 */
	this.initializePubNub = function(gameDetailsObj, currentUserObj)
	{
		let errPrefix = '(initializePubNub) ';
		
		// Make sure the PubNub library was included.
		if (typeof PubNub == 'undefined' || PubNub == null)
			throw new Error(errPrefix + 'The PubNub library could not be found.');
		
		if (typeof gameDetailsObj == 'undefined' || gameDetailsObj == null)
			throw new Error(errPrefix + 'The details object parameter is unassigned.');
			
		this.gameId = gameDetailsObj.id;
		
		if (typeof currentUserObj == 'undefined' || currentUserObj == null)
			throw new Error(errPrefix + 'The currentUserObj parameter is unassigned.');
			
		this.currentUserId = currentUserObj.uuid;
		
		if (misc_shared_lib.isEmptySafeString(gameDetailsObj.channelName))
			throw new Error(errPrefix + 'The channel name in the game details object is empty.');
		
		this.channelName = gameDetailsObj.channelName;
		
		// We must have a valid PubNub publish and subscribe key.
		if (misc_shared_lib.isEmptySafeString(g_AppConfig.pubnub_publish_key))
			throw new Error(errPrefix + 'The PubNub publish key is empty.');
		
		this.publishKey = g_AppConfig.pubnub_publish_key;
		
		if (misc_shared_lib.isEmptySafeString(g_AppConfig.pubnub_subscribe_key))
			throw new Error(errPrefix + 'The PubNub subscribe key is empty.');
		
		this.subscribeKey = g_AppConfig.pubnub_subscribe_key;
		
		// Initialize the PubNub library.
		this.pubnubInstance = new PubNub({
			publish_key: this.publishKey,
			subscribe_key: this.subscribeKey,
			uuid: this.currentUserId
		});
		
		// Validate our parameters.
		this.validateMe('initializePubNub');
		
		// Subscribe to the game channel for PubNub activities.
		this.pubnubInstance.subscribe({
			channels: [self.channelName],
			withPresence: true,
		});
		
		// Get a list of everyone in the chat room already for the game channel.
		this.pubnubInstance.hereNow(
			{
				channels: [self.channelName],
				includeState: true
			},
			function (status, response) {
				if (status.error)
				{
					console.error(errPrefix + 'Error during PubNub hereNow call: ');
					console.log(status);
				}
				else
				{
					// The list of users is found in a property off of the channels object
					//  which should have a property that is our channel name.
					let channel = response.channels[self.channelName];
					
					if (!channel)
						throw new Error(
							"Unable to find our channel in the hereNow response.  Our channel name is: "
							+ self.channelName);
							
					let aryUsers = channel.occupants;
					
					for (let ndx = 0; ndx < aryUsers.length; ndx++)
					{
						if (aryUsers[ndx].state)
						{
							let userDetailsObj = aryUsers[ndx].state.user_details_object;
							
							// Add the user to the online user's list if not there already.
							global.appObject.listOnlineUsers.addOrReplaceUser(userDetailsObj);
							
							// Rebuild the screen elements.
							global.appObject.rebuildOnlineUsersList();
						}
						else
						{
							console.log("Encountered an occupant without a 'state' field.: ");
							console.log(aryUsers[ndx]);
						}
					}
				
					// Add all the users found to online users list.
					console.log(response);
				}
			}
		);

		
		// Add a listener for this channel.
		this.pubnubInstance.addListener({
			message: function(messageEvent) {
				let errPrefix = '(initializePubNub::messageEvent) ';

				console.log(errPrefix + 'MESSAGE EVENT: ');
				console.log(messageEvent);
				
				// Messages from the game master are not chat messages and are to
				//  be handled differently.
				if (messageEvent.message.hasOwnProperty('sender') && game_details_lib.isSenderTheGameMaster(messageEvent.message.sender)) {
					// --------------------------- PROCESS GAME SERVER MESSAGES ---------------------
					self.processGameMasterMessage(messageEvent);
				}
				else
				{
					// Is it a linked video seek message?
					if (messageEvent.message.type && messageEvent.message.type == PUBNUB_MESSAGE_TYPE_LINKED_VIDEO_SEEK)
					{
						// --------------------------- PROCESS LINKED VIDEO SEEK MESSAGE -------------------
						
						
						// This is a request from one of the users to have everyone move their
						//  current video position to the position they selected using the
						//  linked video seek slider.
						let videoId = messageEvent.message.payload.video_id;
						let offsetInSecs = messageEvent.message.payload.offset_in_seconds;
						let percentSlider = messageEvent.message.payload.percent_slider;
						
						if (youtubeSupport.youtubePlayer.videoId != videoId)
							youtubeSupport.youtubePlayer.load(videoId, false);
							
						youtubeSupport.youtubePlayer.seek(offsetInSecs);
						youtubeSupport.youtubePlayer.play();
						
						// Move the slider to match the position.
						setLinkedVideoSeekSlider(percentSlider);
					}
					else
					{
						// Is it a message event with one of our chat room user
						//  objects in the state variable?
						
						// TODO: This is not defined!
						if (user_details_lib.isUserDetailsObjInMessageEvent(messageEvent.message))
						{
								// Normal chat message, process it.
								processMessageEvent(self.chatRoomMessagesListSelector, messageEvent.message);
						}
					}
				}

				/*
				// This code was left here to show the possible messageEvent fields.
				
				let channelName = messageEvent.channel; // The channel for which the message belongs
				let channelGroup = messageEvent.subscription; // The channel group or wildcard subscription match (if exists)
				let pubTT = messageEvent.timetoken; // Publish timetoken
				let msg = messageEvent.message; // The Payload
				*/
			},
			presence: function(presenceEvent) {
				let errPrefix = '(initializePubNub::messageEvent) ';

				console.log(errPrefix + 'PRESENCE EVENT: ');
				console.log(presenceEvent);
				
				// Is it a state change presence event with one of our chat room user
				//  objects in the state variable?
				if (user_details_lib.isChatRoomUserObjInStateChange(presenceEvent))
				{
					// Yes.  Update our user's list and online user screen element. First,
					//  reconstitute the original PlayerDetails object.
					let chatRoomUserObj = reconstitute_lib.recoverUserFromStatusEvent(presenceEvent);
					
					// Add/replace it in our users list.
					global.appObject.listOnlineUsers.addOrReplaceUser(chatRoomUserObj);
					
					// Rebuild the screen elements.
					global.appObject.rebuildOnlineUsersList();
				}
				
				/*
				// This code was left here to show the possible presenceEvent fields.
				
				let action = presenceEvent.action; // Can be join, leave, state-change or timeout
				let channelName = presenceEvent.channel; // The channel for which the message belongs
				let occupancy = presenceEvent.occupancy; // No. of users connected with the channel
				let state = presenceEvent.state; // User State
				let channelGroup = presenceEvent.subscription; //  The channel group or wildcard subscription match (if exists)
				let publishTime = presenceEvent.timestamp; // Publish timetoken
				let timetoken = presenceEvent.timetoken;  // Current timetoken
				let uuid = presenceEvent.uuid; // UUIDs of users who are connected with the channel
				*/
			},
			status: function(statusEvent) {
				let errPrefix = '(initializePubNub::messageEvent) ';
				console.log(errPrefix + 'STATUS EVENT: ');
				console.log(statusEvent);
				
				// If the status event's category field indicates our successfulConfirmation at connecting to the
				//	channel, use it to broadcast the screen name and whatever other data
				//  we want to associate with our user.
				if (statusEvent.category == "PNConnectedCategory")
				{
					let newState = {
						user_details_object: currentUserObj
					};
					
					// Use the set state API to broadcast the state change across the channel
					//  so all other clients can update their user lists.
					self.pubnubInstance.setState({
							channels: [self.channelName],
							state: newState
						},
						function(status)
						{
							if (status.error)
							{
								console.error(errPrefix + 'Error during PubNub setState call: ');
								console.log(status);
							}
						}
					);
					
					// Get the most recent messages for this user.
					self.pubnubInstance.history(
						{
							channel: self.channelName,
							reverse: true
						},
						function (status, response) {
							// Render all the messages received except those received from the server as
							//  gamesmaster.
							//
							// TODO: Add support for handling historical gamesmaster messages later.
							for (let ndx = 0; ndx < response.messages.length; ndx++)
							{
								if (!game_details_lib.isSenderTheGameMaster(response.messages[ndx].entry.sender))
									processMessageEvent(self.chatRoomMessagesListSelector, response.messages[ndx].entry);
							}
						
							console.log(response.messages);
						}
					);
				}
				else if (statusEvent.category == 'state-change')
				{
					console.log(errPrefix + 'State change occurred.');
					console.log(statusEvent.state);
				}
			}
		});
	}
	
	/** This method publishes the given chat message on behalf of the current user.
	 *
	 * @param {String} messageText - The message to send.  If it is empty, this
	 * 	call will be ignored.
	 */
	this.publishChatMessage = function(messageText)
	{
		let errPrefix = '(publishChatMessage) ';
		
		if (misc_shared_lib.isEmptySafeString(messageText))
		{
			console.warn(errPrefix + 'Ignoring publish chat message call because the message text is empty.');
			return;
		}
		
		// Publish the chat message using the current user as the sender. Pass a reference to
		// 	the current user's details object.
		self.pubnubInstance.publish(
			{
				message: {
					user_details_object: global.appObject.getCurrentUserObj(),
					messageText: messageText
				},
				channel: self.channelName,
				// Extra meta-data for the message.
				meta: {
				}
			},
			function (status, response)
			{
				if (status.error)
					console.error(errPrefix + status.error);
				else
					console.log(errPrefix + "Message Published w/ timetoken", response.timetoken);
			});
	}
	
	/** This method publishes a linked video sync message.
	 *
	 * @param {string} videoId - The video ID other players should sync to.
	 * @param {number} offsetInSecs - The location in the video in seconds
	 * 	that the player should seek to.
	 * @param {number} percentSlider - The value the linked video seek slider should
	 * 	be set to.
	 */
	this.publishLinkedVideoSeekMessage = function(videoId, offsetInSecs, percentSlider)
	{
		let errPrefix = '(publishChatMessage) ';
		
		if (misc_shared_lib.isEmptySafeString(videoId))
		{
			console.error(errPrefix + 'Ignoring linked video seek message call because the video ID parameter is empty.');
			return;
		}
		
		if (offsetInSecs < 0)
		{
			console.error(errPrefix + 'Ignoring linked video seek message call because the seek offset in seconds is negative.');
			return;
		}
		
		if (percentSlider < 0 || percentSlider > 100)
		{
			logger.error(errPrefix + 'Ignoring linked video seek message call because the slider percentage value is not between 0 and 100: ' + percentSlider);
			return;
		}
		
		let payloadObj = {
			video_id: videoId,
			offset_in_seconds: offsetInSecs,
			percent_slider: percentSlider
		}
		
		// Publish the chat message using the current user as the sender. Pass a reference to
		// 	the current user's details object.
		self.pubnubInstance.publish(
			{
				message: {
					type: PUBNUB_MESSAGE_TYPE_LINKED_VIDEO_SEEK,
					user_details_object: global.appObject.getCurrentUserObj(),
					payload: payloadObj
				},
				channel: self.channelName,
				// Extra meta-data for the message.
				meta: {
				}
			},
			function (status, response)
			{
				if (status.error)
					console.error(errPrefix + status.error);
				else
					console.log(errPrefix + "Linked video seek message Published w/ timetoken", response.timetoken);
			});
	}

	/**
	 * Call this function from the window.onbeforeunload() event to make sure we unsubscribe from any PubNub
	 * 	channels before leaving the web page.
	 */
	this.leavePage = function ()
	{
		if (typeof pubnub != "undefined" && pubnub != null)
		{
			pubnub.unsubscribe({
				channel: self.channelName,
			});
		}
	}
	
	
	// Return a copy of this object to support fluent chaining.
	return self;
}

module.exports  = {
	PubnubSupportClientSide: PubnubSupportClientSide
}