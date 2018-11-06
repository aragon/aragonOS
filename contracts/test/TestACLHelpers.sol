pragma solidity 0.4.24;

import "./helpers/Assert.sol";
import "../acl/ACL.sol";
import "../acl/ACLSyntaxSugar.sol";


contract TestACLHelpers is ACLHelpers, ACL {

    function testEncodeParam() public {
        Param memory param = Param({ 
            id: 2,
            op: uint8(Op.EQ),
            value: 5294967297
        });

        uint256 encodedParam = encodeParam(param.id, param.op, param.value);

        (uint32 id, uint32 op, uint32 value) = decodeParamsList(encodedParam);

        Assert.equal(uint256(param.id), uint256(id), "Encoded id is not equal");
        Assert.equal(uint256(param.op), uint256(op), "Encoded op is not equal");
        Assert.equal(uint256(param.value), uint256(value), "Encoded value is not equal");
    }

}
