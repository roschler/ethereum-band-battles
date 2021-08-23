
// Javascript page support code for the search for videos view.

var g_VideoSearchResultTemplate = null;

// The DOM element ID of the search query input box.
var g_SearchQueryInputId = 'search-query-input';

// The URL to get to the playlist builder page with a particular
//  video loaded.
var g_CreateGameUrl = './create-game';

// If TRUE, then we need to carry over the "enter_game" URL argument
//  when we return to the page that navigated to us.  If FALSE, then
//  we don't.
var g_IsEnterGameFlagSet = false;

// If the enter game flag is set, then this is where we will put the
//  game ID passed to us.
var g_GameId = null;

/**
 * Given an array of video search results from a YouTube video search, rende the
 * 	results into the area reserved for those.
 *
 * @param {Array} aryVideoSearchResults - An array of YouTube video search results.
 */
function insertSearchResultsPageContent(videoSearchResultsObj)
{
	var errPrefix = '(insertSearchResultsPageContent) ';

	if (typeof videoSearchResultsObj == 'undefined' || videoSearchResultsObj == null)
		throw new Error(errPrefix + 'The video search results parameter is unassigned.');
		
	var selector = $('#search-results-ul');
	
	// Clear the current search results.
	selector.html('');
		
	goog.array.forEachRight(
		// Iterate the items array and add each search result to the page's unordered list for those.
		videoSearchResultsObj.items,
		function(searchResult, ndx, ary)
		{
			// Add it to the search results element.
			selector.append(g_VideoSearchResultTemplate(searchResult));
		});
}

/**
 * Saves the given video search results to the user's cookie storage.
 *
 * @param videoSearchResults - The video search results to save.
 */
function saveCurrentSearchResults(videoSearchResults)
{
    setCookieValue('last_search_results_content', JSON.stringify(videoSearchResults));
}

/**
 * Saves the given video search query to the user's cookie storage.
 *
 * @param {String} query - The video search query to save.
 */
function saveCurrentSearchQuery(query)
{
    setCookieValue('last_search_query', JSON.stringify(query));
}

/**
 * Retrieves the most recent video search query from the user's cookie storage.
 *
 * @return {String}
 */
function getLastSearchQuery()
{
    return getCookieValue('last_search_query');
}

/**
 * Retrieves the most recent video search results from the user's cookie storage.
 *
 * @return {String}
 */
function getLastSearchResults()
{
    return getCookieValue('last_search_results_content');
}

/**
 * Go back to the create game page and tell it to auto-load the video with the ID given.
 *
 * @param {String} videoId - The desired video ID.
 *
 */
function backToCreateGamePage(videoId)
{
	var errPrefix = '(goToPlaylistBuilder) ';
	
	if (goog.string.isEmptySafe(videoId))
	{
		console.error(errPrefix + 'The video ID parameter is empty.');
		return;
	}
	
	var currentUrl = new URL(document.location.href).origin;
	var retUrl = new URL(g_CreateGameUrl, currentUrl);
	
	retUrl.searchParams.set(AuxGameConstants.URL_ARG_VIDEO_ID, videoId);
	
	// If we came from the enter game page instead of the game creation page
	//  then carry over the enter game flag.
	if (g_IsEnterGameFlagSet)
	{
		retUrl.searchParams.set(AuxGameConstants.URL_ARG_ENTER_GAME, "true");
		retUrl.searchParams.set(AuxGameConstants.URL_ARG_GAME_ID, g_GameId);
	}
	
	window.location.href = retUrl.href;
}

/**
 * Execute a search using the current content of the search query edit box.
 */
function doSearch()
{
	let errPrefix = '(doSearch) ';
	
	// NOTE: For some reason, trying to step through the jQuery calls in
	//  this function either in WebStorm or directly with Chrome's internal debugger
	//  fails (the call never *seems* to return).  Fortunately, the code does work
	//  and if you set breakpoints AFTER the jQuery calls you can
	//  continue to trace.
	try
	{
		let searchQuery = $('#' + g_SearchQueryInputId).val();

		if (goog.string.isEmptySafe(searchQuery))
		{
			alert('The search query can not be blank.  Please enter some keywords that describe the videos you would like to find.');
			return;
		}
		
		// Save the query the user entered.
		saveCurrentSearchQuery(searchQuery);

		let requestObj =
			{
				search_query: searchQuery
			};

		let jqxhr = $.post('search-youtube-api',
						   requestObj,
						   function ()
						   {
							   console.log(errPrefix + 'success');
						   })
			.done(function (data)
				  {
					  console.log(errPrefix + 'first successfulConfirmation');

					  // Update the page.
					  insertSearchResultsPageContent(data);

					  // Store the search results received for later restoration.
					  saveCurrentSearchResults(data);
					  
				  })
			.fail(function ()
				  {
					  console.error(errPrefix + 'error');
				  })
			.always(function ()
					{
						console.log(errPrefix + 'finished');
					});


	}
	catch (err)
	{
		let errMsg = errPrefix + 'Error executing video search -> ' + err.message;
		console.error(errMsg);
	}

}

// ---------------------- DOCUMENT READY FUNCTION ------------------------
// JQuery document ready handler.
$(document).ready(function (){
	// Initialize the app.
	
	// If we have the "enter_game" URL argument set, then we must
	//  pass that back to the create-game page when a user clicks
	//  a video.
	var urlArgs = getUrlArguments();
	
	if (urlArgs.hasOwnProperty(AuxGameConstants.URL_ARG_ENTER_GAME))
	{
		g_IsEnterGameFlagSet = misc_shared_lib.isTrueOrStrTrue(urlArgs[AuxGameConstants.URL_ARG_ENTER_GAME]);

		// If the enter game flag is set then we must have a game ID.
		if (!urlArgs[AuxGameConstants.URL_ARG_GAME_ID])
		{
			alert('The game ID is missing.  Please contact the system administrator.');
			return;
		}
			
		g_GameId = urlArgs[AuxGameConstants.URL_ARG_GAME_ID];
	}
		
	// Compile the handlebars templates we use for later use.
	g_VideoSearchResultTemplate = Handlebars.compile($("#video-search-result-template").html());
	
	// If we have a search query in the cookie store, restore it to the search query edit box.
	let lastSearchQuery = getLastSearchQuery();
	
	if (!goog.string.isEmptySafe(lastSearchQuery))
		$('#' + g_SearchQueryInputId).val(lastSearchQuery);
	
	
	// Set up event handlers.
	$('#search-button-btn').click(
		function(e)
		{
			doSearch();
		});

});