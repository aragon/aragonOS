pragma solidity 0.4.24;

import "./helpers/Assert.sol";
import "./helpers/ACLHelper.sol";
import "../acl/ACLSyntaxSugar.sol";
import "../acl/ACL.sol";


contract TestACLHelpers is ACL, ACLHelper {

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

        
        (uint32 id0, uint32 op0, uint32 value0) = decodeParamsList(encodedParam[0]);

        Assert.equal(uint256(params[0].id), uint256(id0), "Encoded id is not equal");
        Assert.equal(uint256(params[0].op), uint256(op0), "Encoded op is not equal");
        Assert.equal(uint256(params[0].value), uint256(value0), "Encoded value is not equal");

        (uint32 id1, uint32 op1, uint32 value1) = decodeParamsList(encodedParam[1]);

        Assert.equal(uint256(params[1].id), uint256(id1), "Encoded id is not equal");
        Assert.equal(uint256(params[1].op), uint256(op1), "Encoded op is not equal");
        Assert.equal(uint256(params[1].value), uint256(value1), "Encoded value is not equal"); 

        (uint32 id2, uint32 op2, uint32 value2) = decodeParamsList(encodedParam[2]);

        Assert.equal(uint256(params[2].id), uint256(id2), "Encoded id is not equal");
        Assert.equal(uint256(params[2].op), uint256(op2), "Encoded op is not equal");
        Assert.equal(uint256(params[2].value), uint256(value2), "Encoded value is not equal");    

        (uint32 id3, uint32 op3, uint32 value3) = decodeParamsList(encodedParam[3]);

        Assert.equal(uint256(params[3].id), uint256(id3), "Encoded id is not equal");
        Assert.equal(uint256(params[3].op), uint256(op3), "Encoded op is not equal");
        Assert.equal(uint256(params[3].value), uint256(value3), "Encoded value is not equal");   
                                
    }    

}
