pragma solidity 0.4.15;

import "../../contracts/apps/finance/Finance.sol";

contract FinanceMock is Finance {
    uint _mockTime = now;

    function getTimestamp() internal constant returns (uint256) { return _mockTime; }
    function mock_setTimestamp(uint i) { _mockTime = i; }
}
