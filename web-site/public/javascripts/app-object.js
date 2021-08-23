/**
 * This file contains the application level object that stores various
 * 	items required across the application.
 */

const PubnubSupportClientSide = require('./pubnub/pubnub-support-client-side').PubnubSupportClientSide;
const GameDetails = require('../../public/javascripts/game-objects/game-details').GameDetails;
const GameDetailsConstants = require('../../public/javascripts/game-objects/game-details').GameDetailsConstants;
const UserDetails = require('../../public/javascripts/game-objects/user-details').UserDetails;
const UserList = require('../../public/javascripts/game-objects/user-details').UserList;

/**
 * Create an object of this during the document ready event.  This object holds
 * 	the elements that are shared across the code comprising this application.
 *
 * @constructor
 */
function AppObject()
{
	var errPrefix = '(AppObject::constructor) ';
	
	// Create an ID for this instance of the app.
	this.id = 'app_' + misc_shared_lib.getSimplifiedUuid();
	
	// ----------------- Handlebar templates --------------
	
	/** @property {Object} templateOnlineUser - The template for rendering an online user
	 * 	in the PubNub chat room.
	 */
	this.templateOnlineUser = Handlebars.compile($("#online-user-template").html());
	
	/** @property {Object} templateChatMessage - The template for rendering a chat message
	 * 	in the PubNub chat room.
	 */
	this.templateChatMessage = Handlebars.compile($("#chat-message-template").html());
	
	
	/** @property {Object} onlineUsersListSelector - The jQuery selector that selects the
	 * 	online users list.
	 */
	this.onlineUsersListSelector = $('#' + 'online-users-list-ul');
	
	// Validate the online users list selector.
	if (!isValidJQuerySelector(this.onlineUsersListSelector))
		throw new Error(errPrefix + ' The online users list selector is invalid.');
	
	/** @property {Object} chatRoomMessagesListSelector - The jQuery selector that selects the
	 * 	chat room messages list.
	 */
	this.chatRoomMessagesListSelector = $('#' + 'chat-message-list-ul');
	
	// Validate the chat room messages list selector.
	if (!isValidJQuerySelector(this.chatRoomMessagesListSelector))
		throw new Error(errPrefix + ' The chat messages list selector is invalid.');
		
	// Create a chat room users list object.
	/** @property {UserList} listOnlineUsers - A user list object. */
	this.listOnlineUsers = new UserList();
	
	// Create the PubNub object and initialize it.
	/** @property {PubnubSupportClientSide} pubnubClient - A PubNub client side support object. */
	this.pubnubClient = new PubnubSupportClientSide();
	
	/** @property {Array} aryFormEntryDivs_quadrant_lower_left - An array of all the DIV IDs for the swappable mini-forms
	 *		that reside in Quadrant 4  */
	// Build an array of all the form entry DIV IDs.
	this.aryFormEntryDivs_quadrant_lower_left = new Array();
	
	this.aryFormEntryDivs_quadrant_lower_left.push('form-waiting-for-players-host-div');
	this.aryFormEntryDivs_quadrant_lower_left.push('form-game-creation-host-div');
	this.aryFormEntryDivs_quadrant_lower_left.push('form-guest-entry-host-div');
	this.aryFormEntryDivs_quadrant_lower_left.push('form-playing-game-host-div');
	this.aryFormEntryDivs_quadrant_lower_left.push('form-game-over-host-div');
	this.aryFormEntryDivs_quadrant_lower_left.push('form-metamask-not-found-host-div');
	
	/// This will be filled in when the MAIN page first loads.
	/** @property {String} currentUserId - The user ID of the current user. */
	this.currentUserId = "";
	
	// This will be filled in by doCreateGame() if the server reports
	//  a successful game creation.
	/** @property {GameDetails} gameDetailsObj - A game details object to service the current game. */
	this.gameDetailsObj = null;
	
	// We can't initialize PubNub until the user creates the game since
	//  we need to know who the game host is and what the game ID is.
	// 	Make sure the PubNub initialization method is called once the
	// 	game has been created and we know the game ID.
	
	this.clearOnlineUsersList = function()
	{
		this.listOnlineUsers = new UserList();
		
		this.rebuildOnlineUsersList();
	}
	
	/**
	 * This function wipes the online users list screen elements clean and
	 * 	rebuilds it from the current contents of the online users list.
	 */
	this.rebuildOnlineUsersList = function()
	{
		// Clear out the current list html.
		this.onlineUsersListSelector.html('');
		
		this.listOnlineUsers.applyFunction(
			(onlineUser, ndx, ary) =>
			{
				// For some reason we have to use prepend() instead of append()
				//  or the onlineUsers appear in reverse order.
				// TODO: Ask about this on Stack Overflow.
				this.onlineUsersListSelector.prepend(this.templateOnlineUser(onlineUser));
			}
		);
	}
	
	/**
	 * This function shows the form entry DIV element with the given ID and hides
	 * 	all the others.
	 *
	 * @param divId - The ID of the DIV to show.
	 */
	this.showFormEntryHostDiv = function(divId)
	{
		var errPrefix = '(showFormEntryHostDiv) ';
		
		if (misc_shared_lib.isEmptySafeString(divId))
			throw new Error(errPrefix + 'The DIV element ID is empty.');
			
		var bDivFound = false;
			
		// Show the desired form entry DIV and hide all the others.
		for(var ndx = 0; ndx < this.aryFormEntryDivs_quadrant_lower_left.length; ndx++)
		{
			if (this.aryFormEntryDivs_quadrant_lower_left[ndx] == divId)
			{
				// Show this DIV.
				$('#' + this.aryFormEntryDivs_quadrant_lower_left[ndx]).show();
				bDivFound = true;
			}
			else
				// Hide this DIV.
				$('#' + this.aryFormEntryDivs_quadrant_lower_left[ndx]).hide();
		}
		
		// If the DIV was not found, print a warning to the console.
		if (!bDivFound)
			console.warn(errPrefix + "Could not find a form entry DIV with the ID: " + divId);
		
	}
	
	/**
	 * This function updates all the form elements that are tied to game details field values.
	 */
	this.updateGameDetailsElements = function()
	{
		if (this.gameDetailsObj)
		{
			$('.show-game-status').text(this.gameDetailsObj.statusText);
			$('.show-game-title').text(this.gameDetailsObj.titleForGame);
			$('.show-game-entry-fee').text(this.gameDetailsObj.entryFee);
			$('.show-game-band-donation-percentage').text(this.gameDetailsObj.bandDonationPercentage + ' ' + '%');
			
			var url = new URL(document.location.href);
			
			url.searchParams.set(AuxGameConstants.URL_ARG_ENTER_GAME, 'true');
			url.searchParams.set(GameDetailsConstants.PROP_NAME_GAME_ID, this.gameDetailsObj.id);
			url.searchParams.set(GameDetailsConstants.PROP_NAME_CHANNEL_NAME, this.gameDetailsObj.channelName);

			var gameInviteLink = url.href;
			$('.game-invite-link').val(gameInviteLink);
			
			// Build an extra link that auto-loads a different video than the one we have.  Used
			//  for easy testing.
			url.searchParams.set(AuxGameConstants.URL_ARG_VIDEO_ID, 'QNJL6nfu__Q');
			var gameAutoInviteLink = url.href;
			
			
			// The Auto-invite link for testing purposes.
			$('#game-auto-invite-link-textarea').val(gameAutoInviteLink);
		}
	}
	
	/**
	 * This function returns TRUE if the given user ID is the ID of the current user,
	 * 	FALSE if not.
	 *
	 * @param {String} userId - The user ID to evaluate.
	 *
	 * @return {boolean} Returns TRUE if it's the ID of the current user, FALSE if not.
	 */
	this.isOurCurrentUserId = function(userId)
	{
		var errPrefix = '(isOurCurrentUserId) ';
	
		if (misc_shared_lib.isEmptySafeString(userId))
			throw new Error(errPrefix + 'The user ID parameter is empty.');
		
		return (this.currentUserId == userId);
	}
	
	/**
	 * This method returns a reference to the current user object, contained in our
	 * 	list of participating users.
	 *
	 * @return {UserDetails} - Returns the user details object for the current user.
 	 */
	this.getCurrentUserObj = function()
	{
		var errPrefix = '*getCurrentUserObj) ';
		var currentUserObj = this.listOnlineUsers.findUserObj(this.currentUserId);
		
		if (!currentUserObj)
			throw new Error(errPrefix +'Invalid current user object or ID.');
			
		return currentUserObj;
	}
	
	/**
	 * Given a user ID, return the user details object for that user.
	 *
	 * @param {string} userId - The ID of the desired user.
	 *
	 * @return {UserDetails}
	 */
	this.getUserById = function(userId)
	{
		return this.listOnlineUsers.findUserObj(userId);
	}
	
	/**
	 * Set the page title.
	 *
	 * @param {String} title - The new page title.
	 */
	this.setPageTitle = function (title)
	{
		var errPrefix = '(setPageTitle) ';
		if (misc_shared_lib.isEmptySafeString(title))
			throw new Error(errPrefix + 'The title is empty.');
			
		$('.page-title').text(title);
	}
	
	/**
	 * Switches to the playing-game form and updates the page title.
	 */
	this.showPlayingGameform = function ()
	{
		let pageTitle =
			this.getCurrentUserObj().screenName.toUpperCase() + ', is now playing EtherBandBattles!';
		
		this.showFormEntryHostDiv('form-playing-game-host-div');
		this.setPageTitle(pageTitle);
		
		// Enable the mark location and submit choice buttons in case they
		//  were disabled in a previous round of play.
		
		// Disable the mark location and submit choice buttons until the next
		//  round of play.
		enableButton($('.choose-loc'));
	}
}

module.exports = {
	AppObject: AppObject
}