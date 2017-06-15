pragma solidity ^0.4.11;

import "../Application.sol";
import "../../kernel/organs/TokensOrgan.sol";
import "../../kernel/organs/ActionsOrgan.sol";
import "../../misc/Requestor.sol";
import "../../tokens/MiniMeIrrevocableVestedToken.sol";

import "zeppelin/token/ERC20.sol";

// OwnershipApp requires TokensOrgan and ActionsOrgan to be installed in DAO

// TODO: Add token controller functions so it doesn't fail
contract OwnershipApp is Application, Requestor {
  function OwnershipApp(address daoAddr)
           Application(daoAddr) {}

  function addToken(address tokenAddress, uint256 issueAmount) onlyDAO {
    // Only add tokens the DAO is the controller of, so we can control it.
    // If it is a wrap over another token, the Wrap implementation can remove some functionality.

    require(MiniMeToken(tokenAddress).controller() == dao);
    uint256 tokenId = TokensOrgan(dao).addToken(tokenAddress);
    if (issueAmount > 0) issueTokens(tokenId, issueAmount);
  }

  function removeToken(uint256 tokenId) onlyDAO {
    TokensOrgan(dao).removeToken(tokenId);
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
    return TokensOrgan(dao).getToken(i);
  }

  function canHandlePayload(bytes payload) constant returns (bool) {
      bytes4 sig = getSig(payload);
      return
        sig == 0xaf81c5b9 || // addToken(address,uint256)
        sig == 0x36c5d724 || // removeToken(uint256)
        sig == 0x54e35ba2 || // issueTokens(address,uint256)
        sig == 0xec680c49 || // grantTokens(...)
        sig == 0x4a11f5bb;   // grantVestedTokens(...)
  }
}
