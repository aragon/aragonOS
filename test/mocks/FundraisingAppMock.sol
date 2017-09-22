pragma solidity 0.4.15;

import "../../contracts/apps/fundraising/FundraisingApp.sol";

contract FundraisingAppMock is FundraisingApp {
    uint _mockTime = now;

    function getTimestamp() internal constant returns (uint256) { return _mockTime; }
    function mock_setTimestamp(uint i) { _mockTime = i; }
}
