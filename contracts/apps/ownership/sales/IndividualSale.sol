pragma solidity ^0.4.11;

import "./TokenSale.sol";

contract IndividualSale is TokenSale {
  address public buyer;
  uint public tokensSold;
  uint public price;
  uint public expireBlock;

  function instantiate(address _dao, OwnershipApp _ownershipApp, ERC20 _raiseToken, ERC20 _saleToken, address _buyer, uint _price, uint _tokensSold, uint _expireBlock) {
    super.instantiate(_dao, _ownershipApp, _raiseToken, _saleToken);

    require(buyer == 0 && _buyer != 0);
    require(_tokensSold > 0 && _price > 0);
    require(expireBlock >= getBlockNumber());

    buyer = _buyer;
    tokensSold = _tokensSold;
    price = _price;
    expireBlock = _expireBlock;
  }

  function buy(address _holder, uint _tokenAmount) internal {
    require(getBlockNumber() < expireBlock);
    require(_holder == buyer);
    require(_tokenAmount == tokensSold * price);

    mintTokens(_holder, tokensSold);
    closeSale();

    Buy(_holder, tokensSold);
  }

  function close() {
    require(getBlockNumber() >= expireBlock);
    closeSale();
  }

  function sell(address holder, uint x) internal { throw; }
}
