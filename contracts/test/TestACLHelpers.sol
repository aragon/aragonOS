pragma solidity 0.4.24;

import "./helpers/Assert.sol";
import "../acl/ACLSyntaxSugar.sol";


contract TestACLHelpers is ACLHelpers {

    function testEncodeParam() public {
        Param memory param = Param({ 
            id: 2,
            op: uint8(Op.EQ),
            value: 5294967297
        });

        uint256 encodedParam = encodeParam(param);

        (uint32 id, uint32 op, uint32 value) = decodeParamsList(encodedParam);

        Assert.equal(uint256(param.id), uint256(id), "Encoded id is not equal");
        Assert.equal(uint256(param.op), uint256(op), "Encoded op is not equal");
        Assert.equal(uint256(param.value), uint256(value), "Encoded value is not equal");
    }

    function testEncodeParams() public {
        Param[] memory params = new Param[](2);

        params[0] = Param({ 
            id: 1,
            op: uint8(Op.EQ),
            value: 5294967297
        });

        params[1] = Param({ 
            id: 2,
            op: uint8(Op.EQ),
            value: 5294967297
        });


        uint256[] memory encodedParam = encodeParams(params);

        (uint32 id0, uint32 op0, uint32 value0) = decodeParamsList(encodedParam[0]);

        Assert.equal(uint256(params[0].id), uint256(id0), "Encoded id is not equal");
        Assert.equal(uint256(params[0].op), uint256(op0), "Encoded op is not equal");
        Assert.equal(uint256(params[0].value), uint256(value0), "Encoded value is not equal");

        (uint32 id1, uint32 op1, uint32 value1) = decodeParamsList(encodedParam[1]);

        Assert.equal(uint256(params[1].id), uint256(id1), "Encoded id is not equal");
        Assert.equal(uint256(params[1].op), uint256(op1), "Encoded op is not equal");
        Assert.equal(uint256(params[1].value), uint256(value1), "Encoded value is not equal");        
    }    

}
