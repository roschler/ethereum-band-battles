// The code that handles popping up an edit-text mini-form and processing the OK/Cancel
//  button clicks.

function EditTextMiniForm (){
	// Template for a mini-form that edits a single text field.
	var g_EditTextTemplate = null;
	
	/**
	 * This method shows the edit text mini form and starts an editing session.
	 *
	 * @param {Number} top - The Y location to show the edit form at.
	 * @param {Number} left - The X location to show the edit form at.
	 * @param {String} prompt - The prompt to show on the form.
	 * @param funcOkButton - The function to fun if the OK button is clicked.
	 * @param funcCancelButton - The function to fun if the Cancel button is clicked.
	 * @param [existingValue] - If provided, this value will be shown in the edit box.
	 *
	 * NOTE: The OK button function will be passed the current value of the edit box
	 * 	and should return TRUE if the edit was successful, FALSE if it failed validation.
	 */
	this.show = function(top, left, prompt, funcOkButton, funcCancelButton, existingValue)
	{
		var errPrefix = '(EditTextMiniForm::show) ';
		
		if (goog.string.isEmptySafe(prompt))
			throw new Error(errPrefix + 'The prompt is empty.');
			
		var listEditTextDiv = $('#edit-text-div');
		
		if (listEditTextDiv.length == 0)
			throw new Error(errPrefix + "Unable to find the edit text div element.");
			
		setPositionOfDomElement('edit-text-div', top, left);

		// Set the prompt.
		$('#edit-text-prompt-span').html(prompt);
		
		// Remove any previous handlers.
		$('#edit-text-entry-ok-button').unbind('click');
		$('#edit-text-entry-ok-button').click(
			function() {
				var currentText = $('#edit-text-entry-textarea').val();
			
				var bEditSuccessful = funcOkButton(currentText);
				
				if (bEditSuccessful)
					// Hide the form.
					hideFloatingFormDiv("edit-text-div");
			});
			
			
		// Remove any previous handlers.
		$('#edit-text-entry-cancel-button').unbind('click');
		$('#edit-text-entry-cancel-button').click(
			function() {
				funcCancelButton();
				
				// Hide the form.
				hideFloatingFormDiv("edit-text-div");
			});
		
		
		if (goog.string.isEmptySafe(existingValue))
			// Clear the text editing area.
			$('#edit-text-entry-textarea').val('');
		else
			$('#edit-text-entry-textarea').val(existingValue);
		
		// Show the editing form.
		showFloatingFormDiv("edit-text-div");
	}
	
	/**
	 * This method shows the edit text mini form and starts an editing session,
	 * 	like the method above, except it gets the top and left values to display
	 * 	the edit form at from the provided DOM element.
	 *
	 * @param {String} - The ID of the DOM element to position the edit form over.
	 * @param {String} prompt - The prompt to show on the form.
	 * @param funcOkButton - The function to fun if the OK button is clicked.
	 * @param funcCancelButton - The function to fun if the Cancel button is clicked.
	 * @param [existingValue] - If provided, this value will be shown in the edit box.
	 *
	 * NOTE: The OK button function will be passed the current value of the edit box
	 * 	and should return TRUE if the edit was successful, FALSE if it failed validation.
	 */
	this.showOverElement = function(elementID, prompt, funcOkButton, funcCancelButton, existingValue)
	{
		var errPrefix = "(showOverElement) ";
		
		if (goog.string.isEmptySafe(elementID))
			throw new Error(errPrefix + "The element ID for the DOM element to show the edit form over is unassigned.");
			
		var elementList = $('#' + elementID);
		
		if (elementList.length = 0)
			throw new Error(errPrefix + "Unable to find any element with the element ID: " + elementID);
			
		var element = elementList[0];
		
		this.show(element.offsetTop, element.offsetLeft, prompt, funcOkButton, funcCancelButton, existingValue);
	}
};


