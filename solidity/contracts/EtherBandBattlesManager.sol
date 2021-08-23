// SPDX-License-Identifier: MIT

// pragma solidity ^0.4.21;
// pragma solidity ^0.5.0;
pragma solidity ^0.8.1;

// Use these when reverting to non-proxied contract for trace debugging with Truffle console.
// import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
// import "../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

import "./open-zeppelin/access/Ownable.sol";
import "./open-zeppelin/math/SafeMath.sol";
import "./open-zeppelin/utils/Pausable.sol";

// Use these in production to take advantage of Open Zeppelin's upgradeable contract technology.
//import "../node_modules/openzeppelin-zos/contracts/math/SafeMath.sol";
//import "../node_modules/openzeppelin-zos/contracts/lifecycle/Pausable.sol";

/**
 * SECURITY TIP: Do not use onlyOwner with any "view" functions.  Only signed
 *  transactions have a verified msg.sender field.  The msg.sender field in a
 *  "view" function call can be spoofed by the caller so it is useless for
 *  any authorization strategy.
 */

/**
 * TODO: Read these notes before making any significant changes to the smart contract
 *      to make sure you understand the main strategies embodied in it.
 *
 *  PLAYER VS BAND PAYMENTS:
 *
 *
 *      PLAYERS
 *
 *      Player payments are facilitated by code that resides in the Node.JS server.
 *      They are submitted to the Ethereum network by that code after a finalizeGame()
 *      call calculates and stores the payments necessary to pay the players in a
 *      a completed game (after that transaction has been confirmed/mined).  Player
 *      payments are added to the pending payments linked list during the finalizeGame()
 *      call.  This is the list (and it's related contract level tracking variables) that
 *      tracks the Ethereum addresses that still require payment by the contract.
 *
 *      BANDS
 *
 *      Band payments, like player payments are also calculated and stored during
 *      the finalizeGame() call.  However, if a band in a game has not put their
 *      Ethereum address in their channel description yet, their payments go into
 *      the structure that stores payments in escrow.  Once the band with escrow
 *      payments has gone through the claim process, any payments due to them
 *      go into the pending payments list and are submitted to the Ethereum
 *      network in the same manner that player payments are made
 */

/**
 * TODO: MAIN ERRORS:
 *
 *
 * TODO: NOTES (Todo Tasks)

 * - Later, add code to the addPlayer() function that checks at the top of the
 *  if the player address given is already in the game.  If so, revert the
 *  transaction.  HOWEVER, add code to the web site now that calls the
 *  getIsPlayerInGame() view function and refuses to add the player if so
 *  (i.e. - "Player X is already in the game."
 *
 * - Drizzle?  Nick says it doesn't have to use React.  Probably best to use it
 *  and Redux later after the presentation.
 *
 * - Need delete game method that has a modifier that only allows it to be called if
 *      we are in the game state where the game is over and ALL payments have been
 *      made, including Escrow payments.  (Problem what if there are a lot of
 *      escrow payments lying around after a long time, storage costs?)
 *
 *      Clean up Redis keys too for deleted/completed games.
 *
 * - AFTER THE CONTEST:
 *
 * - Refund failed games (players left, tech issues, etc.)
 *
 * Architectural QUESTIONS:
 *
 * - What will happen to costs and performance when there are thousands of games active at the same time ?
 */


/**
 * This is the contract that manages all the games for EtherBandBattles.  Each game is 
 *  represented by a single structGame element.  The game server is assumed to be the 
 *  contract owner.
 */


// ------------------ CONTRACT: EtherBandBattlesManager  -----------------

/// @title The EtherBandBattlesManager factory contract.
/// @author Robert Oschler
// TODO: Restore this line.
contract EtherBandBattlesManager is Ownable, Pausable {
// contract EtherBandBattlesManager{

    // This event is emitted when a payment goes into escrow.
    event EscrowOccurred(bytes32 indexed ownerId, uint256 escrowAmount);

    // ------------------ USING STATEMENTS ------------------
    
    using SafeMath for uint256;    
    
    // ------------------ EVENTS ------------------

    /* NO EVENTS FOR NOW.  */

    // ------------------ CONSTANTS     ------------------
    
    // --->>> Video Platform IDs
    
    // These are the IDs that tell us, which video platform the videos in 
    //  the game are source from.  (E.g. - YouTube).
    // NOTE: These table and its equivalent in the Javascript code that
    //  lives in the web site project MUST match (i.e. - must stay in sync)!
    
    // We start at 1 because we want to make sure the caller specifically assigned
    //  the video platform ID, and since 0 is the default value for a uint, that
    //  indicates the caller forgot to set it or made some other kind of mistake.
    enum EnumVideoPlatforms {
        NOTSET,
        THETATV,
        YOUTUBE,
        TWITTER,
        NETFLIX,
        VIMEO,
        YAHOO,
        DAILYMOTION,
        HULU,
        VUBE,
        TWITCH,
        INSTAGRAM,
        KIK,
        // Update this video platform ID as we add new platforms.  We use this to 
        //  check the validity of the video platform ID.
        OUT_OF_RANGE
    }
		
    // --->>> Game state.
	
    // NOTE: These table and its equivalent in the Javascript code that
    //  lives in the web site project MUST match (i.e. - must stay in sync)!
	enum EnumGameState
	{
	    // Game state has not been set.  Usually indicates an error on the part of the programmer.
	    NOTSET,
		// The game has been created and is waiting for players, but has not 
		//  been started yet.
		CREATED,
		// The game has started and is underway, and will not accept any new players. 		
		PLAYING,
		// The game is over.
		GAME_OVER,  		
		// Update this game state value as we add new states, if ever.  We use this to 		
		//  check the validity of a new game state assignment. 		
		OUT_OF_RANGE
	}
    
    // --->>> Payment type.

	enum EnumPaymentType
	{
	    // The payment type has not been set.  Usually indicates an error on the part of the programmer.
	    NOTSET,
		// A player payment.
		PLAYER,
		// A band payment
		BAND,
		// A House payment.
		HOUSE,
		// A transfer from escrow to the the pending payments list (i.e. - the scheduling of an
		//  escrow payment.
		ESCROW_TRANSFER,
		// Update this game state value as we add new states, if ever.  We use this to
		//  check the validity of a new game state assignment.
		OUT_OF_RANGE
	}

    // --->>> Game IDs.
    
    // We do not allow a game ID to be 0.  That way we know if a game ID was 
    //  not initialized.
    uint256 constant id_invalid = 0;
    
    // --->>> House percentage.
    uint256 constant pct_house = 10;

    // ------------------ STORAGE VARIABLES -----------------
    
    // This variable tracks the number of games created and also servers as a unique 
    //  ID for each game.
    uint256 public s_numGamesCreatedAsId;
    
    // The map that maps a game ID to a specific game.
    mapping(uint256 => structGame) public s_mapGameIdToGame;
    
    // The map that maps a request nonce to a game ID.
    mapping (bytes32 => uint256) public s_mapRequestNonceToGameId;
    
    // The map that tracks individual payments tied to a particular game ID.  The
    //  mapping key is a hash of certain fields belonging to a
    //  structPendingPaymentDetails element.
    mapping (bytes32 => structPendingPaymentDetails) public s_mapPendingPaymentsByGame;
    
    // The map that tracks how much Ether is due to a particular address, whether that
    //  address is a player or a band, for a particular game.  It allows us to quickly
    //  report the total balance due to any particular address.
    mapping (address => uint256) public s_mapAddressToTotalBalance;

    // The map that tracks how much Ether is due to a particular owner ID.  This is the
    //  "escrow" storage.
    mapping (bytes32 => uint256) public s_mapOwnerIdToEscrowAmount;
    
    // The game rounds for a game are stored here.
    mapping (uint256 => structGameRoundResults[]) public s_mapGameIdToGameResults;

    // The players for a game are stored here.
    mapping (uint256 => address[]) public s_mapGameIdToPlayers;

    // The total number of games ever created with this version of the contract.
    uint256 public s_lastGameIdCreated;

    // The linked list that keeps track of pending payments.  The mapping key is a
    //  hash of a structPendingPaymentDetails element.
    mapping (bytes32 => structPendingPaymentLinkRec) public s_mapPendingPaymentList;

    // The hash of the ID Of the first pending payment in the pending payments linked list.  This element
    //  will be 0 if there are no pending payments.
    bytes32 s_firstPendingPaymentKey;
    
    // The hash of the ID of the last pending payment in the pending payments linked list.  This element
    //  will be 0 if there are no pending payments.
    bytes32 s_lastPendingPaymentKey;

    // ------------------ MODIFIERS -----------------
    // --->>> GAME STATES
    // @notice Game states - These modifiers are used to ensure that certain functions 
    //  are only called at the right time.

    /// This modified is only used for debugging.  It assigns various values we want to
    ///     inspect to local variables so we can view them with the Truffle debugger.
    modifier onlyToDebug() {
        address msgSender = msg.sender;
        address contractOwner = owner();

        bool senderEqualsOwner = (msgSender == contractOwner);
        _;
    }
    
    /// @param _gameId - a valid game ID.
    modifier onlyIfCreatedState(uint256 _gameId) {
        // TODO: Debugging.
        // uint thePlayingStateVal = uint(s_mapGameIdToGame[_gameId].gameState);

        require(s_mapGameIdToGame[_gameId].gameState == EnumGameState.CREATED, "The game is not in the CREATED state.");
        _;
    }
    
    /// @param _gameId - a valid game ID.
    modifier onlyIfPlayingState(uint256 _gameId) {
        // TODO: Debugging.
        // uint thePlayingStateVal = uint(s_mapGameIdToGame[_gameId].gameState);

        require(s_mapGameIdToGame[_gameId].gameState == EnumGameState.PLAYING, "The game is not in the PLAYING state.");
        _;
    }
    
    /// @param _gameId - a valid game ID.
    modifier onlyIfGameOverState(uint256 _gameId) {
        // TODO: Debugging.
        // uint thePlayingStateVal = uint(s_mapGameIdToGame[_gameId].gameState);

        require(s_mapGameIdToGame[_gameId].gameState == EnumGameState.GAME_OVER, "The game is not in the GAME_OVER state.");
        _;
    }
    
    // --->>> Enforce that the house public address has been set for the game and that
    //      if it has been set, make sure that the sender of the current transaction is
    //      that address.
    /// @param _gameId - a valid game ID.
    modifier onlyIfHouseAddrSetAndIsSender(uint256 _gameId) {

        require(s_mapGameIdToGame[_gameId].houseAddr != address(0), "The House address has not been set yet.");
        require(msg.sender == s_mapGameIdToGame[_gameId].houseAddr, "Only the House can use the desired function.");
        _;
    }
    
    /// --->>> Make sure the game ID has been explicitly set and does not belong to a deleted game.
    /// @param _gameId - a valid game ID.
    modifier onlyIfValidGameId(uint256 _gameId) {
        // TODO: Debugging code.
        // uint256 inputGameId = _gameId;
        // bool isExistingGame = s_mapGameIdToGame[_gameId].isExists;

        // Make sure the game ID has been explicitly set.
        require(_gameId != id_invalid, "The game ID  is invalid.");
        // Make sure the game has not been deleted.
        require(s_mapGameIdToGame[_gameId].isExists == true, "The ID given belongs to a deleted game or one that doesn't exist.");
        _;
    }

    // Extra modifiers to the functionality of other modifiers together to solve "stack too deep" errors.  The
    //  following modifiers only accept a valid game ID and only if the game with the given ID is in a specific
    //  state.
    modifier onlyIfValidGameIdAndPlayingState(uint256 _gameId)
    {
        // Make sure the game ID has been explicitly set.
        require(_gameId != id_invalid, "The game ID  is invalid.");

        // Make sure the game has not been deleted.
        require(s_mapGameIdToGame[_gameId].isExists == true, "The ID given belongs to a deleted game or one that doesn't exist.");

        // Make sure we are in the PLAYING state.
        require(s_mapGameIdToGame[_gameId].gameState == EnumGameState.PLAYING, "The game is not in the PLAYING state.");
        _;
    }

    modifier onlyIfValidGameIdAndCreatedState(uint256 _gameId)
    {
        // Make sure the game ID has been explicitly set.
        require(_gameId != id_invalid, "The game ID  is invalid.");

        // Make sure the game has not been deleted.
        require(s_mapGameIdToGame[_gameId].isExists == true, "The ID given belongs to a deleted game or one that doesn't exist.");

        // Make sure we are in the PLAYING state.
        require(s_mapGameIdToGame[_gameId].gameState == EnumGameState.CREATED, "The game is not in the CREATED state.");
        _;
    }

    modifier onlyIfValidGameIdAndGameOverState(uint256 _gameId)
    {
        // Make sure the game ID has been explicitly set.
        require(_gameId != id_invalid, "The game ID  is invalid.");

        // Make sure the game has not been deleted.
        require(s_mapGameIdToGame[_gameId].isExists == true, "The ID given belongs to a deleted game or one that doesn't exist.");

        // Make sure we are in the PLAYING state.
        require(s_mapGameIdToGame[_gameId].gameState == EnumGameState.GAME_OVER, "The game is not in the GAME_OVER state.");
        _;
    }

    // ======================== BEGIN: NON-ZOS ===================================
    
    // TODO: Comment the elements below out when returning to ZOS version.

    /*
    address public s_ourOwner;
    bool public s_ourPause = false;
  
    /**
     * @dev Throws if called by any account other than the owner.
     *
    modifier onlyOwner() {
        require(msg.sender == s_ourOwner);
        _;
    }
    
    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
    modifier whenNotPaused() {
        require(!s_ourPause);
        _;
    }

    constructor() public {
        s_ourOwner = msg.sender;
    }
    */

    // ======================== END  : NON-ZOS ===================================
        
        
    // ------------------ STRUCTS: PER-GAME -----------------

    
    // This struct holds the results of one round of pla in the game.
    struct structGameRoundResults {
        // -------------- winner calculations & payments ------------

        // We use this field to test for an element's existence, to make sure
        //  a map key doesn't represent a deleted or non-existent element.
        //  NOTE: This means when you create a new game struct you must
        //  set this field to TRUE.
        bool isExists;

        // The ordinal game round number that this result belongs to.
        uint256 roundNum;
        
        // The ID of the video that was played during the round.
        bytes32 videoId;
        
        // The owner ID for the entity that owns the video.
        bytes32 ownerId;
        
        // The address of the player that won the round.
        address winnerAddr;
        
        // The address of the band that the video belongs to.  May be 0 
        //  if we don't have it yet.
        address bandAddr;
    }

    // The struct that keeps a summary of the payments made for a game.
    struct structGamePayments {
        // The amount paid to the House for the game.
        uint256 totalhousePaymentGwei;

        // The amount paid out to all players in the game when it was finalized.
        uint256 totalPlayerPayments;

        // The amount paid out or stored in escrow to/for all the bands in
        //  the game when it was finalized.
        uint256 totalBandPaymentsOrEscrows;
    }
    
    // The struct that holds a particular game.
    struct structGame {
        // We use this field to test for an element's existence, to make sure 
        //  a map key doesn't represent a deleted or non-existent element.
        //  NOTE: This means when you create a new game struct you must 
        //  set this field to TRUE.
        bool isExists;
        
        // The request nonce that was given to the make game request that 
        //  created us.
        bytes32 requestNonce;
        
        // Our ID.
        uint256 id;
        
        // The current state or phase the game is in.  See the game state 
        //  constants above.
        EnumGameState gameState;
        
        // The House address.  
        address houseAddr;
        
        // The entry fee each player must pay to enter the game.  The sum of these
        //  fees form the "pool" of funds that later will be distributed to the 
        //  bands whose videos were submitted to this game, and the participating
        //  players.
        uint256 entryFeeGwei;
        
        // The percentage of the funds remaining after the House percentage is taken out 
        //  that goes directly to the bands, split evenly amongst them.  This value is 
        //  chosen by the player that created the game.
        uint256 bandDonationPercent;
        
        // The address of the player that created the game.
        address gameCreatorAddr;

        // The ID of the video the game creator submitted.
        bytes32 gameCreatorVideoId;
        
        // The ID of the video platform the videos in this game are source from.
        // See the game state constants above.
        EnumVideoPlatforms videoPlatformId;

        // The number of players added to the game.
        uint256 numPlayers;
        
        // The game balance.  That is, the total amount of Ether contributed to 
        //  the game by all the players.
        uint256 gameBalance;

        // -------------------- GAME ACCOUNTING ---------------

        structGamePayments gamePaymentsSummary;
    } // struct structGame

    // This struct groups the information necessary for a pending
    //  payment.  A hash of the non payment amount fields are used as a to the key to
    //  mappings involved with pending payments.  This struct is also used field within
    //  the pending payments record.
    struct structPendingPaymentDetails {
        // The reference date/time assigned to us during the finalizeGame() call that
        //  is passed to that method by the client.
        uint256 clientReferenceTimestamp;

        // The ID of the game the payment is associated with.
        uint256 gameId;

        // If the pending payments record belongs to a band, than this is the
        //  ID of the entity that owns the video that represented the band in
        //  game.  (e.g. - The channel ID of a YouTube video if a YouTube
        //  video represented the band during the game.
        // bytes32 ownerId;

        // If the pending payments record belongs to a band, than this is the
        //  ID of the video that this payment is for.
        bytes32 videoId;

        // The Ethereum address to be paid.
        address payeeAddr;

        // The amount of the payment.
        uint256 paymentAmountGwei;

        // The payment type.
        EnumPaymentType paymentType;
    } // structPendingPaymentDetails

    // The struct that is one record in the linked list that tracks pending payments.
    struct structPendingPaymentLinkRec {
        // We use this field to test for an element's existence, to make sure
        //  a map key doesn't represent a deleted or non-existent element.
        //  NOTE: This means when you create a new game struct you must
        //  set this field to TRUE.
        bool isExists;

        // The pending payment details.
        structPendingPaymentDetails pendingPaymentDetails;

        // The hash of the pending payment details payee address that will be paid BEFORE this one.
        //  This field's payee address field (and others) will be 0 if this is the first
        //  pending payment in the list.
        bytes32 linkToPreviousPayee;
        // The hash of the pending payment details payee address that will be paid AFTER this one.
        //  This field's payee address field (and others) will be 0 if this is the first
        //  pending payment in the list.
        bytes32 linkToNextPayee;
    } // structPendingPaymentLinkRec

    /** @notice This function hashes the 3 fields that create a unique ID for each pending
     *      payment in order to build a unique key for all the mappings that work with
     *      pending payments.
     *
     * @return - Returns the hash of the 3 fields that create a unique ID for the given
     *  pending payment details structure.
     */
    function hashPendingPaymentDetails(structPendingPaymentDetails memory _pendingPaymentDetails)
        private view
        onlyIfValidGameIdAndGameOverState(_pendingPaymentDetails.gameId)
        returns (bytes32) {

        return keccak256(abi.encodePacked(_pendingPaymentDetails.gameId, _pendingPaymentDetails.videoId, _pendingPaymentDetails.payeeAddr));
    }


    // --------------------- FUNCTIONS: PER-GAME ---------------------------

    /** @dev - Do not change the state of a game directly.  Use this function
     *  to change a game's state since it also emits an event to report the
     *  state change.
     */
    function changeGameState(uint256 _gameId, EnumGameState newState)
            private
            onlyIfValidGameId(_gameId) returns (EnumGameState) {
        EnumGameState oldState = s_mapGameIdToGame[_gameId].gameState;
        s_mapGameIdToGame[_gameId].gameState = newState;

        // Emit a game state changed event.
        // emit NewGameState(_gameId, newState);

        return oldState;
    }

    /**
     * @notice Add a new player to the game.  Callable only by the House.
     * 
     * @param _gameId - The ID Of the game that the new player should be added to.
     * @param _playerAddr - The address of the new player.
     * @param _videoId - The ID of the video the player submitted
     *  for the game.
     * 
     * STATE: The game must be in the CREATED state to add players.  Once the game
     *  begins, no new players are allowed.
     */
    function addPlayer(uint256 _gameId, address _playerAddr, bytes32 _videoId)
            public payable
            onlyIfValidGameIdAndCreatedState(_gameId)
            whenNotPaused {
        // Parameter validation.
        require(_playerAddr != address(0), "(addPlayer) The player address must not be empty.");
        require(_videoId.length > 0, "(addPlayer) The submitted video ID must not be empty.");
        // The entry fee paid by the player must be equal to or greater than the entry 
        //  fee set for the game.
        require(msg.value >= s_mapGameIdToGame[_gameId].entryFeeGwei, "(addPlayer) The entry fee given is less than that set for the game.");
        
        // --->>> All field modifications need to reference the correct game.
       
        // keep track of the total amount of Ether contributed to this game.
        s_mapGameIdToGame[_gameId].gameBalance =
            s_mapGameIdToGame[_gameId].gameBalance.add(msg.value);

        // Add the player to the map that maintains a list of all the
        //  players in a game.
        s_mapGameIdToPlayers[_gameId].push(_playerAddr);

        // Increment the count of players added to the game.
        s_mapGameIdToGame[_gameId].numPlayers = s_mapGameIdToGame[_gameId].numPlayers.add(1);

        // Emit the event that tells others about the new player being added.
        // emit NewPlayer(_gameId, s_mapGameIdToGame[_gameId].numPlayers);
    }
    
    /**
     * @notice Add the results of a round of play to the game.

     * NOTE: Any attempt to add more game round results to the game than there are
     *  rounds will be rejected.
     *
     * @param _roundNum - The ordinal game round number this result belongs to.
     *  Should always be greater than 0 since we rely on 0 to indicate the
     *  submission of an uninitialized and therefore game round number.
     * @param _gameId - The ID Of the game that the new player should be added to.
     * @param _roundNum - The ordinal round number that was just played.  1-based so
     *  the value given MUST be greater than 0.
     * @param _videoId - The ID of the video that was played during the round.
     * @param _ownerId - The ID of the entity that the video belongs to.
     * @param _winnerAddr - The address of the player that won the round.
     * @param _bandAddr - The address of the band the video belongs to.  If
     *  the value is the same as the house address, then we treat that value
     *  as a sign that the band does not have an Ethereum address yet and
     *  that their cut should be put into "escrow" until they get one.
     *
     * STATE: The game must be in the PLAYING state to add game round results and the sender
     *  must be the house address (which is usually the game server).
     *
     * UPDATE: You can not pass an address anymore that does not pass the address
     *  validation process, like address 0.  We used to use address 0 to represent bands
     *  that had not obtained an Ethereum address yet.  We now use the house address
     *  for the game for that purpose.  EDIT: Some people on Gitter/Solidity say that
     *  "0x00" should work.  Leaveing current method in place for now.
     */
    function addGameRoundResult(uint256 _gameId, uint256 _roundNum, bytes32 _videoId, bytes32 _ownerId, address _winnerAddr, address _bandAddr)
            public
            onlyIfHouseAddrSetAndIsSender(_gameId)
            onlyIfValidGameIdAndPlayingState(_gameId) {

        // Parameter validation.
        require(_roundNum > 0, "(addGameRoundResult) Invalid round number.");
        // We use the number of players as a proxy for the number of rounds in a game.
        //  The given round number must be less than or equal to the number of rounds in
        //  a game.
        uint256 numRoundsInAGame = s_mapGameIdToPlayers[_gameId].length;
        require(_roundNum <= numRoundsInAGame, "(addGameRoundResult) The number of allowed game round results have already been posted to this game.");
        require(_videoId.length > 0, "(addGameRoundResult) The video ID must be set.");
        require(_ownerId.length > 0, "(addGameRoundResult) The owner ID must be set.");
        require(_winnerAddr != address(0), "(addGameRoundResult) The address of the winning player must be set.");

        address useAddr = _bandAddr;

        // Did the server pass the house address for the band address,
        //  which tells us that the band does not have an Ethereum
        //  address yet?
        if (s_mapGameIdToGame[_gameId].houseAddr == _bandAddr)
        {
            // Yes.  Then use address(0) for the band address.
            useAddr = address(0);
        }

        // --->>> All field modifications need to reference the correct game.
        s_mapGameIdToGameResults[_gameId].push(
            structGameRoundResults(
                true,
                _roundNum,
                _videoId,
                _ownerId,
                _winnerAddr,
                useAddr));

        // Emit the event that tells others about the new game round result being added
        //  to the game.
        // emit NewGameRoundResult(_gameId, s_mapGameIdToGame[_gameId].numPlayers, s_mapGameIdToGameResults[_gameId].length);
    }
    
    
    /** @notice This function adds an address to the pending payment linked list.  If a
     *   record already exists for the given payee address, the call is ignored.
     *
     * @param _mapKey - The key to the pending payment record.
     * @param _pendingPaymentDetails - The payment details for the payee.
     *
     * @return - Returns TRUE if a change occurred to the linked list due to the
     *  addition of the given payee address as a new record.  It returns FALSE if
     *  the payee address was already in the list.
     */
    function addAddressToPendingPaymentsList(
            bytes32 _mapKey,
            structPendingPaymentDetails memory _pendingPaymentDetails
        )
            private returns(bool) {
        require(_pendingPaymentDetails.gameId > 0, '(addAddressToPendingPaymentsList) The game Id is 0.');
        require(_pendingPaymentDetails.payeeAddr != address(0), '(addAddressToPendingPaymentsList) The payee address is empty.');

        // Do we have an existing record?  We must not add more than one record to the
        //  linked list or the list will be invalid.
        if (s_mapPendingPaymentList[_mapKey].isExists == true)
            return false; // Payee address already exists.  Just get out.

        // Are there any pending payments?
        if (s_firstPendingPaymentKey == "") {
            // ------------- FIRST PAYMENT -----------
            // No.  This is the first.  Add it.
            s_mapPendingPaymentList[_mapKey] =
                structPendingPaymentLinkRec(
                    true,
                    _pendingPaymentDetails,
                    "",
                    "");

            // Set the first and last pending payment pointers to this one.
            s_firstPendingPaymentKey = _mapKey;
            s_lastPendingPaymentKey = _mapKey;
        }
        else {
            // ------------- NOT FIRST PAYMENT -----------

            // Yes, there are existing payment payments.  Add this new payment to the
            //  end of the linked list and adjust the tracking variables as necessary.

            // Set the next pending payment field in the current last element to this one.
            s_mapPendingPaymentList[s_lastPendingPaymentKey].linkToNextPayee = _mapKey;

            // Add the new pending payment, with it's previous payment field set to the
            //  current last payment, and it's next payment field set to 0 since
            //  currently there are no pending payments after this one.
            s_mapPendingPaymentList[_mapKey] =
                structPendingPaymentLinkRec(
                    true,
                    _pendingPaymentDetails,
                    s_lastPendingPaymentKey,
                    "");

            // Adjust the last pending payment tracker to this new one.
            s_lastPendingPaymentKey = _mapKey;
        }

        return true; // The linked list was modified with a new record for the new payee address.
    }

     /** @notice This function removes an address to the pending payment linked list.
     *
     * @param _mapKey - The key to the pending payment record.
     */
    function removePaidAddressFromPendingPaymentsList(
            bytes32 _mapKey
        )
            private {
        // Does the address exist in the pending payments list?  If not, that is an error.  We should
        //  not have been called.
        require(s_mapPendingPaymentList[_mapKey].isExists == true, '(removePaidAddressFromPendingPaymentsList) The payee address is not in the pending payments list.');

        structPendingPaymentLinkRec memory pendingPaymentLinkRec = s_mapPendingPaymentList[_mapKey];
        structPendingPaymentDetails memory pendingPaymentDetails = pendingPaymentLinkRec.pendingPaymentDetails;

        // Update the total balance due the associated Ethereum public address (payee address).
        s_mapAddressToTotalBalance[pendingPaymentDetails.payeeAddr] =
            s_mapAddressToTotalBalance[pendingPaymentDetails.payeeAddr].sub(
                pendingPaymentDetails.paymentAmountGwei);

        // If the total balance is now 0, delete the element.
        if (s_mapAddressToTotalBalance[pendingPaymentDetails.payeeAddr] == 0)
            delete s_mapAddressToTotalBalance[pendingPaymentDetails.payeeAddr];

        bytes32 keyLinkToPreviousPayee = s_mapPendingPaymentList[_mapKey].linkToPreviousPayee;
        bytes32 keyLinkToNextPayee = s_mapPendingPaymentList[_mapKey].linkToNextPayee;

        // Update the variables that track the first and last payments in the list as needed.

        // If we were the first pending payment in the list, update the pending payment tracking
        //  variable that tracks the first pending payment to point to the one that followed
        //  the one being deleted since it is now the first payment.
        if (s_firstPendingPaymentKey == _mapKey)
            s_firstPendingPaymentKey = keyLinkToNextPayee;

        // If we were the last pending payment in the list, update the the tracking
        //  variable that tracks the last pending payment to point to the one that
        //  preceded the one being deleted since it is now the last.
        if (s_lastPendingPaymentKey == _mapKey)
            s_lastPendingPaymentKey = keyLinkToPreviousPayee;

        // Is the payment preceded by another payment in the linked list?
        if (keyLinkToPreviousPayee != "")
            // Yes. Set the next payment field in the previous payment to point
            //  to the payment that is after the one being deleted.
            s_mapPendingPaymentList[keyLinkToPreviousPayee].linkToNextPayee = keyLinkToNextPayee;

        // Is the payment followed by another payment in the linked list?
        if (keyLinkToNextPayee != "")
            // Yes. Set the previous payment field in the next payment to point
            //  to the payment that is before the one being deleted.
            s_mapPendingPaymentList[keyLinkToNextPayee].linkToPreviousPayee = keyLinkToPreviousPayee;

        // Delete the mapping entry.  First delete the child structs it contains.
        s_mapPendingPaymentList[_mapKey].pendingPaymentDetails;

        // Now delete the entry itself.
        delete s_mapPendingPaymentList[_mapKey];
    }

    /** @notice This function schedules a payment for the given payee address using the
     *  given amount in Gwei.
     *
     * @dev In the case of an escrow payment, the game ID will be 0 for escrow payments
     *  since we don't track those by game. An escrow payment contains the total sum
     *  payments due to the escrow payee.
     *
     * @param _pendingPaymentDetails - A valid pending payment details structure.
     */
    function schedulePayment(
            structPendingPaymentDetails memory _pendingPaymentDetails
        )
            private {
        require(_pendingPaymentDetails.payeeAddr != address(0), "(schedulePayment) The payee address is empty.");
        require(_pendingPaymentDetails.paymentAmountGwei > 0, "(schedulePayment) The payment amount is zero.");

        // Build the map key.
        bytes32 mapKey = hashPendingPaymentDetails(_pendingPaymentDetails);

        // Store the payment.
        s_mapPendingPaymentsByGame[mapKey] = _pendingPaymentDetails;

        // Add the payment to the pending payments list.
        addAddressToPendingPaymentsList(mapKey, _pendingPaymentDetails);

        // Update the total balance due the associated Ethereum public address (payee address).
        s_mapAddressToTotalBalance[_pendingPaymentDetails.payeeAddr] =
            s_mapAddressToTotalBalance[_pendingPaymentDetails.payeeAddr].add(
                _pendingPaymentDetails.paymentAmountGwei);
    }

    /**
     * @notice Process the payments to the band using the results of the game given
     *  to us earlier by multiple calls to addGameRoundResult().
     *
     * NOTE: If an address is not found in the band addresses array, the amount due that
     *  band is stored in the escrow map instead of the claims map.
     *
     * @param _clientReferenceTimestamp - The timestamp the client passed to the
     *  finalizeGame() method, to be stored with the payment details structure.
     * @param _gameId - The game ID of the game this payment is associated with.
     * @param _perBandPayment - The amount to pay each band.
     */
    function processBandPayments(
            uint256 _clientReferenceTimestamp,
            uint256 _gameId,
            uint256 _perBandPayment
        )
            private
            onlyIfValidGameIdAndGameOverState(_gameId) {

        // We should have at least one game round result or something is
        //  very wrong.
        require(s_mapGameIdToGameResults[_gameId].length > 0, "(processBandPayments) The game round results array is empty.");

        // If the band donation percentage is 0, then this method should not have been called.
        require(_perBandPayment > 0, "(processBandPayments) The payment for each band is 0.");

        // Process each band payment by iterating the game round results.
        for (uint i = 0; i < s_mapGameIdToGameResults[_gameId].length; i++)
        {
            require(s_mapGameIdToGameResults[_gameId][i].ownerId.length > 0, "(processBandPayments) An owner ID was not set.");

            address bandAddr = s_mapGameIdToGameResults[_gameId][i].bandAddr;

            // Aggregate the total amount paid or stored in escrow to/for bands in this game.
            s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalBandPaymentsOrEscrows =
                s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalBandPaymentsOrEscrows.add(_perBandPayment);
                
            // Do we have a band address?
            if (bandAddr == address(0)) {
                // No.  Aggregate the payment amount in escrow.
                s_mapOwnerIdToEscrowAmount[s_mapGameIdToGameResults[_gameId][i].ownerId] =
                    s_mapOwnerIdToEscrowAmount[s_mapGameIdToGameResults[_gameId][i].ownerId].add(_perBandPayment);

                // Emit an escrow event.
                emit EscrowOccurred(s_mapGameIdToGameResults[_gameId][i].ownerId, _perBandPayment);
            }
            else {
                // Schedule the payment immediately.
                schedulePayment(
                    structPendingPaymentDetails(
                            _clientReferenceTimestamp,
                            _gameId,
                            s_mapGameIdToGameResults[_gameId][i].videoId,
                            bandAddr,
                            _perBandPayment,
                            EnumPaymentType.BAND));
            }
        }
    }

    /** @notice This function processes all the player payments for a game.
     *
     * @param _clientReferenceTimestamp - The timestamp the client passed to the
     *  finalizeGame() method, to be stored with the payment details structure.
     * @param _gameId - The game ID of the game this payment is associated with.
     * @param _perVideoPayment - The amount to pay each player for each video they
     *  won (i.e. - each round in the game they won).
     */
    function processPlayerPayments(
            uint256 _clientReferenceTimestamp,
            uint256 _gameId,
            uint256 _perVideoPayment
        )
            private
            onlyIfValidGameIdAndGameOverState(_gameId) {

        // We should have at least one game round result or something is
        //  very wrong.
        require(s_mapGameIdToGameResults[_gameId].length > 0, "(processBandPayments) The game round results array is empty.");
        
        // If the band donation percentage is 100, indicating no money should go to the players, 
        //  then this method should not have been called.
        require(_perVideoPayment > 0, "(processPlayerPayments) The payment for each player is 0.");
        
        // Process each player payment by iterating the game round results.
        for (uint i = 0; i < s_mapGameIdToGameResults[_gameId].length; i++)
        {
            address payeeAddr = s_mapGameIdToGameResults[_gameId][i].winnerAddr;
            require(payeeAddr != address(0), "(processPlayerPayments) Found a winner address that was not set.");

            // Aggregate the total amount paid to players in this game.
            s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalPlayerPayments =
                s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalPlayerPayments.add(_perVideoPayment);

            // Schedule the payment.
            schedulePayment(
                structPendingPaymentDetails(
                        _clientReferenceTimestamp,
                        _gameId,
                        s_mapGameIdToGameResults[_gameId][i].videoId,
                        payeeAddr,
                        _perVideoPayment,
                        EnumPaymentType.PLAYER));
        }
    }

    
    /**
     * @notice Determine the payments to the bands and players by calculating and then storing
     *  the amount due them in the claims map.  For bands that we don't find an
     *  address for in the band addresses array, put the amount in escrow 
     *  for them, using the owner ID associated with a given ID as the escrow 
     *  key.
     *
     * @param _clientReferenceTimestamp - The timestamp the client passed to the
     *  finalizeGame() method, to be stored with the payment details structure.
     * @param _gameId - The game ID of the game this payment is associated with.
     *
     * NOTE: The game must currently be in the PLAYING state.
     * NOTE: This method sets the game to the GAME_OVER state.
     * NOTE: This method does NOT make the actual payments.  It just calculates them.
     * NOTE: The content required for calculating payments comes from the earlier
     *  calls to addGameRoundResult(), made after each round of play to record 
     *  the details of the round.
     */
    function finalizeGame(
            uint256 _clientReferenceTimestamp,
            uint256 _gameId 
        )
            public  
            onlyIfValidGameIdAndPlayingState(_gameId)
            whenNotPaused {
        // The number of game round results must equal the number of players (rounds)
        //  or we don't have all the information needed to calculate payment
        //  properly.
        require(getIsGameReadyToBeFinalized(_gameId), "(finalizeGame) All the game round results for the game have not been posted and confirmed/mined yet.");
        
        // The number of videos is equal to the number of rounds played.
        uint256 numVideos = s_mapGameIdToGameResults[_gameId].length;
        
        // Change the game to the GAME OVER state or several of the payment function 
        //  calls below will fail because they require the game to be in the game over 
        //  state.
        changeGameState(_gameId, EnumGameState.GAME_OVER);

        // Calculate the amount due the house.

        // We were advised to multiply first, then divide due to the EVM code's handling of 
        //  division operations and precision.
        uint256 gameBalance = s_mapGameIdToGame[_gameId].gameBalance;
        uint256 gameBalanceTemp = gameBalance.mul(pct_house);
        uint256 housePaymentGwei = gameBalanceTemp.div(100);
        address houseAddr = s_mapGameIdToGame[_gameId].houseAddr;

        // Record the amount paid to the house.
        s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalhousePaymentGwei =
            s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalhousePaymentGwei.add(housePaymentGwei);

        // Schedule the payment to the house.
        schedulePayment(
            structPendingPaymentDetails(
                _clientReferenceTimestamp,
                _gameId,
                "house", // House payments are not associated with an video ID.
                houseAddr,
                housePaymentGwei,
                EnumPaymentType.HOUSE));

        // Calculate the remaining funds after removing the house percentage.
        uint256 remainder = s_mapGameIdToGame[_gameId].gameBalance - housePaymentGwei;
        
        require(remainder > 0, "(finalizeGame) The game balance after removing the house percentage is 0 or less.");
        
        uint256 bandPaymentPool = 0;
        uint256 perBandPayment = 0;
        uint256 playerPaymentPool = 0;
        uint256 perVideoPayment = 0;
        
        // Calculate the amount of money to be distributed to the bands and the players.
        if (s_mapGameIdToGame[_gameId].bandDonationPercent == 0)
        {
            // Everything goes to the players.
            playerPaymentPool = remainder;
            perVideoPayment = playerPaymentPool.div(numVideos);
        } 
        else if (s_mapGameIdToGame[_gameId].bandDonationPercent == 100)
        {
            // Everything goes to the bands.
            bandPaymentPool = remainder;
            perBandPayment = bandPaymentPool.div(numVideos);
        }
        else
        {
            // Split the remainder between the players and the bands according to the 
            //  band donation percentage.
            bandPaymentPool = remainder.div(100).mul(s_mapGameIdToGame[_gameId].bandDonationPercent);
            
            // The band payment pool is distributed evenly across the number of participating bands.
            perBandPayment = bandPaymentPool.div(numVideos);
            
            // Calculate the amount of funds to distributed across the players.
            playerPaymentPool = remainder.sub(bandPaymentPool);
            
            // The per player payment is based on the number of games each player won.  However,
            //  the amount paid for each video is based on the number of videos in the game.
            perVideoPayment = playerPaymentPool.div(numVideos);
        }
        
        // Watch out for having no payments at all to make.
        require(perBandPayment > 0 || perVideoPayment > 0, "(finalizeGame) There are no payments to be made for this game, given the current amounts.");
        
        // Process the band payments if we have any.
        if (perBandPayment > 0)
        {
            processBandPayments(_clientReferenceTimestamp, _gameId, perBandPayment);
        }
        
        if (perVideoPayment > 0)
        {
            // Process the player payments.
            processPlayerPayments(_clientReferenceTimestamp, _gameId, perVideoPayment);
        }
    }

    
    // ----------------------------- FUNCTIONS: Game creation and management --------------------

    /**
     * @notice Add a new game to the system.
     * 
     * @param _requestNonce - The nonce that is given us to associate with the 
     *  game ID we assign to a new game.
     * @param _gameId - the ID assigned to this new game.
     * @param _entryFeeGwei - The entry fee to play the game, denominated in Gwei.
     * @param _bandDonationPercent - The percentage of the pool that goes to the bands.  
     *  The rest goes to the players, except for the House percentage and that is subtracted 
     *  before all other calculations are done.
     * @param _gameCreatorAddr - The address of the player that created the game.
     * @param _gameCreatorVideoId - The ID of the video the game creator submitted
     *  with the makeGame() request.
     * @param _videoPlatformId - The ID of the video platform the video belongs to.
     *
     * NOTE: We don't use the onlyIfValidGameId modifier here because we have not created the 
     *  game yet and that modifier will fail if it can't find the game in our games map.'
     */
    function addNewGame(
            bytes32 _requestNonce,
            uint256 _gameId,
            uint256 _entryFeeGwei,
            uint256 _bandDonationPercent,
            address _gameCreatorAddr,
            bytes32 _gameCreatorVideoId,
            EnumVideoPlatforms _videoPlatformId)
                private {
        // Validate parameters.

        // The request nonce must not be 0.
        require(_requestNonce.length > 0,  "(addNewGame) The request nonce is empty.");
        
        // The game ID must be explicitly set.
        require(_gameId != id_invalid, "(addNewGame) The game ID must be set.");
        
        // The entry fee must be greater than 0.
        require(_entryFeeGwei > 0, "(addNewGame) The entry fee must be greater than 0.");
        
        // The band donation percent must be less than or equal to 100.
        require(_bandDonationPercent <= 100, "(addNewGame) The band donation percent must not be greater than 100 percent.");
        
        // The game creator address must not be 0.
        require(_gameCreatorAddr != address(0), "(addNewGame) The game creator address must be set.");

        // The video platform ID must not be 0, or be beyond the range of the IDs.
        require(_videoPlatformId > EnumVideoPlatforms.NOTSET, "(addNewGame) The video platform ID must be set.");
        require(_videoPlatformId < EnumVideoPlatforms.OUT_OF_RANGE, "(addNewGame) The video platform ID is outside the acceptable range.");

        // Save it in our collection.
        s_mapGameIdToGame[_gameId] = 
            structGame(
                // Set isExists field to TRUE.
                true,
                _requestNonce,
                _gameId,
                EnumGameState.NOTSET,
                // The House address is initially zero.
                address(0),
                _entryFeeGwei,
                _bandDonationPercent,
                _gameCreatorAddr,
                _gameCreatorVideoId,
                _videoPlatformId,
                // Current number of players.
                0,
                // Game balance.
                0,
                structGamePayments(0, 0, 0) // Game payments summary.
            );

        // Save it in our request nonce to game ID collection too
        //  to facilitate calls to the getGameId() method.
        s_mapRequestNonceToGameId[_requestNonce] = _gameId;

        // Change the state of the new game to CREATED.
        changeGameState(_gameId, EnumGameState.CREATED);
    }
    
    /**
     * @notice Make a payment on behalf of a player/band by the game server (Administrator/owner).
     * 
     * @param _gameId - The ID Of the game the payment is associated with.
     * @param _videoId - The ID of the video the payment is associated with.
     * @param _payeeAddr - The destination address for the payment (i.e.
     *  the player or band to be paid).
     * 
     * NOTE: This code was sourced from the Open Zeppelin PullPayment contract from 
     *  the withdrawPayments() method.
     */
    function claimPayment(uint256 _gameId, bytes32 _videoId, address payable _payeeAddr)
            public 
            onlyOwner
            onlyIfValidGameIdAndGameOverState(_gameId)
            whenNotPaused
            {
        require(_payeeAddr != address(0), "(claimPayment) The payee address is not set.");
        require(_videoId != "", "(claimPayment) The video ID is not set.");

        // Create a payment details structure from the input parameters so we can generate
        //  a mapping key.
        structPendingPaymentDetails memory pendingPaymentDetails =
            structPendingPaymentDetails(
                0,
                _gameId,
                _videoId,
                _payeeAddr,
                0,
                EnumPaymentType.NOTSET);

        // Build the mapping key from the pending payment details.
        bytes32 mapKey = hashPendingPaymentDetails(pendingPaymentDetails);

        // Make sure they have funds waiting for them.
        pendingPaymentDetails.paymentAmountGwei = s_mapPendingPaymentsByGame[mapKey].paymentAmountGwei;
        require(pendingPaymentDetails.paymentAmountGwei > 0, "(claimPayment) In the context of the given game and resource ID, the payee does not have any funds waiting for them.");
        
        // Make sure this contract has enough funds to cover the payment.
        require(address(this).balance >= pendingPaymentDetails.paymentAmountGwei, "(claimPayment) The contract does not have enough funds to cover the payment at this time.");

        // Remove the payment from our claim amount storage.
        delete s_mapPendingPaymentsByGame[mapKey];
        
        // Remove the payment from the pending payments list.
        removePaidAddressFromPendingPaymentsList(mapKey);

        // Make the payment.
        _payeeAddr.transfer(pendingPaymentDetails.paymentAmountGwei);
    }
    
    /**
     * @notice Schedule an escrow payment on behalf of a player/band by the game server
     *  (Administrator/owner).
     *
     * @param _ownerId - The ID of the entity that owns the videos that were 
     *  used in one or more games. (e.g. - A Band's YouTube channel ID if the amounts 
     *  were accrued during games that used videos hosted on YouTube).
     * 
     * @param _payeeAddr - The destination address for the payment (i.e. 
     *  the band to be paid from escrow).
     * 
     * NOTE: This code was sourced from the Open Zeppelin PullPayment contract from 
     *  the withdrawPayments() method.
     */
    function claimEscrow(
                bytes32 _ownerId,
                address _payeeAddr)
            public 
            onlyOwner
            whenNotPaused {
        require(_ownerId.length > 0, "(claimEscrow) The owner ID is not set.");
        require(_payeeAddr != address(0), "(claimEscrow) The payee address is not set.");

        // Make sure they have funds waiting for them in escrow.
        uint256 escrowAmount = s_mapOwnerIdToEscrowAmount[_ownerId];
        require(escrowAmount > 0, "(claimEscrow) The owner does not have any funds waiting for them in escrow.");
        
        // Remove the payment from our escrow amount storage.
        s_mapOwnerIdToEscrowAmount[_ownerId] = 0;
        
        // Make sure this contract has enough funds to cover the payment.
        require(address(this).balance >= escrowAmount, "(claimEscrow) The contract does not have enough funds to cover the payment.");

        // Schedule the payment.
        schedulePayment(
            structPendingPaymentDetails(
                // The client side reference timestamp does not apply here.
                0,
                // We use a game ID of zero because this is an escrow payment, not tied to a particular game, but
                //  to the aggregate amount owed to the payee.
                0,
                _ownerId,
                _payeeAddr,
                escrowAmount,
                EnumPaymentType.ESCROW_TRANSFER));
    }

    // ============================== BEGIN: CONFIRMATION CALLS =====================

    // Below are the calls used by the node.JS app to confirm that various contract
    //  operations have been confirmed/mined by the Ethereum network.

    /**
     * @notice Web3 Code that must have a dependable way to get the ID for a
     *  game they recently requested to be made can poll this method every
     *  few seconds to see if the game was created.  This is a backup plan to
     *  that of listening for the CreatedNewGame event.
     *
     * @param _requestNonce - The request nonce that was given to us 
     *  when makeGame() was called.

     * @return - Returns the game ID of the game that was created 
     *  during the makeGame() call.  Returns 0 if we don't have a record of 
     *  any new game yet for the given once, usually indicating the new game
     *  has not been written to the distributed ledger yet.
     */
    function getGameId(bytes32 _requestNonce)
            public view
            returns(uint256) {
        return s_mapRequestNonceToGameId[_requestNonce];
    }

    /**
     * @notice Given a game ID, return the number of game round results
     *  added to the game so far.
     *
     * @return - Returns the total number of game round results added to
     *  the game so far.
     */
    function getNumGameRoundResults(uint256 _gameId)
        public view
            onlyIfValidGameId(_gameId)
            returns (uint256) {
        return s_mapGameIdToGameResults[_gameId].length;
    }

    /**
     * @notice Given a game ID, return the current state for that game.
     * 
     * @param _gameId - the ID assigned to this new game.
     * 
     * @return - Returns the current state of the game.  If no 
     *  game exists with the given ID, the value returned weill be 
     *  equal to 0 (id_invalid).  Remember, the first game ID ever 
     *  created is 1, not 0.
     */
    function getGameState(uint256 _gameId)
            public view
            returns (EnumGameState) {
        if (s_mapGameIdToGame[_gameId].isExists)
        {
            return s_mapGameIdToGame[_gameId].gameState;
        }
        else
        {
            return EnumGameState.NOTSET;
        }
    }

    /**
     * @notice Given a game ID, return the number of players added
     *  to the game so far.
     *
     * @param _gameId - the ID of the game for this query.
     *
     * @return - Returns the total number of players added to the game
     *  so far.
     */
    function getNumPlayers(uint256 _gameId)
            public view
            onlyIfValidGameId(_gameId)
            returns (uint256) {
        return s_mapGameIdToGame[_gameId].numPlayers;
    }

    /**
     * @notice Given a game ID and a round number, if a game round
     *  result exists for that round number, than just return the
     *  round number given to us.  If not, return 0, which indicates
     *  a game round result for that round number was never submitted
     *  or the Ethereum transaction that did has not been mined/confirmed
     *  yet.
     *
     * @param _gameId - the ID of the game for this query.
     * @param _roundNum - the desired round number.
     *
     * @return - Returns TRUE if a game round result for the given round
     *  number has been posted, other FALSE is returned.
     */
    function getIsGameRoundResultPosted(uint256 _gameId, uint256 _roundNum)
            public view
            onlyIfValidGameId(_gameId)
            returns (bool) {
        // Parameter validation.
        require(_roundNum > 0, "(getIsGameRoundResultPosted) Invalid round number.");

        // Scan the game round results map for a game round result that bears
        //  the desired round number
        for (uint i = 0; i < s_mapGameIdToGameResults[_gameId].length; i++)
        {
            // Match?
            if (s_mapGameIdToGameResults[_gameId][i].roundNum == _roundNum)
                // Yes.  The given game round result has been posted to the
                //  desired game.
                return true;
        }

        // No.  The given game round result has not been posted to the desired
        //  game yet, or the Ethereum transaction submitted for that game round
        //  result has not been mined/confirmed yet.
        return false;
    }

    /**
     * @notice Given a game ID, return TRUE if the game is ready to be 
     *  finalized.  Otherwise return FALSE.
     *
     * NOTE: The game must currently be in the PLAYING state.
     *
     * @param _gameId - the ID of the game for this query.
     *
     * @return - Returns TRUE if the number of game round results
     *  posted is equal to the number of players in the game.  If TRUE, this
     *  indicates that all game round results have been posted and that the
     *  the game is ready for payment processing.  Otherwise FALSE
     *  is returned.
     */
    function getIsGameReadyToBeFinalized(uint256 _gameId)
            public view
            onlyIfValidGameIdAndPlayingState(_gameId)
            returns(bool) {
        // Is the count of game round results for this game ID equal
        //  to the number of players in the game?
        if (s_mapGameIdToPlayers[_gameId].length == s_mapGameIdToGameResults[_gameId].length)
            // Yes.  The game is ready to have payments processed for it.
            return true;

            // No.  The game is not ready to have payments processed for it.
        return false;
    }


    /**
     * @notice Given a game ID and a player address, return TRUE if
     *  we have a record of the player having entered the game
     *
     * @param _gameId - the ID of the game for this query.
     * @param _playerAddr - address of the player we are interested in.
     *
     * @return - Returns TRUE if the player is in the game, FALSE if not.
     */
    function getIsPlayerInGame(uint256 _gameId, address _playerAddr)
            public view
            onlyIfValidGameId(_gameId)
            returns (bool) {
        require(_playerAddr != address(0), "(getIsPlayerInGame) The player address is not set.");

        // Is the player address in the players array for the given game?
        for (uint i = 0; i < s_mapGameIdToPlayers[_gameId].length; i++)
        {
            // Match?
            if (s_mapGameIdToPlayers[_gameId][i] == _playerAddr)
                // Yes.  The given player is in the game.
                return true;
        }

        // Couldn't find the player address in the players array.
        return false;
    }

    /**
     * @notice Given a game ID, check to see if the house address has been
     *  set for that game.
     *
     * @param _gameId - the ID of the game for this query.
     *
     * @return - Return TRUE if the house address has been
     *  set for the game, FALSE if not.
     */
    function getIsHouseAddrSet(uint256 _gameId)
            public view
            onlyIfValidGameId(_gameId)
            returns (bool) {
        if (s_mapGameIdToGame[_gameId].houseAddr == address(0))
            return false;

        return true;
    }
    
    /**
     * @notice Given a game ID and a payee address, return the amount
     *  of Ether owed to the payee, if any.  This value is the sum 
     *  of payments due to the payee across all games across all
     *  games.
     *
     * @param _gameId - the ID of the game for this query.
     * @param _payeeAddr - address of the payee we are interested in.
     *
     * @return - Returns the amount owed to the payee, or 0 if no
     *  money is owed to the payee.
     */
    function getPlayerBalance(uint256 _gameId, address _payeeAddr)
            public view
            onlyIfValidGameId(_gameId)
            returns (uint256) {
        require(_payeeAddr != address(0), "(getPlayerBalance) The player address is not set.");

        return s_mapAddressToTotalBalance[_payeeAddr];
    }

    /**
     * @notice This function walks the linked list of pending payments to get the total count of pending payments
     *      across all games.

     *  @return - Returns the number of payments still needed to be made by the smart contract.
     */
    function getPendingPaymentCount()
        public view
        returns(uint256) {

        uint256 countPayments = 0;
        bytes32 nextPaymentKey = s_firstPendingPaymentKey;

        while (nextPaymentKey != "") {
            countPayments++;
            nextPaymentKey = s_mapPendingPaymentList[nextPaymentKey].linkToNextPayee;
        }

        return countPayments;
    }

    /**
     *  @notice This function gets the oldest pending payment details from the pending payment linked list.
     *
     *  @param _paymentNdx - The index of the payment in the pending payment list the caller wants.
     *
     *  @return - Returns a tuple containing the fields of the next pending payment.  If there are no
     *      pending payments, it returns values for the all the fields that are the same as the
     *      values for an initialized field corresponding to each type.
     */
    function getNextPendingPaymentDetails(uint256 _paymentNdx)
            public view
            returns(uint256, uint256, bytes32, address, uint256, uint) {

        // Don't allow really large payment indexes, in case the EVM silently fails the call
        //  if we consume too much processing time, something we want to protect against
        //  anyways to protect the EVM from unfair CPU usage.
        require(_paymentNdx < 1000, "Payment index is equal to 1000 or greater.  This is not allowed.");

        uint256 countPayments = 0;
        bytes32 nextPaymentKey = s_firstPendingPaymentKey;

        while (countPayments < _paymentNdx && nextPaymentKey != "") {
            countPayments++;
            nextPaymentKey = s_mapPendingPaymentList[nextPaymentKey].linkToNextPayee;
        }

        if (nextPaymentKey == "")
            // No pending payments or no pending payments at the given payment index.
            return(0, 0, "", address(0), 0, 0);

        structPendingPaymentDetails memory pendingPaymentDetails =
            s_mapPendingPaymentsByGame[nextPaymentKey];

        return (
            pendingPaymentDetails.clientReferenceTimestamp,
            pendingPaymentDetails.gameId,
            pendingPaymentDetails.videoId,
            pendingPaymentDetails.payeeAddr,
            pendingPaymentDetails.paymentAmountGwei,
            uint(pendingPaymentDetails.paymentType)
        );
    }

    /** @notice - This function retrieves the payment summary for a given game ID.  The
     *  game must be in the GAME_OVER state.
     *
     *  @return - Returns a tuple containing the fields contained in the structGamePayments
     *      field for the desired game.
     */
    function getGamePaymentsSummary(uint256 _gameId)
            public view
            onlyIfValidGameIdAndGameOverState(_gameId) returns (uint256, uint256, uint256) {
        return (
            s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalhousePaymentGwei,
            s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalBandPaymentsOrEscrows,
            s_mapGameIdToGame[_gameId].gamePaymentsSummary.totalPlayerPayments);
    }

    // ============================== END  : CONFIRMATION CALLS =====================

    // ============================== BEGIN: BALANCE CHECKING CALLS =====================

    /**
     * @notice Get the current balance of this contract.
     *
     * @return - Returns the current balance of this contract.
     */
    function getContractBalance()
            public view
            returns (uint256)
            {
        return address(this).balance;
    }

    /**
     * @notice Get the escrow amount for a particular owner ID.
     *
     * @param _ownerId - The ID of the entity that owns the videos that were
     *  used in one or more games. (e.g. - A Band's YouTube channel ID if the amounts
     *  were accrued during games that used videos hosted on YouTube).
     *
     * NOTE: This code was sourced from the Open Zeppelin PullPayment contract from
     *  the withdrawPayments() method.
     */
    function getEscrowBalance(bytes32 _ownerId)
            public view
            returns (uint256)
            {
        require(_ownerId.length > 0, "(getEscrowBalance) The owner ID is not set.");

        uint256 escrowAmount = s_mapOwnerIdToEscrowAmount[_ownerId];
        // uint256 escrowAmount = 98761;
        return escrowAmount;
    }


    // ============================== END: BALANCE CHECKING CALLS =====================


    /**
     * Returns a game's current state.
    
     * This method initializes this contract and as a side effect, makes the caller
     *  (msg.sender) the owner of this contract.
     *
     * NOTE: Whoever calls this method becomes the Administrator of the contract!
     */
    /* TODO: Uncomment this function when restoring ZOS version.
    function initialize() public isInitializer("EtherBandBattlesManager", "1.0.0")  {
        // We inherit from Pausable, so we call its initialize() method with 
        //  the House address as the "sender" parameter and that will make the House 
        //  the owner of the contract.
        //
        // NOTE: Always call the inherited class initializer() first in case your 
        //  code depends on the creation/initialization of various inherited class
        //  elements.

        Pausable.initialize(msg.sender);
        initialize(msg.sender);
        
        // Assign the caller of this method as the Administrator of this contract.
        require(address(msg.sender) != 0, "(initialize) The message sender address is not set.");
    }
    */

    /**
     * @notice Monetary amounts should always be uint256 and be sent in GWei.  See the
     *  toWei() and toEth() Web3.js functions.  See the Game contract initialize()
     *  method for details on the parameters used in this method, since they
     *  share the same call signature.
    
     * This function makes a new game.  See the addNewGame() method for parameter details
     *  except for the ID parameter, since that element is created during this method call.
     *  Only the contract administrator is allowed to make games.
     * 
     */
    function makeGame(
            bytes32 _requestNonce,
            uint256 _entryFeeGwei,
            uint256 _bandDonationPercent,
            address _gameCreatorAddr,
            bytes32 _gameCreatorVideoId,
            EnumVideoPlatforms _videoPlatformId)
                public payable
                whenNotPaused {
        require(_gameCreatorVideoId.length > 0, "(makeGame) The video ID submitted by the game creator must not be empty.");

        // Create a new ID for the new game.  We start the ID series at 1 not 0
        //  So we can detect cases where the ID was neglected to be set.  That 
        //  is why we increment the ID before using the value of s_numGamesCreatedAsId
        //  field as an ID, not after.
        s_numGamesCreatedAsId = s_numGamesCreatedAsId.add(1);
        
        uint256 gameId = s_numGamesCreatedAsId;

        s_lastGameIdCreated = gameId;

        // Add a new game using the new ID and the other parameters given to us.
        addNewGame(
                _requestNonce,
                // Use the new ID we just created as the game ID.
                gameId,
                _entryFeeGwei,
                _bandDonationPercent,
                _gameCreatorAddr,
                _gameCreatorVideoId,
                _videoPlatformId);

        // Emit a NewGameCreated event.  We return the request nonce so Web3 code 
        //  listening for the event can tie the game ID back to the request that 
        //  generated it.
        //
        // IMPORTANT: Given the vagaries of the event generation on the Ethereum
        //  network, any Web3 code that is dependent on getting the game ID event 
        //  should also poll the getGameId() method every few seconds as a backup
        //  strategy to get game IDs.
        // emit CreateNewGame(_requestNonce, gameId);
            
        // Add the game creator to the new Game.  addPlayer() will  record their 
        //  entry fee as paid too.  Remember, if this is moved to a separate
        //  addPlayer() transaction, like for the non-game creator players,
        //  we will have to do extra work to prevent players from entering the
        //  game until we know the game has been created since you can't add
        //  players to a game that doesn't exist.
        addPlayer(gameId, _gameCreatorAddr, _gameCreatorVideoId);
    }


    /**
     * @notice This method sets the house address for a game.  It must be called
     *      before the start game call is made or that call will fail.
     */
    function setHouseAddress(uint256 _gameId, address _houseAddr) public
            // TODO: Remove this when done debugging.
            onlyToDebug
            onlyOwner
            onlyIfValidGameId(_gameId)
            onlyIfCreatedState(_gameId) {
        require(_houseAddr != address(0), "The house address is zero.");
        s_mapGameIdToGame[_gameId].houseAddr = _houseAddr;
    }
    
    /**
     * @notice This method starts the game.  Only the House can start a game and the 
     *  game must currently be in the CREATED state.
     */
    function startGame(uint256 _gameId) public
            onlyIfValidGameId(_gameId)
            onlyIfHouseAddrSetAndIsSender(_gameId)
            onlyIfCreatedState(_gameId)
            whenNotPaused {

        // The game ID must be explicitly set.
        require(_gameId != id_invalid, "(startGame) The game ID must be set.");

        bool isExistingGame = s_mapGameIdToGame[_gameId].isExists;

        // The game ID must be valid.
        require(isExistingGame == true, "The game ID provided is invalid or belongs to a deleted game.");

        // Just change the state to playing.
        changeGameState(_gameId, EnumGameState.PLAYING);
    }

    /**
     * @notice This function returns the number of games created since the
     *  the contracts inception.
     *
     * @return - Returns the total number of games ever created.
     */
    function getNumGamesCreated()
        public view
        returns(uint256) {
        return s_numGamesCreatedAsId;
    }

    /** @notice This function tests returning a tuple to an external caller.  It returns
     *   a tuple containing an address and a number.
     */
    function testReturnTuple()
        public pure
        returns (address, uint256)
    {
        return (address(9999), 5678);
    }

    /** @notice This function tests returning an address to the caller
     *  by echoing back the address of the sender.
     */
    function testReturnAddress()
        public view
        returns (address)
    {
        return (msg.sender);
    }

    /**
     * @notice This method is for testing the technique of sending a zero gas signed transaction
     *  to a method with VIEW visibility.

     *  @return - Returns the address found in the msg.sender method.
     */
    function testViewMethodAsSendMethod()
        public view
        returns(address) {

        return msg.sender;
    }

    // ============================ BEGIN: ECRECOVER Test Code =======================

    struct structEcRecoverTestResults  {
        bytes32 message;
        uint8 v;
        bytes32 r;
        bytes32 s;
        address signer;
    }

    structEcRecoverTestResults s_structEcRecoverTestResults;
    address s_theSigner;

    /**
     * @notice This method is for testing the technique of pulling out the Ethereum address
     *  from a signed element.  This is method requires a SEND transaction because it
     *  stores the results of the call to the smart contract.
     *  @param _hashedMessage - The hash of the message being tested.
     *  @param _v - The "v" element of the signature for the message.
     *  @param _r - The "r" element of the signature for the message.
     *  @param _s - The "s" element of the signature for the message.
     *
     *  @return - Returns the address decoded from the given input parameters.
     */
    function testEcRecovery(bytes32 _hashedMessage, uint8 _v, bytes32 _r, bytes32 _s)
        public
        returns (address) {
        // This prefix is needed to be in harmony with the Ethereum client as far as the format
        //  expected needed by the ecrecover function.  The "32" at the end of the prefix is
        //  the length of the incoming message parameter since it is a bytes32 value.
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";

        // Apply the hashing function to the message.
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, _hashedMessage));

        // Recover the Ethereum address of the message sender.
        address theSigner = ecrecover(prefixedHash, _v, _r, _s);

        // If the ecrecover function fails then theSigner will contain address(0);
        require(theSigner != address(0), "The ecrecover() function failed.  Malformed input?");
        
        // Save the results so we can use the getter method below to inspect them.
        s_structEcRecoverTestResults.message = _hashedMessage;
        s_structEcRecoverTestResults.v = _v;
        s_structEcRecoverTestResults.r = _r;
        s_structEcRecoverTestResults.s = _s;

        s_structEcRecoverTestResults.signer = theSigner;

        s_theSigner = theSigner;

        // Return the Ethereum address of the signer.
        return theSigner;
    }

    /**
     * @notice This method returns the input and output data involved with the last testEcRecovery() call.
     *
     * @return See above.
     */
    function getLastTestEcRecoverResults()
        public view
        returns (bytes32, uint8, bytes32, bytes32, address, address) {
        
        return (
            s_structEcRecoverTestResults.message,
            s_structEcRecoverTestResults.v,
            s_structEcRecoverTestResults.r,
            s_structEcRecoverTestResults.s,
            s_structEcRecoverTestResults.signer,
            s_theSigner
        );
    }

    /**
     * @notice Test making a payment.  This payable function takes an address and pays
     *  that address the amount of value that was provided by the caller.
     *
     * @param _payeeAddr - The destination address for the payment.
     */
    function testPayment(address payable _payeeAddr)
            payable
            public
            onlyOwner
            {
        require(_payeeAddr != address(0), "(testPayment) The payee address is not set.");
        require(msg.value != 0, "(testPayment) The amount of value accompanying the transaction is zero.");

        // Make the payment.
        _payeeAddr.transfer(msg.value);
    }

    // ============================ END  : ECRECOVER Test Code =======================

}


