pragma solidity 0.4.18;

import "truffle/Assert.sol";
import "../contracts/acl/ACL.sol";


contract Oracle {
    function () public {
    }
}

contract TestAclOracle is ACL {
    Oracle oracle;

    function before() {
        oracle = new Oracle();
    }

    function testCheckOracleEmptyReturn() {
        uint256[] memory empty = new uint256[](0);
        bool result = checkOracle(address(oracle), address(0), address(0), bytes32(0), empty);
        Assert.isFalse(result, "should return false");
    }
}
