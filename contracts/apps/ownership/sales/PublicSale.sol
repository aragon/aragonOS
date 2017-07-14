pragma solidity ^0.4.11;

import "./TokenSale.sol";

contract PublicSale is TokenSale {
  uint public cap;             // max tokens sale can get
  uint public minBuy;          // min amount to process sale
  uint public exchangeRate;    // number of tokens purchased per minimum token amount
  bool public isInverseRate;   // divide instead of multiply exchange rate

  uint64 public startBlock;      // first block that accepts contributions
  uint64 public closeBlock;      // from closeBlock on no more contributions are allowed

  uint public totalCollected;

  function instantiate(address _dao, OwnershipApp _ownershipApp, ERC20 _raiseToken, ERC20 _saleToken, uint _cap, uint _minBuy, uint _exchangeRate, bool _isInverseRate, uint64 _startBlock, uint64 _closeBlock) {
    super.instantiate(_dao, _ownershipApp, _raiseToken, _saleToken);

    require(cap == 0 && _cap != 0); // checking it is the first time instantiate is called
    require(_exchangeRate > 0);
    require(getBlockNumber() <= _startBlock && _startBlock < _closeBlock);

    cap = _cap;
    minBuy = _minBuy;
    exchangeRate = _exchangeRate;
    isInverseRate = _isInverseRate;
    startBlock = _startBlock;
    closeBlock = _closeBlock;
  }

  function getAcquiredTokens(uint _amount) constant returns (uint) {
    return isInverseRate ? _amount / exchangeRate : _amount * exchangeRate;
  }

  function buy(address _holder, uint _tokenAmount) internal {
    require(getBlockNumber() >= startBlock && getBlockNumber() < closeBlock);
    require(_tokenAmount >= minBuy);

    uint allowedAmount = _tokenAmount;
    if (totalCollected + _tokenAmount > cap) allowedAmount = cap - totalCollected;

    totalCollected += allowedAmount;

    uint boughtTokens = getAcquiredTokens(allowedAmount);
    mintTokens(_holder, boughtTokens);

    Buy(_holder, boughtTokens);

    if (allowedAmount < _tokenAmount) raiseToken.transfer(_holder, _tokenAmount - allowedAmount);
    if (totalCollected == cap) closeSale();
  }

  function close() {
    require(getBlockNumber() >= closeBlock);
    closeSale();
  }

  function sell(address holder, uint x) internal { throw; }
}
