pragma solidity 0.4.24;

import "./helpers/Assert.sol";
import "../acl/ACLHelpers.sol";


contract TestACLHelpers is ACLHelpers {
    function testEncodeParam() public {
        Param memory param = Param(2, uint8(Op.EQ), 5294967297);

        uint256 encodedParam = encodeParam(param);

        (uint32 id, uint32 op, uint32 value) = decodeParamsList(encodedParam);

        Assert.equal(uint256(param.id), uint256(id), "Encoded id is not equal");
        Assert.equal(uint256(param.op), uint256(op), "Encoded op is not equal");
        Assert.equal(uint256(param.value), uint256(value), "Encoded value is not equal");
    }

    function testEncodeParams() public {
        Param[] memory params = new Param[](4);

        params[0] = Param(LOGIC_OP_PARAM_ID, uint8(Op.IF_ELSE), encodeIfElse(1, 2, 3));
        params[1] = Param(LOGIC_OP_PARAM_ID, uint8(Op.AND), encodeOperator(2, 3));
        params[2] = Param(2, uint8(Op.EQ), 1);
        params[3] = Param(3, uint8(Op.NEQ), 2);

        uint256[] memory encodedParam = encodeParams(params);

        for (uint256 i = 0; i < 4; i++) {
            (uint32 id, uint32 op, uint32 value) = decodeParamsList(encodedParam[i]);

            Assert.equal(uint256(params[i].id), uint256(id), "Encoded id is not equal");
            Assert.equal(uint256(params[i].op), uint256(op), "Encoded op is not equal");
            Assert.equal(uint256(params[i].value), uint256(value), "Encoded value is not equal");
        }
    }
}
