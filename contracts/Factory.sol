// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "openzeppelin-solidity/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "openzeppelin-solidity/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./AccessControl.sol";

contract Factory is ERC721Enumerable, ERC721URIStorage, AccessControl, Ownable {
    //@dev: The following comments explain the contract and what it does (mainly)
    // Main USER/TRADER/BUYER use cases

    // mint NFT (take one out during a draft)
    // only available when the owner has made it possible (draft)
    // only available for the token that has not been minted yet
    // price for new tokens is predetermined
    // token is basically transfered to the address calling it
    // buy an NFT (make a bid for nft from someone who is auctioning)

    // sell an NFT (start an auction for an nft that you own)

    // Main OWNER use cases
    // start a draft available for a specific time

    // withdraw funds from the contract

    // @param: factory parameters
    // @dev: address which creates the Factory is the owner of the Factory
    // states
    // funds
    uint256 private escrowAmount;
    uint256 private royaltyPercentage = 20;
    // mint
    uint256 private maxCollectibles;
    uint256 public collectiblesMinted;
    uint256[] public tokensMinted;
    uint256 private mintPrice;
    // draft states
    uint256 private draftStartTime;
    uint256 private draftDuration = 2 days;
    // auction states
    uint256 private auctionDuration = 2 days;
    // structs
    struct Bid {
        address bidderAddress;
        uint256 bidAmount;
    }
    struct MetadataMapping {
        uint256 tokenId;
        string tokenURI;
    }
    struct Auction {
        uint256 tokenId;
        string tokenURI;
        uint256 auctionStartTime;
        uint256 auctionEndTime;
        uint256 auctionPrice;
        Bid currentBid;
    }
    // MAPPINGS
    mapping(uint256 => Bid) private tokenToHighestBid;
    mapping(uint256 => bool) private auctionStates;
    mapping(uint256 => uint256) private auctionTimes;
    mapping(uint256 => uint256) private auctionPrices;

    // EVENTS
    event MintSuccessful(uint256 indexed tokenId);
    event BidPlaced(
        uint256 indexed tokenId,
        address indexed bidderAddress,
        uint256 bidAmount
    );

    constructor(
        address _artistAddress,
        uint256 _maxCollectibles,
        string memory _tokenName,
        string memory _tokenShort,
        uint256 _mintPrice
    ) AccessControl(_artistAddress) ERC721(_tokenName, _tokenShort) {
        maxCollectibles = _maxCollectibles;
        draftStartTime = block.timestamp - 5 days;
        draftDuration = 2 days;
        collectiblesMinted = 0;
        mintPrice = _mintPrice;
    }

    // BASE CLASS OVERRIDES
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // vip modifiers
    // TOKEN HOLDER
    modifier isTokenHolder(uint256 _tokenId) {
        require(
            ownerOf(_tokenId) == msg.sender,
            "You don't own this token, you can only call this function on tokens you own"
        );
        _;
    }
    // draft modifier
    modifier hasEnoughDuration(uint256 _draftDuration) {
        require(
            _draftDuration >= 1 hours,
            "Draft duration must be at least 1 hour"
        );
        _;
    }
    // MINTING MODIFIERS
    modifier isMintable(uint256 tokenId) {
        // @dev: make sure that the tokenID is available
        // in the maxCollectablerange
        // confirm the token is available ✅
        // get a tokenID that is (within range, not minted so far) ✅
        require(tokenId >= 0);
        require(
            tokenId < maxCollectibles,
            "Token Id can not be greater than max collectibles range"
        );
        // not minted before
        require(_exists(tokenId) == false, "Token is already minted");
        _;
    }
    modifier isDraftOpen() {
        // check using time whether
        require(
            block.timestamp <= (draftStartTime + draftDuration),
            "Draft isnt open yet you can't mint"
        );
        _;
    }
    modifier isDraftClosed() {
        // check using time whether
        require(
            block.timestamp >= draftStartTime + draftDuration,
            "There is a draft in progress"
        );
        _;
    }
    modifier isValueEnough() {
        require(msg.value >= mintPrice, "Funds are not enough to mint");
        _;
    }
    // AUCTION MODIFIERS
    modifier isAuctionPossible(
        uint256 _tokenId,
        uint256 _auctionPrice,
        uint256 _auctionDuration
    ) {
        require(
            auctionStates[_tokenId] == false,
            "There is already an auction in progress for this token"
        );
        require(_auctionPrice > 0, "Auction price can not be zero");
        require(
            _auctionDuration >= 1 hours,
            "Auction duration can not less than 1 hour"
        );
        _;
    }
    modifier isAuctionEndable(uint256 _tokenId) {
        require(
            auctionStates[_tokenId] == true,
            "There is no auction in progress for this token"
        );
        require(
            block.timestamp >= auctionTimes[_tokenId] + auctionDuration,
            "Auction is not ended yet"
        );
        _;
    }
    // BIDDING MODIFIIERS
    modifier biddingAmountIsLess(uint256 _tokenId) {
        require(
            tokenToHighestBid[_tokenId].bidAmount < msg.value,
            "Your bid is lower that the current highest"
        );
        require(
            msg.value > auctionPrices[_tokenId],
            "Bid amount is less than the minimum bid price"
        );
        _;
    }
    modifier notOwner(uint256 _tokenId) {
        require(
            ownerOf(_tokenId) != msg.sender,
            "You are the owner of this token, you can not call this function"
        );
        _;
    }
    modifier isBidPossible(uint256 _tokenId) {
        require(
            auctionStates[_tokenId] == true,
            "There is no auction in progress for this token"
        );
        require(
            block.timestamp < auctionTimes[_tokenId] + auctionDuration,
            "Auction is ended you can not bid"
        );
        _;
    }

    //FUNCTIONs
    function mintToken(uint256 _tokenId)
        external
        payable
        isMintable(_tokenId)
        isDraftOpen
        isValueEnough
    {
        collectiblesMinted++;
        tokensMinted.push(_tokenId);
        _beforeTokenTransfer(address(0x0), msg.sender, _tokenId);
        _safeMint(msg.sender, _tokenId);
        emit MintSuccessful(_tokenId);
    }

    // AUCTIONS  ************ AUCTIONS*******
    function startAuction(
        uint256 _tokenId,
        uint256 _auctionDuration,
        uint256 _auctionPrice
    )
        external
        isTokenHolder(_tokenId)
        isAuctionPossible(_tokenId, _auctionPrice, _auctionDuration)
    {
        auctionTimes[_tokenId] = block.timestamp;
        auctionDuration = _auctionDuration;
        auctionPrices[_tokenId] = _auctionPrice;
        auctionStates[_tokenId] = true;
    }

    function endAuction(uint256 _tokenId)
        external
        payable
        isTokenHolder(_tokenId)
        isAuctionEndable(_tokenId)
    {
        // here end the auctions states
        auctionStates[_tokenId] = false;
        // transfer eth to the current owner (without royalty)
        if (tokenToHighestBid[_tokenId].bidderAddress != address(0x0)) {
            //  transfer 80% of the bid ammount to the owner
            payable(ownerOf(_tokenId)).transfer(
                ((tokenToHighestBid[_tokenId].bidAmount * 4) / 5)
            );
            // transfer ownership
            _beforeTokenTransfer(
                ownerOf(_tokenId),
                tokenToHighestBid[_tokenId].bidderAddress,
                _tokenId
            );
            safeTransferFrom(
                ownerOf(_tokenId),
                tokenToHighestBid[_tokenId].bidderAddress,
                _tokenId
            );
            escrowAmount = escrowAmount - tokenToHighestBid[_tokenId].bidAmount;
        }

        // transfer the token to the highest bidder
    }

    // BIDS ************************* BIDS FUNCTIONS ****
    function makeBid(uint256 _tokenId)
        external
        payable
        biddingAmountIsLess(_tokenId)
        notOwner(_tokenId)
        isBidPossible(_tokenId)
    {
        // @dev: makes a bid struct, pays back the bids with less money(previous bid)
        if (tokenToHighestBid[_tokenId].bidderAddress == address(0x0)) {
            tokenToHighestBid[_tokenId].bidderAddress = msg.sender;
            tokenToHighestBid[_tokenId].bidAmount = msg.value;
            escrowAmount = escrowAmount + msg.value;
        } else {
            // pay back previous bid
            // transfer from contract
            payable(tokenToHighestBid[_tokenId].bidderAddress).transfer(
                tokenToHighestBid[_tokenId].bidAmount
            );
            escrowAmount = escrowAmount - tokenToHighestBid[_tokenId].bidAmount;
            // store the new bid
            tokenToHighestBid[_tokenId].bidderAddress = msg.sender;
            tokenToHighestBid[_tokenId].bidAmount = msg.value;
            escrowAmount = escrowAmount + msg.value;
        }
        emit BidPlaced(_tokenId, msg.sender, msg.value);
    }

    // FUNDS&*********************FUNDS functions
    function withdrawFunds() external onlyOwner returns (bool) {
        // address(this).balance
        uint256 balanceToWithdraw = address(this).balance - escrowAmount;
        require(balanceToWithdraw > 0, "No funds to withdraw");
        // transfer the funds to the owner
        payable(artistAddress).transfer(balanceToWithdraw / 2);
        payable(developerAddress).transfer(balanceToWithdraw / 2);
        return true;
    }

    function getWithdrawAmount() external view onlyOwner returns (uint256) {
        return address(this).balance - escrowAmount;
    }

    // DRAFTS ******* DRAFT FUNCTIONS *****
    function startDraft(uint256 _draftDuration, uint256 _mintPrice)
        external
        onlyOwner
        isDraftClosed
        hasEnoughDuration(_draftDuration)
    {
        draftStartTime = block.timestamp;
        draftDuration = _draftDuration;
        mintPrice = _mintPrice;
    }

    // tokenMetadata
    function setTokenURI(uint256 _tokenId, string memory _tokenURI)
        external
        onlyOwner
    {
        _setTokenURI(_tokenId, _tokenURI);
    }

    // @param userAddress
    // @dev: anyone can call this function to get user's collection
    // @returns: token meta data with token ID

    function getUserCollection(address _userAddress)
        external
        view
        returns (MetadataMapping[] memory)
    {
        MetadataMapping[] memory metadataMapping = new MetadataMapping[](
            balanceOf(_userAddress)
        );
        for (uint256 i = 0; i < balanceOf(_userAddress); i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_userAddress, i);
            metadataMapping[i] = MetadataMapping(tokenId, tokenURI(tokenId));
        }
        return metadataMapping;
    }

    // @param: user address
    // @dev:  anyone can input address and get current auctions of that user
    // this function returns auctions of a user in a struct
    function getUserAuctions(address _userAddress)
        external
        view
        returns (Auction[] memory)
    {
        Auction[] memory auctionsOver = new Auction[](balanceOf(_userAddress));
        uint256 auctionCount = 0;
        for (uint256 i = 0; i < balanceOf(_userAddress); i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_userAddress, i);
            // for each user token check if it is in an auction
            if (auctionStates[tokenId] == true) {
                // if it is in an auction, add it to the array
                auctionsOver[auctionCount] = Auction(
                    tokenId,
                    tokenURI(tokenId),
                    auctionTimes[tokenId],
                    auctionTimes[tokenId] + auctionDuration,
                    auctionPrices[tokenId],
                    tokenToHighestBid[tokenId]
                );
                auctionCount++;
            }
        }
        Auction[] memory auctions = new Auction[](auctionCount);

        for (uint256 i = 0; i < auctionCount; i++) {
            auctions[i] = auctionsOver[i];
        }
        return auctions;
    }

    function getAllAuctions() external view returns (Auction[] memory) {
        Auction[] memory auctionsUnderWay = new Auction[](tokensMinted.length);
        uint256 auctionCount = 0;
        for (uint256 i = 0; i < tokensMinted.length; i++) {
            uint256 tokenId = tokensMinted[i];
            if (auctionStates[tokenId] == true) {
                auctionsUnderWay[auctionCount] = Auction(
                    tokenId,
                    tokenURI(tokenId),
                    auctionTimes[tokenId],
                    auctionTimes[tokenId] + auctionDuration,
                    auctionPrices[tokenId],
                    tokenToHighestBid[tokenId]
                );
                auctionCount++;
            }
        }
        Auction[] memory auctions = new Auction[](auctionCount);
        for (uint256 i = 0; i < auctionCount; i++) {
            auctions[i] = auctionsUnderWay[i];
        }
        return auctions;
    }
}
