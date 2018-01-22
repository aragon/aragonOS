pragma solidity 0.4.18;

import "truffle/Assert.sol";
import "../contracts/acl/ACL.sol";
import "../contracts/acl/ACLSyntaxSugar.sol";


contract TestACLInterpreter is ACL {
    function testEqualityUint() public {
        // Assert param 0 is equal to 10, given that params are [10, 11]
        assertEval(arr(uint256(10), 11), 0, Op.eq, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.eq, 10, false);
        assertEval(arr(uint256(10), 11), 1, Op.eq, 11, true);
    }

    function testEqualityAddr() public {
        assertEval(arr(msg.sender), 0, Op.eq, uint256(msg.sender), true);
        assertEval(arr(msg.sender), 0, Op.eq, uint256(this), false);
    }

    function testEqualityBytes() public {
        assertEval(arr(keccak256("hi")), 0, Op.eq, uint256(keccak256("hi")), true);
        assertEval(arr(keccak256("hi")), 0, Op.eq, uint256(keccak256("bye")), false);
    }

    function testInequalityUint() public {
        assertEval(arr(uint256(10), 11), 0, Op.neq, 10, false);
        assertEval(arr(uint256(10), 11), 1, Op.neq, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.neq, 11, false);
    }

    function testInequalityBytes() public {
        assertEval(arr(keccak256("hi")), 0, Op.neq, uint256(keccak256("hi")), false);
        assertEval(arr(keccak256("hi")), 0, Op.neq, uint256(keccak256("bye")), true);
    }

    function testInequalityAddr() public {
        assertEval(arr(msg.sender), 0, Op.neq, uint256(msg.sender), false);
        assertEval(arr(msg.sender), 0, Op.neq, uint256(this), true);
    }

    function testGreatherThan() public {
        assertEval(arr(uint256(10), 11), 0, Op.gt, 9, true);
        assertEval(arr(uint256(10), 11), 0, Op.gt, 10, false);
        assertEval(arr(uint256(10), 11), 1, Op.gt, 10, true);
    }

    function testLessThan() public {
        assertEval(arr(uint256(10), 11), 0, Op.lt, 9, false);
        assertEval(arr(uint256(9), 11), 0, Op.lt, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.lt, 10, false);
    }

    function testGreatherThanOrEqual() public {
        assertEval(arr(uint256(10), 11), 0, Op.gte, 9, true);
        assertEval(arr(uint256(10), 11), 0, Op.gte, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.gte, 12, false);
    }

    function testLessThanOrEqual() public {
        assertEval(arr(uint256(10), 11), 0, Op.lte, 9, false);
        assertEval(arr(uint256(9), 11), 0, Op.lte, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.lte, 11, true);
    }

    function testAnd() public {
        assertEval(arr(uint256(1)), 0, Op.and, 1, true);
        assertEval(arr(uint256(1)), 0, Op.and, 0, false);
        assertEval(arr(uint256(0)), 0, Op.and, 1, false);
        assertEval(arr(uint256(0)), 0, Op.or, 0, false);
    }

    function testOr() public {
        assertEval(arr(uint256(1)), 0, Op.or, 1, true);
        assertEval(arr(uint256(1)), 0, Op.or, 0, true);
        assertEval(arr(uint256(0)), 0, Op.or, 1, true);
        assertEval(arr(uint256(0)), 0, Op.or, 0, false);
    }

    function testXor() public {
        assertEval(arr(uint256(1)), 0, Op.xor, 1, false);
        assertEval(arr(uint256(1)), 0, Op.xor, 0, true);
        assertEval(arr(uint256(0)), 0, Op.xor, 1, true);
        assertEval(arr(uint256(0)), 0, Op.xor, 0, false);
    }

    function testSender() public {
        assertEval(arr(), SENDER_PARAM_ID, Op.eq, uint256(msg.sender), true);
        assertEval(arr(), SENDER_PARAM_ID, Op.eq, uint256(0x1234), false);
    }

    function testTimestamp() public {
        assertEval(arr(), TIMESTAMP_PARAM_ID, Op.eq, uint256(block.timestamp), true);
        assertEval(arr(), TIMESTAMP_PARAM_ID, Op.eq, uint256(1), false);
        assertEval(arr(), TIMESTAMP_PARAM_ID, Op.gt, uint256(1), true);
    }

    function testBlockNumber() public {
        assertEval(arr(), BLOCK_NUMBER_PARAM_ID, Op.eq, uint256(block.number), true);
        assertEval(arr(), BLOCK_NUMBER_PARAM_ID, Op.eq, uint256(1), false);
        assertEval(arr(), BLOCK_NUMBER_PARAM_ID, Op.gt, uint256(block.number - 1), true);
    }

    function testOracle() public {
        assertEval(arr(), ORACLE_PARAM_ID, Op.eq, uint256(new AcceptOracle()), true);
        assertEval(arr(), ORACLE_PARAM_ID, Op.eq, uint256(new RejectOracle()), false);
        assertEval(arr(), ORACLE_PARAM_ID, Op.neq, uint256(new RejectOracle()), true);
    }

    function assertEval(uint256[] args, uint8 argId, Op op, uint256 value, bool expected) internal {
        bool allow = evalParam(Param(argId, uint8(op), uint240(value)), address(0), address(0), bytes32(0), args);

        Assert.equal(allow, expected, "eval got unexpected result");
    }
}


contract AcceptOracle is ACLOracle {
    function canPerform(address who, address where, bytes32 what) public view returns (bool) {
        return true;
    }
}


contract RejectOracle is ACLOracle {
    function canPerform(address who, address where, bytes32 what) public view returns (bool) {
        return false;
    }
}
