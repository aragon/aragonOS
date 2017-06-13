pragma solidity ^0.4.11;

import "../Application.sol";
import "../../kernel/organs/TokensOrgan.sol";
import "zeppelin/token/ERC20.sol";

import "./sales/StockSale.sol";

// TODO: replace for real minime
contract MiniMeInterface {
  function tokenController() constant returns (address);
}

contract CapitalApp is Application {
  enum SpecialEntityStatus {
    Shareholder,
    StockSale
  }

  mapping (uint256 => address) public tokenSales;
  mapping (address => uint256) public reverseSales;
  uint256 public saleIndex;

  uint public holderThreshold = 1; // if owns x tokens is considered holder

  event NewTokenSale(address saleAddress, uint256 saleIndex, uint8 tokenIndex);

  function CapitalApp(address _dao)
           Application(_dao) {
    saleIndex = 1;
  }

  function beginTokenSale(address _saleAddress)
           onlyDAO {
    StockSale sale = StockSale(_saleAddress);
    require(sale.dao() == address(dao));

    tokenSales[saleIndex] = _saleAddress;
    reverseSales[_saleAddress] = saleIndex;
    saleIndex += 1;

    address tknAddr = TokensOrgan(dao).getToken(sale.tokenId());

    // Can only start a token sale with controlled tokens
    require(MiniMeInterface(tknAddr).tokenController() == dao);
    // TODO: Check if token is a wrapper and not allow the sale

    NewTokenSale(_saleAddress, saleIndex - 1, sale.tokenId());
  }

  // Getters

  function isHolder(address _holder) constant returns (bool) {
    uint tokenCount = TokensOrgan(dao).getTokenCount();
    for (uint i = 0; i < tokenCount; i++) {
      address tknAddr = TokensOrgan(dao).getToken(i);
      if (ERC20(tknAddr).balanceOf(_holder) >= holderThreshold) return true;
    }
    return false;
  }

  function isTokenSale(address _sale) constant returns (bool) {
    return reverseSales[_sale] > 0;
  }
}
