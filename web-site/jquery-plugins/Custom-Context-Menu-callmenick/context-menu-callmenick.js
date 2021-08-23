/**
 	License:
 	
	Licensed under the MIT license, http://www.opensource.org/licenses/mit-license.php

	Copyright 2014, Call Me Nick

	http://callmenick.com
	
	GitHub repo:
	
	https://github.com/callmenick/Custom-Context-Menu
	
	Minor modifications by Robert Oschler to make the entire library callable with
	a custom context menu DOM element ID and the class name for elements that should
	trigger the context menu if right-clicked on.
 */
 
/**
 * This function initializes the context menu code.
 *
 * @param {String} contextMenuId - The DOM element ID for the element to host the context menu.
 * @param {String} classNameForContextMenuTargets - The class name for elements that should
 *  trigger the context menu if right clicked on.
 */
function initializeContextMenu(contextMenuId, classNameForContextMenuTargets, menuItemListenerFunc) {
  
  "use strict";

  // ROS: Set the default menu item listener to call when an item on the
  //  context menu is clicked.
  var callMenuItemListener = defaultMenuItemListener;
  
  // ROS: Make sure we have a valid context menu ID.
  var errPrefix = '(initializeContextMenu) ';
  
  if (typeof contextMenuId == 'undefined' || contextMenuId == null)
  {
  	console.error(errPrefix + 'The context menu ID is invalid.');
  	return;
  }
  
  // Make sure there's a DOM element with that ID.
  var checkContextMenuPresence = document.querySelector(contextMenuId);
  if (typeof checkContextMenuPresence == 'undefined' || checkContextMenuPresence == null)
  {
  	console.error(errPrefix + 'Unable to find a context menu using the ID: ' + contextMenuId + '.');
  	return;
  }

  // ROS: Make sure we have a valid context menu item class name.
  if (typeof classNameForContextMenuTargets == 'undefined' || classNameForContextMenuTargets == null)
  {
  	console.error(errPrefix + 'The class name for menu items is invalid.');
  	return;
  }
  
  // Make sure there's at least one DOM element with the class given by the class name for menu items parameter.
  var checkClassNameForContextMenuTargets = document.querySelector(classNameForContextMenuTargets);
  if (typeof checkClassNameForContextMenuTargets == 'undefined' || checkClassNameForContextMenuTargets == null)
  {
  	console.warn(
  	  errPrefix +
  	  'Unable to find any DOM elements with the menu items class name: ' + classNameForContextMenuTargets + '.'
  	  + '\n This is normal if this is a brand new playlist and no bookmarks have been added yet.');
  }
  
  // If a menu item listener function has been provided, set it as the active
  //  menu item listener function.
  if (typeof menuItemListenerFunc != 'undefined' && menuItemListenerFunc != null)
    callMenuItemListener = menuItemListenerFunc;
    
  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  //
  // H E L P E R    F U N C T I O N S
  //
  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Function to check if we clicked inside an element with a particular class
   * name.
   *
   * @param {Object} e The event
   * @param {String} className The class name to check against
   * @return {Boolean}
   */
  function clickInsideElement( e, className ) {
    var el = e.srcElement || e.target;
    
    if ( el.classList.contains(className) ) {
      return el;
    } else {
      while ( el = el.parentNode ) {
        if ( el.classList && el.classList.contains(className) ) {
          return el;
        }
      }
    }

    return false;
  }

  /**
   * Get's exact position of event.
   *
   * @param {Object} e The event passed in
   * @return {Object} Returns the x and y position
   */
  function getPosition(e) {
    var posx = 0;
    var posy = 0;

    if (!e) var e = window.event;
    
    if (e.pageX || e.pageY) {
      posx = e.pageX;
      posy = e.pageY;
    } else if (e.clientX || e.clientY) {
      posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }

    return {
      x: posx,
      y: posy
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  //
  // C O R E    F U N C T I O N S
  //
  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  
  /**
   * Variables.
   */
  var contextMenuClassName = "context-menu";
  
  var contextMenuItemClassName = "context-menu__item";
  var contextMenuLinkClassName = "context-menu__link";
  var contextMenuActive = "context-menu--active";

  var taskItemClassName = classNameForContextMenuTargets;
  // This is the element that was right-clicked on that caused the popup menu to pop up.
  var elementSourceForContextMenuPopup;

  var clickCoords;
  var clickCoordsX;
  var clickCoordsY;

  var menu = document.querySelector(contextMenuId);
  
  var menuItems = menu.querySelectorAll(".context-menu__item");
  var menuState = 0;
  var menuWidth;
  var menuHeight;
  var menuPosition;
  var menuPositionX;
  var menuPositionY;

  var windowWidth;
  var windowHeight;

  /**
   * Initialise our application's code.
   */
  function init() {
    contextListener();
    clickListener();
    keyupListener();
    resizeListener();
  }

  /**
   * Listens for contextmenu events.
   */
  function contextListener() {
    document.addEventListener( "contextmenu", function(e) {
      var cleanTaskItemClassName = taskItemClassName;
      
      if (typeof cleanTaskItemClassName == 'string' && cleanTaskItemClassName != null && cleanTaskItemClassName.length > 0)
	  {
	  	// Make sure we don't have a period preceding the task item class name or
	  	//  the clickInsideElement() test will fail.
	  	if (cleanTaskItemClassName.charAt(0) == '.')
	  		cleanTaskItemClassName = cleanTaskItemClassName.substr(1, cleanTaskItemClassName.length - 1);
	  }
    
    
      elementSourceForContextMenuPopup = clickInsideElement( e, cleanTaskItemClassName );

      if ( elementSourceForContextMenuPopup ) {
        e.preventDefault();
        toggleMenuOn();
        positionMenu(e);
      } else {
        elementSourceForContextMenuPopup = null;
        toggleMenuOff();
      }
    });
  }

  /**
   * Listens for click events.
   */
  function clickListener() {
    document.addEventListener( "click", function(e) {
      var clickeElIsLink = clickInsideElement( e, contextMenuLinkClassName );

      if ( clickeElIsLink ) {
        e.preventDefault();
        // ROS: Made menu item listen function configurable and added an extra parameter
        //  to menu item listener callback function to provide the DOM element that was
        //  clicked on that triggered the context menu to popup.  Also changed it so
        //  that if FALSE or anything but exactly TRUE is returned, the menu hides itself.
        // If TRUE is returned it does not (it persists).
        var bIsMenuPersistent
          = callMenuItemListener( elementSourceForContextMenuPopup, clickeElIsLink );
          
        if (typeof bIsMenuPersistent == 'undefined' || bIsMenuPersistent == null || bIsMenuPersistent !== true)
          toggleMenuOff();
      } else {
        var button = e.which || e.button;
        if ( button === 1 ) {
          toggleMenuOff();
        }
      }
    });
  }

  /**
   * Listens for keyup events.
   */
  function keyupListener() {
    window.onkeyup = function(e) {
      if ( e.keyCode === 27 ) {
        toggleMenuOff();
      }
    }
  }

  /**
   * Window resize event listener
   */
  function resizeListener() {
    window.onresize = function(e) {
      toggleMenuOff();
    };
  }

  /**
   * Turns the custom context menu on.
   */
  function toggleMenuOn() {
    if ( menuState !== 1 ) {
      menuState = 1;
      menu.classList.add( contextMenuActive );
    }
  }

  /**
   * Turns the custom context menu off.
   */
  function toggleMenuOff() {
    if ( menuState !== 0 ) {
      menuState = 0;
      menu.classList.remove( contextMenuActive );
    }
  }

  /**
   * Positions the menu properly.
   *
   * @param {Object} e The event
   */
  function positionMenu(e) {
    clickCoords = getPosition(e);
    clickCoordsX = clickCoords.x;
    clickCoordsY = clickCoords.y;

    menuWidth = menu.offsetWidth + 4;
    menuHeight = menu.offsetHeight + 4;

    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;

    if ( (windowWidth - clickCoordsX) < menuWidth ) {
      menu.style.left = windowWidth - menuWidth + "px";
    } else {
      menu.style.left = clickCoordsX + "px";
    }

    if ( (windowHeight - clickCoordsY) < menuHeight ) {
      menu.style.top = windowHeight - menuHeight + "px";
    } else {
      menu.style.top = clickCoordsY + "px";
    }
  }

  /**
   * Default menu item listener function that simpley dumps some informatio on clicked item.
   *
   * @param {HTMLElement} link The link that was clicked
   */
  function defaultMenuItemListener( elementSourceForContextMenuPopup, contextMenuItemClicked ) {
    console.log(
      "ID of element right-clicked on = "
      + elementSourceForContextMenuPopup.getAttribute("id")
      + "Clicked Context menu ID - "
      + contextMenuItemClicked.getAttribute("data-uuid")
      + ", action - "
      + contextMenuItemClicked.getAttribute("data-action"));
      
    toggleMenuOff();
  }
  
  

  /**
   * Run the app.
   */
  init();
}

// })();