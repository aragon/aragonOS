pragma solidity ^0.4.11;

import "./VariablePriceSale.sol";

contract PublicSale is VariablePriceSale {
  function instantiate(address _dao, OwnershipApp _ownershipApp, ERC20 _raiseToken, ERC20 _saleToken, uint _cap, uint _minBuy, uint _exchangeRate, bool _isInverseRate, uint64 _startBlock, uint64 _closeBlock) {
    uint64[] memory finalBlocks = new uint64[](1);
    finalBlocks[0] = _closeBlock;

    uint[] memory prices = new uint[](2);
    prices[0] = _exchangeRate;

    VariablePriceSale.instantiate(_dao, _ownershipApp, _raiseToken, _saleToken, _cap, _minBuy, _isInverseRate, _startBlock, finalBlocks, prices);
  }

  function startBlock() constant returns (uint64) {
    return periodStartBlock;
  }

  function closeBlock() constant returns (uint64) {
    return periods[0].periodEnds;
  }

  function exchangeRate() constant returns (uint) {
    return periods[0].initialPrice;
  }
}
