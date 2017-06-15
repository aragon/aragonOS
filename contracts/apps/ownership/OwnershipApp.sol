pragma solidity ^0.4.11;

import "../Application.sol";
import "../../kernel/organs/TokensOrgan.sol";
import "../../kernel/organs/ActionsOrgan.sol";
import "../../misc/Requestor.sol";
import "../../tokens/MiniMeIrrevocableVestedToken.sol";

import "zeppelin/token/ERC20.sol";

contract OwnershipApp is Application, Requestor {
  function addToken(address tokenAddress, uint256 issueAmount) onlyDAO {
    // Only add tokens the DAO is the controller of, so we can control it.
    // If it is a wrap over another token, the Wrap implementation can remove some functionality.
    require(MiniMeToken(tokenAddress).controller() == dao);

    uint256 tokenId = TokensOrgan(dao).addToken(tokenAddress);
    issueTokens(tokenId, issueAmount);
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
}
