pragma solidity ^0.4.8;

import "./Stock.sol";

contract GrantableStock is Stock {
  struct StockGrant {
    uint256 value;
    uint64 cliff;
    uint64 vesting;
    uint64 date;
  }

  mapping (address => StockGrant[]) public grants;

  function grantStock(address _to, uint256 _value) onlyCompany {
    transfer(_to, _value);
  }

  function grantVestedStock(address _to, uint256 _value, uint64 _cliff, uint64 _vesting) onlyCompany {
    if (_cliff < now) throw;
    if (_vesting < now) throw;
    if (_cliff > _vesting) throw;

    grants[_to].length += 1;
    grants[_to][grants[_to].length - 1] = StockGrant({date: uint64(now), value: _value, cliff: _cliff, vesting: _vesting});

    grantStock(_to, _value);
  }

  function vestedShares(StockGrant grant, uint64 time) private constant returns (uint256 vestedShares) {
    if (time < grant.cliff) return 0;
    if (time > grant.vesting) return grant.value;

    uint256 cliffShares = grant.value * uint256(grant.cliff - grant.date) / uint256(grant.vesting - grant.date);
    vestedShares = cliffShares;

    uint256 vestingShares = safeSub(grant.value, cliffShares);

    vestedShares = safeAdd(vestedShares, vestingShares * (time - uint256(grant.cliff)) / uint256(grant.vesting - grant.date));
  }

  function nonVestedShares(StockGrant grant, uint64 time) private constant returns (uint256) {
    return safeSub(grant.value, vestedShares(grant, time));
  }

  function max64(uint64 a, uint64 b) private constant returns (uint64) {
    return a >= b ? a : b;
  }

  function fullyVestedDate(address holder) constant public returns (uint64 date) {
    date = uint64(now);
    uint256 grantIndex = grants[holder].length;
    for (uint256 i = 0; i < grantIndex; i++) {
      date = max64(grants[holder][i].vesting, date);
    }
  }

  function transferrableShares(address holder, uint64 time) constant public returns (uint256 nonVested) {
    uint256 grantIndex = grants[holder].length;

    for (uint256 i = 0; i < grantIndex; i++) {
      nonVested = safeAdd(nonVested, nonVestedShares(grants[holder][i], time));
    }

    return safeSub(balances[holder], nonVested);
  }

  function transfer(address _to, uint _value) {
    if (msg.sender != company && _value > transferrableShares(msg.sender, uint64(now))) throw;

    super.transfer(_to, _value);
  }
}
