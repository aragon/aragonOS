pragma solidity ^0.4.11;

import "../Application.sol";
import "../../kernel/organs/TokensOrgan.sol";
import "../../kernel/organs/ActionsOrgan.sol";
import "../../misc/Requestor.sol";
import "../../tokens/MiniMeIrrevocableVestedToken.sol";

import "zeppelin/token/ERC20.sol";

// OwnershipApp requires TokensOrgan and ActionsOrgan to be installed in DAO

// At the moment OwnershipApp intercepts MiniMe hook events, if governance app
// needs them, it has to have higher priority than ownership app

contract OwnershipApp is Application, Controller, Requestor {
  struct Token {
    address tokenAddress;
    uint128 governanceRights;
    uint128 economicRights;
  }

  Token[] tokens;
  uint8 constant maxTokens = 20; // prevent OOGs when tokens are iterated

  function OwnershipApp(address daoAddr)
           Application(daoAddr) {}

  function addOrgToken(address tokenAddress, uint256 issueAmount, uint128 governanceRights, uint128 economicRights) onlyDAO {
    // Only add tokens the DAO is the controller of, so we can control it.
    // If it is a wrap over another token, the Wrap implementation can remove some functionality.
    require(MiniMeToken(tokenAddress).controller() == dao);
    uint256 tokenId = TokensOrgan(dao).addToken(tokenAddress);
    uint newLength = tokens.push(Token(tokenAddress, governanceRights, economicRights));
    assert(tokenId == newLength - 1 && newLength <= maxTokens);
    if (issueAmount > 0) issueTokens(tokenId, issueAmount);
  }

  function removeOrgToken(uint256 tokenId) onlyDAO {
    TokensOrgan(dao).removeToken(tokenId);
    if (tokens.length > 1) tokens[tokenId] = tokens[tokens.length - 1];
    tokens.length--;
  }

  function getTokenCount() constant returns (uint) {
    return tokens.length;
  }

  function getOrgToken(uint tokenId) constant returns (address, uint128, uint128) {
    Token token = tokens[tokenId];
    return (token.tokenAddress, token.governanceRights, token.economicRights);
  }

  function issueTokens(uint256 tokenId, uint256 amount) onlyDAO {
    address tokenAddress = getTokenAddress(tokenId);
    // TODO: get rid of this MEGA HACK.
    // Requestor should be an external contract, but having trouble because solidity
    // doesn't like variable sized types for returns.
    // If this contract needed to have another fallback it wouldn't work.
    MiniMeToken(this).generateTokens(dao, amount);
    executeRequestorAction(tokenAddress);
  }

  function grantTokens(uint256 tokenId, uint256 amount, address recipient) onlyDAO {
    address tokenAddress = getTokenAddress(tokenId);
    MiniMeToken(this).transfer(recipient, amount);
    executeRequestorAction(tokenAddress);
  }

  function grantVestedTokens(uint256 tokenId, uint256 amount, address recipient, uint64 start, uint64 cliff, uint64 vesting) onlyDAO {
    address tokenAddress = getTokenAddress(tokenId);
    MiniMeIrrevocableVestedToken(this).grantVestedTokens(recipient, amount, start, cliff, vesting);
    executeRequestorAction(tokenAddress);
  }

  function executeRequestorAction(address to) internal {
    ActionsOrgan(dao).performAction(to, getData());
  }

  function getTokenAddress(uint256 i) constant returns (address) {
    var (tokenAddr,,) = getOrgToken(i);
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
      sig == 0x96527cf2 || // addOrgToken(address,uint256,uint128,uint128)
      sig == 0x0418adf7 || // removeOrgToken(uint256)
      sig == 0x54e35ba2 || // issueTokens(address,uint256)
      sig == 0xec680c49 || // grantTokens(...)
      sig == 0x4a11f5bb || // grantVestedTokens(...)
      sig == 0xf594ba59 || // getOrgToken(uint256)
      isTokenControllerSignature(sig);
  }

  function isTokenControllerSignature(bytes4 sig) constant returns (bool) {
    return
      sig == 0x4a393149 || // onTransfer(...)
      sig == 0xda682aeb || // onApprove(...)
      sig == 0xf48c3054;   // proxyPayment(...)
  }
}
