var express = require('express');
var router = express.Router();
var http_status_codes = require('http-status-codes');
// var Web3 = require('web3');
var common_routines = require('../common/common-routines');
var web3_support = require('../common/web3js-support');

/* GET home page. */
router.get('/', function(req, res, next) {

	try
	{
		/*
		let theWeb3Provider = web3_support.getWeb3Provider();
		let web3 = new Web3(new Web3.providers.HttpProvider(theWeb3Provider));
		
		// Remember, web3.eth.accounts is a function interface, not a property!  Use the accounts
		//  getter "getAccounts()" instead.
		web3.eth.getAccounts(function (error, result)
			{
				if (error)
				{
					throw new
						Error('Unable to request the account listing from the Ethereum network using the provider URL: '
						+ theWeb3Provider);
				}
				else
				{
					// The result is an array of accounts.
					let aryAccounts = result;
				
					if (common_routines.isArrayAndNotEmpty(aryAccounts))
					{
						console.log(aryAccounts);
					}
					else
					{
						console.log("The JSON RPC response to our accounts query was not an array: ");
						console.log(aryAccounts);
						console.log("Is the target Ethereum network running and are you using the correct URL and HTTP/HTTPS protocol? (e.g. - Ganache)");
					}
				}
			});
		*/
		
		res.render('index', { title: 'Express' });
	}
    catch (err)
    {
        console.log('[ERROR: index] Error rendering page -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error rendering page.');
        return;
    } // try/catch
});

module.exports = router;
