pragma solidity ^0.4.11;

contract AbstractDAO {
  address public self;
  address public kernel;
}

/*
  function replaceKernel(address newKernel);
  function getOrgan(uint organN) returns (address organAddress);
  function replaceOrgan(address organAddress, uint organN);

  event OrganReplaced(address organAddress, uint organN);
}
*/
