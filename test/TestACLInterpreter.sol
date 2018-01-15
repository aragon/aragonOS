pragma solidity 0.4.18;

import "truffle/Assert.sol";
import "../contracts/kernel/ACL.sol";


contract TestACLInterpreter is ACL {
    function testEqualityUint() public {
        // Assert param 0 is equal to 10, given that params are [10, 11]
        assertEval(arr(10, 11), 0, Op.eq, 10, true);
        assertEval(arr(10, 11), 1, Op.eq, 10, false);
        assertEval(arr(10, 11), 1, Op.eq, 11, true);
    }

    function testEqualityAddr() public {
        assertEval(arr(msg.sender), 0, Op.eq, uint256(msg.sender), true);
    }

    function testEqualityBytes() public {
        assertEval(arr(block), 0, Op.eq, uint256(msg.sender), true);
    }

    function testInequality() public {
        assertEval(arr(10, 11), 0, Op.neq, 10, false);
        assertEval(arr(10, 11), 1, Op.neq, 10, true);
        assertEval(arr(10, 11), 1, Op.neq, 11, false);
    }

    function assertEval(uint256[] args, uint8 argId, Op op, uint256 value, bool expected) internal {
        bool allow = evalParam(Param(argId, uint8(op), uint240(value)), address(0), address(0), bytes32(0), args);

        Assert.equal(allow, expected, "eval got unexpected result");
    }

    function arr() internal view returns (uint256[] r) {}

    function arr(uint256 a) internal view returns (uint256[] r) {
        r = new uint256[](1);
        r[0] = a;
    }

    function arr(address a) internal view returns (uint256[] r) {
        r = new uint256[](1);
        r[0] = uint256(a);
    }

    function arr(uint256 a, uint256 b) internal view returns (uint256[] r) {
        r = new uint256[](2);
        r[0] = a;
        r[1] = b;
    }
}
