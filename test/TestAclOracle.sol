pragma solidity 0.4.18;

import "truffle/Assert.sol";
import "../contracts/acl/ACL.sol";
import "../contracts/acl/IACLOracle.sol";


contract ErroringOracle is IACLOracle {
    function canPerform(address who, address where, bytes32 what, uint256[] how) public view returns (bool) {
        // Force error
        require(false);
    }
}


contract TestAclOracle is ACL {
    IACLOracle oracle;

    function before() {
        oracle = new ErroringOracle();
    }

    function testCheckOracleEmptyReturn() {
        uint256[] memory empty = new uint256[](0);
        bool result = checkOracle(oracle, address(0), address(0), bytes32(0), empty);
        Assert.isFalse(result, "should return false");
    }
}
