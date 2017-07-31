pragma solidity ^0.4.11;

/**
* @author Jorge Izquierdo (Aragon)
* @description OwnershipApp requires ActionsOrgan to be installed in DAO
* At the moment OwnershipApp intercepts MiniMe hook events.
*/

import "../Application.sol";
import "../../organs/ActionsOrgan.sol";
import "../../misc/Requestor.sol";
import "../../tokens/MiniMeIrrevocableVestedToken.sol";

import "zeppelin/token/ERC20.sol";

import "./IOwnershipApp.sol";

contract OwnershipApp is Application, IOwnershipApp, Requestor {
    struct Token {
        address tokenAddress;
        uint128 governanceRights;
        uint128 economicRights;
        bool isController;
    }

    struct TokenSale {
        address saleAddress;
        address tokenAddress;
        bool canDestroy;
        bool closed;
    }

    Token[] tokens;
    mapping (address => uint) public tokenIdForAddress;

    TokenSale[] tokenSales;
    mapping (address => uint) public tokenSaleForAddress;

    event AddedToken(address tokenAddress, uint tokenId);
    event RemovedToken(address tokenAddress);
    event ChangedTokenId(address tokenAddress, uint oldTokenId, uint newTokenId);

    event NewTokenSale(address saleAddress, uint saleId);
    event TokenSaleClosed(address saleAddress, uint saleId);

    uint8 constant MAX_TOKENS = 20; // prevent OOGs when tokens are iterated
    uint constant HOLDER_THRESHOLD = 1; // if owns x tokens is considered holder

    function OwnershipApp(address daoAddr)
    Application(daoAddr)
    {
    }

    function init() internal {
        assert(tokenSales.length == 0 && tokens.length == 0); // check init can only happen once
        tokenSales.length += 1;
        tokens.length += 1;
    }

    /**
    * @notice Add token at `_tokenAddress` as a governance token to the organization
    * @dev If added token is not controlled by DAO, it will fail to issue tokens
    * @param _tokenAddress Address for the minime token
    * @param _issueAmount Tokens to be issued and assigned to the DAO
    * @param _governanceRights Factor for governance rights for token
    * @param _economicRights Factor for economic rights for token
    */
    function addToken(
        address _tokenAddress,
        uint256 _issueAmount,
        uint128 _governanceRights,
        uint128 _economicRights
    )
    onlyDAO
    external
    {
        uint newLength = tokens.push(
            Token(
                _tokenAddress,
                _governanceRights,
                _economicRights,
                false
            )
        );
        uint256 tokenId = newLength - 1;
        tokenIdForAddress[_tokenAddress] = tokenId;

        updateIsController(_tokenAddress);
        AddedToken(_tokenAddress, tokenId);

        if (_tokenAddress > 0)
            issueTokens(_tokenAddress, _issueAmount);
    }

    /**
    * @notice Remove token at `_tokenAddress` as a governance token to the organization
    * @param _tokenAddress token address being removed
    */
    function removeToken(address _tokenAddress) onlyDAO external {
        uint tokenId = tokenIdForAddress[_tokenAddress];
        require(tokenId > 0);
        if (tokens.length > 1) {
            tokens[tokenId] = tokens[tokens.length - 1];
            tokenIdForAddress[tokens[tokenId].tokenAddress] = tokenId;

            ChangedTokenId(tokens[tokenId].tokenAddress, tokens.length - 1, tokenId);
        }
        tokenIdForAddress[tokens[tokens.length - 1].tokenAddress] = 0;
        tokens.length--;

        RemovedToken(_tokenAddress);
    }

    /**
    * @notice Issue `_amount` of `_tokenAddress` tokens for the DAO
    * @param _tokenAddress token address being issued
    * @param _amount amount of tokens in the smallest unit
    */
    function issueTokens(address _tokenAddress, uint256 _amount) onlyDAO {
        require(tokenIdForAddress[_tokenAddress] > 0);
        // TODO: get rid of this MEGA HACK.
        // Requestor should be an external contract, but having trouble because solidity
        // doesn't like variable sized types for returns.
        // If this contract needed to have another fallback it wouldn"t work.
        MiniMeToken(this).generateTokens(dao, _amount);
        executeRequestorAction(_tokenAddress);
    }

    /**
    * @notice Assign `_amount` of `_tokenAddress` tokens to `_recipient`
    * @param _tokenAddress token address being issued
    * @param _recipient address receiving the tokens
    * @param _amount amount of tokens in the smallest unit
    */
    function grantTokens(address _tokenAddress, address _recipient, uint256 _amount) onlyDAO external {
        require(tokenIdForAddress[_tokenAddress] > 0);
        MiniMeToken(this).transfer(_recipient, _amount);
        executeRequestorAction(_tokenAddress);
    }

    /**
    * @notice Assign `_amount` of `_tokenAddress` tokens to `_recipient` with a `_cliff` cliff and `_vesting` starting `_start`
    * @param _tokenAddress token address being issued
    * @param _recipient address receiving the tokens
    * @param _amount amount of tokens in the smallest unit
    * @param _start timestamp where vesting calculation starts (can be a past date)
    * @param _cliff timestamp in which the proportional amount of tokens are unlocked for the first time
    * @param _vesting timestamp in which all tokens are transferable
    */
    function grantVestedTokens(
        address _tokenAddress,
        address _recipient,
        uint256 _amount,
        uint64 _start,
        uint64 _cliff,
        uint64 _vesting
    )
    onlyDAO
    external
    {
        require(tokenIdForAddress[_tokenAddress] > 0);
        MiniMeIrrevocableVestedToken(this).grantVestedTokens(
            _recipient,
            _amount,
            _start,
            _cliff,
            _vesting
        );
        executeRequestorAction(_tokenAddress);
    }

    /**
    * @notice Create a token sale with sale contract at address `_saleAddress`
    * @param _saleAddress contract that handles sale
    * @param _tokenAddress address of the token being sold (must be controlled by DAO)
    * @param _canDestroy whether the token sale has power to destroy holder's tokens
    */
    function createTokenSale(
        address _saleAddress,
        address _tokenAddress,
        bool _canDestroy
    )
    onlyDAO only_controlled(_tokenAddress)
    external
    {
        uint salesLength = tokenSales.push(
            TokenSale(
                _saleAddress,
                _tokenAddress,
                _canDestroy,
                false
            )
        );
        uint saleId = salesLength - 1; // last item is newly added sale
        tokenSaleForAddress[_saleAddress] = saleId;

        NewTokenSale(_saleAddress, saleId);
    }

    /**
    * @notice Forces the close of token sale at address `_saleAddress`
    * @param _saleAddress token sale being closed
    */
    function closeTokenSale(address _saleAddress) onlyDAO external {
        doCloseSale(_saleAddress);
    }

    /**
    * @dev Updates whether an added token controller state has changed
    * can be called by anyone at any time to update its state
    */
    function updateIsController(address _tokenAddress) {
        Token storage token = tokens[tokenIdForAddress[_tokenAddress]];
        token.isController = MiniMeToken(token.tokenAddress).controller() == dao;
    }

    function getTokenCount() constant returns (uint) {
        return tokens.length - 1; // index 0 is empty
    }

    function getToken(uint tokenId) constant returns (address, uint128, uint128, bool) {
        Token storage token = tokens[tokenId];
        return (token.tokenAddress, token.governanceRights, token.economicRights, token.isController);
    }

    function getTokenSaleCount() constant returns (uint) {
        return tokenSales.length - 1; // index 0 is empty
    }

    function getTokenSale(uint tokenSaleId) constant returns (address, address, bool, bool) {
        TokenSale storage tokenSale = tokenSales[tokenSaleId];
        return (
            tokenSale.saleAddress,
            tokenSale.tokenAddress,
            tokenSale.canDestroy,
            tokenSale.closed
        );
    }

    /**
    * @dev Method called by sale to mint tokens
    */
    function sale_mintTokens(address _tokenAddress, address recipient, uint amount) only_active_sale(_tokenAddress) external {
        MiniMeToken(this).generateTokens(recipient, amount);
        executeRequestorAction(_tokenAddress);
    }

    /**
    * @dev Method called by sale to destroy tokens if allowed to
    */
    function sale_destroyTokens(address _tokenAddress, address holder, uint amount) only_active_sale(_tokenAddress) external {
        require(tokenSales[tokenSaleForAddress[getSender()]].canDestroy);
        MiniMeToken(this).destroyTokens(holder, amount);
        executeRequestorAction(_tokenAddress);
    }

    /**
    * @dev Method called by sale to close itself
    */
    function sale_closeSale() external {
        doCloseSale(getSender());
    }

    function executeRequestorAction(address to) internal {
        ActionsOrgan(dao).performAction(to, getData());
    }

    function getTokenAddress(uint256 i) constant returns (address) {
        var (tokenAddr,,) = getToken(i);
        return tokenAddr;
    }

    function proxyPayment(address _owner) payable returns (bool) {
        _owner; // silence unused variable warning
        return false;
    }

    function onTransfer(address _from, address _to, uint _amount) returns (bool) {
        _from; _to; _amount; // silence unused variable warning
        return true;
    }

    function onApprove(address _owner, address _spender, uint _amount) returns (bool) {
        _owner; _spender; _amount; // silence unused variable warning
        return true;
    }

    function isHolder(address _holder) constant returns (bool) {
        uint tokenCount = getTokenCount();
        for (uint i = 1; i <= tokenCount; i++) {
            address tknAddr = getTokenAddress(i);
            if (ERC20(tknAddr).balanceOf(_holder) >= HOLDER_THRESHOLD)
                return true;
        }
        return false;
    }

    function doCloseSale(address _saleAddress) internal {
        uint saleId = tokenSaleForAddress[_saleAddress];
        require(saleId > 0);
        require(!tokenSales[saleId].closed);
        tokenSales[saleId].closed = true;

        TokenSaleClosed(tokenSales[saleId].saleAddress, saleId);
    }

    modifier only_controlled(address _tokenAddress) {
        require(tokens[tokenIdForAddress[_tokenAddress]].isController);
        _;
    }

    modifier only_active_sale(address _tokenAddress) {
        uint saleId = tokenSaleForAddress[getSender()];
        require(saleId > 0);
        TokenSale storage sale = tokenSales[saleId];
        require(!sale.closed && sale.tokenAddress == _tokenAddress);
        _;
    }
}
