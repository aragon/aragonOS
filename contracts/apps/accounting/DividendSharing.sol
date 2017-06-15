pragma solidity ^0.4.11;

import "zeppelin/token/ERC20.sol";
import "zeppelin/ownership/Ownable.sol";

contract MiniMeInterface is ERC20 {
  function createCloneToken(
        string _cloneTokenName,
        uint8 _cloneDecimalUnits,
        string _cloneTokenSymbol,
        uint _snapshotBlock,
        bool _transfersEnabled
  ) returns (address);
  uint8 public decimals;
  function destroyTokens(address _owner, uint _amount) returns (bool);
}

contract DividendSharing is Ownable {
  MiniMeInterface public dividendsToken;
  bool public enabled;

  address[] trackedTokens;

  // @param token: the token that will be used to split its assets among holders
  function DividendSharing(address token) {
    MiniMeInterface originalToken = MiniMeInterface(token);
    string memory tokenName = "D";
    bool transfersAllowed = true; // Dividend bearing tokens are tradeable
    dividendsToken = MiniMeInterface(originalToken.createCloneToken(tokenName, originalToken.decimals(), tokenName, block.number, transfersAllowed));
  }

  function tokenFallback(address _sender, address _origin, uint _value, bytes _data) returns (bool ok) {
    require(!enabled); // only allow to fill before enabling contract
    address token = msg.sender;
    // If wasn't tracking token, start tracking it
    if (indexOf(token) < 0) trackedTokens.push(token);
  }

  function setEnabled(bool _enabled) onlyOwner {
    enabled = _enabled;
  }

  function getShare() {
    getShareForHolder(msg.sender);
  }

  // Allowed to be called from the outside so contracts that call this many times can work
  function getShareForHolder(address holder) {
    require(enabled);

    uint256 balance = dividendsToken.balanceOf(holder);
    uint256 supply = dividendsToken.totalSupply();

    dividendsToken.destroyTokens(holder, balance);

    uint count = trackedTokens.length;
    for (uint256 i = 0; i < count; i++) {
      ERC20 sharingToken = ERC20(trackedTokens[i]);
      uint256 tokenBalance = sharingToken.balanceOf(this);

      uint256 holderBalance = balance * tokenBalance / supply;

      sharingToken.transfer(holder, holderBalance);
    }
  }

  function indexOf(address _t) internal returns (int256) {
    uint count = trackedTokens.length;
    for (uint256 i = 0; i < count; i++) {
      if (trackedTokens[i] == _t) return int256(i);
    }
    return -1;
  }
}
