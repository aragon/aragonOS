pragma solidity ^0.4.11;

import "../Application.sol";
import "../../kernel/organs/ActionsOrgan.sol";
import "../../misc/Requestor.sol";
import "../../tokens/MiniMeIrrevocableVestedToken.sol";

import "zeppelin/token/ERC20.sol";

// OwnershipApp requires ActionsOrgan to be installed in DAO

// At the moment OwnershipApp intercepts MiniMe hook events, if governance app
// needs them, it has to have higher priority than ownership app

contract OwnershipApp is Application, Controller, Requestor {
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

  uint8 constant maxTokens = 20; // prevent OOGs when tokens are iterated
  uint constant holderThreshold = 1; // if owns x tokens is considered holder

  function OwnershipApp(address daoAddr)
           Application(daoAddr) {
    tokenSales.length += 1;
    tokens.length += 1;
  }

  function addToken(address tokenAddress, uint256 issueAmount, uint128 governanceRights, uint128 economicRights) onlyDAO {
    // Only add tokens the DAO is the controller of, so we can control it.
    // If it is a wrap over another token, the Wrap implementation can remove some functionality.
    require(MiniMeToken(tokenAddress).controller() == dao);
    uint newLength = tokens.push(Token(tokenAddress, governanceRights, economicRights, false));
    uint256 tokenId = newLength - 1;
    tokenIdForAddress[tokenAddress] = tokenId;

    updateIsController(tokenAddress);
    AddedToken(tokenAddress, tokenId);

    if (issueAmount > 0) issueTokens(tokenAddress, issueAmount);
  }

  bytes4 constant createTokenSaleSig = bytes4(sha3('createTokenSale(address,address,bool)'));
  function createTokenSale(address saleAddress, address tokenAddress, bool canDestroy) onlyDAO only_controlled(tokenAddress) {
    uint salesLength = tokenSales.push(TokenSale(saleAddress, tokenAddress, canDestroy, false));
    uint saleId = salesLength - 1; // last item is newly added sale
    tokenSaleForAddress[saleAddress] = saleId;

    NewTokenSale(saleAddress, saleId);
  }

  bytes4 constant closeTokenSaleSig = bytes4(sha3('closeTokenSale(address)'));
  function closeTokenSale(address saleAddress) onlyDAO {
    doCloseSale(saleAddress);
  }

  bytes4 constant saleMintSig = bytes4(sha3('sale_mintTokens(address,address,uint256)'));
  function sale_mintTokens(address tokenAddress, address recipient, uint amount) only_active_sale(tokenAddress) {
    MiniMeToken(this).generateTokens(recipient, amount);
    executeRequestorAction(tokenAddress);
  }

  bytes4 constant saleDestroySig = bytes4(sha3('sale_destroyTokens(address,address,uint256)'));
  function sale_destroyTokens(address tokenAddress, address holder, uint amount) only_active_sale(tokenAddress) {
    require(tokenSales[tokenSaleForAddress[getSender()]].canDestroy);
    MiniMeToken(this).destroyTokens(holder, amount);
    executeRequestorAction(tokenAddress);
  }

  bytes4 constant saleCloseSig = bytes4(sha3('sale_closeSale()'));
  function sale_closeSale() {
    doCloseSale(getSender());
  }

  function doCloseSale(address _saleAddress) internal {
    uint saleId = tokenSaleForAddress[_saleAddress];
    require(saleId > 0);
    tokenSales[saleId].closed = true;

    TokenSaleClosed(tokenSales[saleId].saleAddress, saleId);
  }

  // @dev Updates whether an added token controller state has changed
  // can be called by anyone at any time
  function updateIsController(address tokenAddress) {
    Token token = tokens[tokenIdForAddress[tokenAddress]];
    token.isController = MiniMeToken(token.tokenAddress).controller() == dao;
  }

  function removeToken(address tokenAddress) onlyDAO {
    uint tokenId = tokenIdForAddress[tokenAddress];
    require(tokenId > 0);
    if (tokens.length > 1) {
      tokens[tokenId] = tokens[tokens.length - 1];
      tokenIdForAddress[tokens[tokenId].tokenAddress] = tokenId;

      ChangedTokenId(tokens[tokenId].tokenAddress, tokens.length - 1, tokenId);
    }
    tokenIdForAddress[tokens[tokens.length - 1].tokenAddress] = 0;
    tokens.length--;

    RemovedToken(tokenAddress);
  }

  function getTokenCount() constant returns (uint) {
    return tokens.length - 1; // index 0 is empty
  }

  function getToken(uint tokenId) constant returns (address, uint128, uint128, bool) {
    Token token = tokens[tokenId];
    return (token.tokenAddress, token.governanceRights, token.economicRights, token.isController);
  }

  function getTokenSaleCount() constant returns (uint) {
    return tokenSales.length - 1; // index 0 is empty
  }

  function getTokenSale(uint tokenSaleId) constant returns (address, address, bool, bool) {
    TokenSale tokenSale = tokenSales[tokenSaleId];
    return (tokenSale.saleAddress, tokenSale.tokenAddress, tokenSale.canDestroy, tokenSale.closed);
  }

  function issueTokens(address tokenAddress, uint256 amount) onlyDAO {
    require(tokenIdForAddress[tokenAddress] > 0);
    // TODO: get rid of this MEGA HACK.
    // Requestor should be an external contract, but having trouble because solidity
    // doesn't like variable sized types for returns.
    // If this contract needed to have another fallback it wouldn't work.
    MiniMeToken(this).generateTokens(dao, amount);
    executeRequestorAction(tokenAddress);
  }

  function grantTokens(address tokenAddress, address recipient, uint256 amount) onlyDAO {
    require(tokenIdForAddress[tokenAddress] > 0);
    MiniMeToken(this).transfer(recipient, amount);
    executeRequestorAction(tokenAddress);
  }

  function grantVestedTokens(address tokenAddress, address recipient, uint256 amount, uint64 start, uint64 cliff, uint64 vesting) onlyDAO {
    require(tokenIdForAddress[tokenAddress] > 0);
    MiniMeIrrevocableVestedToken(this).grantVestedTokens(recipient, amount, start, cliff, vesting);
    executeRequestorAction(tokenAddress);
  }

  function executeRequestorAction(address to) internal {
    ActionsOrgan(dao).performAction(to, getData());
  }

  function getTokenAddress(uint256 i) constant returns (address) {
    var (tokenAddr,,) = getToken(i);
    return tokenAddr;
  }

  function proxyPayment(address _owner) payable returns (bool) {
    return false;
  }

  function onTransfer(address _from, address _to, uint _amount) returns (bool) {
    return true;
  }

  function onApprove(address _owner, address _spender, uint _amount) returns (bool) {
    return true;
  }

  function isHolder(address _holder) constant returns (bool) {
    uint tokenCount = getTokenCount();
    for (uint i = 1; i <= tokenCount; i++) {
      address tknAddr = getTokenAddress(i);
      if (ERC20(tknAddr).balanceOf(_holder) >= holderThreshold) return true;
    }
    return false;
  }

  modifier only_controlled(address tokenAddress) {
    require(tokens[tokenIdForAddress[tokenAddress]].isController);
    _;
  }

  modifier only_active_sale(address tokenAddress) {
    uint saleId = tokenSaleForAddress[getSender()];
    require(saleId > 0);
    TokenSale sale = tokenSales[saleId];
    require(!sale.closed && sale.tokenAddress == tokenAddress);
    _;
  }
}
