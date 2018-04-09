pragma solidity 0.4.18;

import "truffle/Assert.sol";
import "./helpers/ACLHelper.sol";


contract TestACLInterpreter is ACL, ACLHelper {
    function testEqualityUint() public {
        // Assert param 0 is equal to 10, given that params are [10, 11]
        assertEval(arr(uint256(10), 11), 0, Op.EQ, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.EQ, 10, false);
        assertEval(arr(uint256(10), 11), 1, Op.EQ, 11, true);
    }

    function testEqualityAddr() public {
        assertEval(arr(msg.sender), 0, Op.EQ, uint256(msg.sender), true);
        assertEval(arr(msg.sender), 0, Op.EQ, uint256(this), false);
    }

    function testEqualityBytes() public {
        assertEval(arr(keccak256("hi")), 0, Op.EQ, uint256(keccak256("hi")), true);
        assertEval(arr(keccak256("hi")), 0, Op.EQ, uint256(keccak256("bye")), false);
    }

    function testInequalityUint() public {
        assertEval(arr(uint256(10), 11), 0, Op.NEQ, 10, false);
        assertEval(arr(uint256(10), 11), 1, Op.NEQ, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.NEQ, 11, false);
    }

    function testInequalityBytes() public {
        assertEval(arr(keccak256("hi")), 0, Op.NEQ, uint256(keccak256("hi")), false);
        assertEval(arr(keccak256("hi")), 0, Op.NEQ, uint256(keccak256("bye")), true);
    }

    function testInequalityAddr() public {
        assertEval(arr(msg.sender), 0, Op.NEQ, uint256(msg.sender), false);
        assertEval(arr(msg.sender), 0, Op.NEQ, uint256(this), true);
    }

    function testGreatherThan() public {
        assertEval(arr(uint256(10), 11), 0, Op.GT, 9, true);
        assertEval(arr(uint256(10), 11), 0, Op.GT, 10, false);
        assertEval(arr(uint256(10), 11), 1, Op.GT, 10, true);
    }

    function testLessThan() public {
        assertEval(arr(uint256(10), 11), 0, Op.LT, 9, false);
        assertEval(arr(uint256(9), 11), 0, Op.LT, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.LT, 10, false);
    }

    function testGreatherThanOrEqual() public {
        assertEval(arr(uint256(10), 11), 0, Op.GTE, 9, true);
        assertEval(arr(uint256(10), 11), 0, Op.GTE, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.GTE, 12, false);
    }

    function testLessThanOrEqual() public {
        assertEval(arr(uint256(10), 11), 0, Op.LTE, 9, false);
        assertEval(arr(uint256(9), 11), 0, Op.LTE, 10, true);
        assertEval(arr(uint256(10), 11), 1, Op.LTE, 11, true);
    }

    function testSender() public {
        assertEval(arr(), SENDER_PARAM_ID, Op.EQ, uint256(msg.sender), true);
        assertEval(arr(), SENDER_PARAM_ID, Op.EQ, uint256(0x1234), false);
    }

    function testTimestamp() public {
        assertEval(arr(), TIMESTAMP_PARAM_ID, Op.EQ, uint256(block.timestamp), true);
        assertEval(arr(), TIMESTAMP_PARAM_ID, Op.EQ, uint256(1), false);
        assertEval(arr(), TIMESTAMP_PARAM_ID, Op.GT, uint256(1), true);
    }

    function testBlockNumber() public {
        assertEval(arr(), BLOCK_NUMBER_PARAM_ID, Op.EQ, uint256(block.number), true);
        assertEval(arr(), BLOCK_NUMBER_PARAM_ID, Op.EQ, uint256(1), false);
        assertEval(arr(), BLOCK_NUMBER_PARAM_ID, Op.GT, uint256(block.number - 1), true);
    }

    function testOracle() public {
        assertEval(arr(), ORACLE_PARAM_ID, Op.EQ, uint256(new AcceptOracle()), true);
        assertEval(arr(), ORACLE_PARAM_ID, Op.EQ, uint256(new RejectOracle()), false);
        assertEval(arr(), ORACLE_PARAM_ID, Op.EQ, uint256(new RevertOracle()), false); // doesn't revert
        assertEval(arr(), ORACLE_PARAM_ID, Op.NEQ, uint256(new RejectOracle()), true);

        // conditional oracle returns true if first param > 0
        ConditionalOracle conditionalOracle = new ConditionalOracle();

        assertEval(arr(uint256(1)), ORACLE_PARAM_ID, Op.EQ, uint256(conditionalOracle), true);
        assertEval(arr(uint256(0), uint256(1)), ORACLE_PARAM_ID, Op.EQ, uint256(conditionalOracle), false);
    }

    function testReturn() public {
        assertEval(arr(), PARAM_VALUE_PARAM_ID, Op.RET, uint256(1), true);
        assertEval(arr(), PARAM_VALUE_PARAM_ID, Op.RET, uint256(0), false);
        assertEval(arr(), PARAM_VALUE_PARAM_ID, Op.RET, uint256(100), true);
        assertEval(arr(), TIMESTAMP_PARAM_ID, Op.RET, uint256(0), true);
    }

    function testNot() public {
        Param memory retTrue = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 1);
        Param memory retFalse = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 0);

        Param memory notOp = Param(LOGIC_OP_PARAM_ID, uint8(Op.NOT), encodeOperator(1, 0));
        Param[] memory params = new Param[](2);

        // !true == false
        params[0] = notOp;
        params[1] = retTrue;
        assertEval(params, false);

        // !false == true
        params[1] = retFalse;
        assertEval(params, true);
    }

    function testComplexCombination() public {
        // if (oracle and block number > block number - 1) then arg 0 < 10 or oracle else false
        Param[] memory params = new Param[](7);
        params[0] = Param(LOGIC_OP_PARAM_ID, uint8(Op.IF_ELSE), encodeIfElse(1, 4, 6));
        params[1] = Param(LOGIC_OP_PARAM_ID, uint8(Op.AND), encodeOperator(2, 3));
        params[2] = Param(ORACLE_PARAM_ID, uint8(Op.EQ), uint240(new AcceptOracle()));
        params[3] = Param(BLOCK_NUMBER_PARAM_ID, uint8(Op.GT), uint240(block.number - 1));
        params[4] = Param(LOGIC_OP_PARAM_ID, uint8(Op.OR), encodeOperator(5, 2));
        params[5] = Param(0, uint8(Op.LT), uint240(10));
        params[6] = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 0);

        assertEval(params, arr(uint256(10)), true);

        params[4] = Param(LOGIC_OP_PARAM_ID, uint8(Op.AND), encodeOperator(5, 2));
        assertEval(params, arr(uint256(10)), false);
    }

    function testParamOutOfBoundsFail() public {
        Param[] memory params = new Param[](2);

        params[1] = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 1);
        assertEval(params, arr(uint256(10)), false);

        params[0] = Param(LOGIC_OP_PARAM_ID, uint8(Op.IF_ELSE), encodeIfElse(2, 2, 2));
        assertEval(params, arr(uint256(10)), false);
    }

    function testArgOutOfBoundsFail() public {
        assertEval(arr(uint256(10), 11), 3, Op.EQ, 10, false);
    }

    function testIfElse() public {
        Param memory retTrue = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 1);
        Param memory retFalse = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 0);

        // If 1 then 2 else 3
        Param memory ifOp = Param(LOGIC_OP_PARAM_ID, uint8(Op.IF_ELSE), encodeIfElse(1, 2, 3));
        Param[] memory params = new Param[](4);

        // true ? true : false == true
        params[0] = ifOp;
        params[1] = retTrue;
        params[2] = retTrue;
        params[3] = retFalse;
        assertEval(params, true);

        // false ? true : false == false
        params[1] = retFalse;
        assertEval(params, false);
    }

    function testCombinators() public {
        Param memory retTrue = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 1);
        Param memory retFalse = Param(PARAM_VALUE_PARAM_ID, uint8(Op.RET), 0);

        // OR param at index 1 or param 2
        Param memory orOp = Param(LOGIC_OP_PARAM_ID, uint8(Op.OR), encodeOperator(1, 2));
        Param memory andOp = Param(LOGIC_OP_PARAM_ID, uint8(Op.AND), encodeOperator(1, 2));
        Param memory xorOp = Param(LOGIC_OP_PARAM_ID, uint8(Op.XOR), encodeOperator(1, 2));

        Param[] memory params = new Param[](3);

        // or true true == true
        params[0] = orOp;
        params[1] = retTrue;
        params[2] = retTrue;
        assertEval(params, true);

        // or false true == true
        params[1] = retFalse;
        assertEval(params, true);

        // or true false == true
        params[1] = retTrue;
        params[2] = retFalse;
        assertEval(params, true);

        // or false false == false
        params[1] = retFalse;
        assertEval(params, false);

        // and false false == false
        params[0] = andOp;
        assertEval(params, false);

        // and true false == false
        params[1] = retTrue;
        assertEval(params, false);

        // and false true == false
        params[1] = retFalse;
        params[2] = retTrue;
        assertEval(params, false);

        // and true true == true
        params[1] = retTrue;
        params[2] = retTrue;
        assertEval(params, true);

        // xor true true == false
        params[0] = xorOp;
        assertEval(params, false);

        // xor false true == true
        params[1] = retFalse;
        assertEval(params, true);

        // xor true false == true
        params[1] = retTrue;
        params[2] = retFalse;
        assertEval(params, true);

        // xor false false == false
        params[1] = retFalse;
        assertEval(params, false);
    }


    function assertEval(uint256[] memory args, uint8 argId, Op op, uint256 value, bool expected) internal {
        Param[] memory params = new Param[](1);
        params[0] = Param(argId, uint8(op), uint240(value));
        assertEval(params, args, expected);
    }

    function assertEval(Param[] memory params, bool expected) internal {
        assertEval(params, new uint256[](0), expected);
    }

    function assertEval(Param[] memory params, uint256[] memory args, bool expected) internal {
        bytes32 paramHash = encodeAndSaveParams(params);
        bool allow = evalParam(paramHash, 0, address(0), address(0), bytes32(0), args);

        Assert.equal(allow, expected, "eval got unexpected result");
    }

    event LogParam(bytes32 param);
    function encodeAndSaveParams(Param[] memory params) internal returns (bytes32) {
        uint256[] memory encodedParams = new uint256[](params.length);

        for (uint256 i = 0; i < params.length; i++) {
            Param memory param = params[i];
            encodedParams[i] = (uint256(param.id) << 248) + (uint256(param.op) << 240) + param.value;
            LogParam(bytes32(encodedParams[i]));
        }

        return _saveParams(encodedParams);
    }
}
