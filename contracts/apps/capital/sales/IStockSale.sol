pragma solidity ^0.4.11;

contract IStockSale {
    function raiseMaximum() constant returns (uint256);
    function raiseTarget() constant returns (uint256);

    function availableTokens() constant returns (uint256);
    function isBuyingAllowed(uint256 amount) constant returns (bool);
    function isSellingAllowed(uint256 amount) constant returns (bool);
    function isFundsTransferAllowed() constant returns (bool);

    function getBuyingPrice(uint256 amount) constant returns (uint256);
    function getSellingPrice(uint256 amount) constant returns (uint256);

    function buy(address holder) payable;
    function sell();

    function transferFunds();

    event TokensBought(address indexed buyer, uint256 units, uint256 price);
    event TokensSold(address indexed buyer, uint256 units, uint256 price);
}
