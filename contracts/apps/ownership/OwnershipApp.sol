pragma solidity ^0.4.11;

import "../Application.sol";
import "../../kernel/organs/ActionsOrgan.sol";
import "../../misc/Requestor.sol";
import "../../tokens/MiniMeIrrevocableVestedToken.sol";

import "zeppelin/token/ERC20.sol";

// OwnershipApp requires ActionsOrgan to be installed in DAO

// At the moment OwnershipApp intercepts MiniMe hook events, if governance app
// needs them, it has to have higher priority than ownership app

contract OwnershipConstants {
  bytes4 constant addTokenSig = bytes4(sha3('addToken(address,uint256,uint128,uint128)'));
  bytes4 constant removeTokenSig = bytes4(sha3('removeToken(address)'));
  bytes4 constant getTokenSig = bytes4(sha3('getToken(uint256)'));
  bytes4 constant issueTokensSig = bytes4(sha3('issueTokens(address,uint256)'));
  bytes4 constant grantTokensSig = bytes4(sha3('grantTokens(address,address,uint256)'));
  bytes4 constant grantVestedTokensSig = bytes4(sha3('grantVestedTokens(address,address,uint256,uint64,uint64,uint64)'));
}

contract OwnershipApp is OwnershipConstants, Application, Controller, Requestor {
  struct Token {
    address tokenAddress;
    uint128 governanceRights;
    uint128 economicRights;
  }

  Token[] tokens;
  mapping (address => uint) public tokenIdForAddress;

  event AddedToken(address tokenAddress, uint tokenId);
  event RemovedToken(address tokenAddress);
  event ChangedTokenId(address tokenAddress, uint oldTokenId, uint newTokenId);

  uint8 constant maxTokens = 20; // prevent OOGs when tokens are iterated
  uint constant holderThreshold = 1; // if owns x tokens is considered holder

  function OwnershipApp(address daoAddr)
           Application(daoAddr) {
    tokens.push(Token(0,0,0)); // to prevent index 0
  }

  function addToken(address tokenAddress, uint256 issueAmount, uint128 governanceRights, uint128 economicRights) onlyDAO {
    // Only add tokens the DAO is the controller of, so we can control it.
    // If it is a wrap over another token, the Wrap implementation can remove some functionality.
    require(MiniMeToken(tokenAddress).controller() == dao);
    uint newLength = tokens.push(Token(tokenAddress, governanceRights, economicRights));
    uint256 tokenId = newLength - 1;
    tokenIdForAddress[tokenAddress] = tokenId;

    AddedToken(tokenAddress, tokenId);

    if (issueAmount > 0) issueTokens(tokenAddress, issueAmount);
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

  function getToken(uint tokenId) constant returns (address, uint128, uint128) {
    Token token = tokens[tokenId];
    return (token.tokenAddress, token.governanceRights, token.economicRights);
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
    uint tokenCount = tokens.length;
    for (uint i = 0; i < tokenCount; i++) {
      address tknAddr = getTokenAddress(i);
      if (ERC20(tknAddr).balanceOf(_holder) >= holderThreshold) return true;
    }
    return false;
  }

  function canHandlePayload(bytes payload) constant returns (bool) {
    bytes4 sig = getSig(payload);
    return
      sig == addTokenSig ||
      sig == removeTokenSig ||
      sig == issueTokensSig ||
      sig == grantTokensSig ||
      sig == grantVestedTokensSig ||
      sig == getTokenSig ||
      isTokenControllerSignature(sig);
  }

  function isTokenControllerSignature(bytes4 sig) constant returns (bool) {
    return
      sig == 0x4a393149 || // onTransfer(...)
      sig == 0xda682aeb || // onApprove(...)
      sig == 0xf48c3054;   // proxyPayment(...)
  }
}
