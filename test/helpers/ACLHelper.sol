pragma solidity 0.4.18;

import "../../contracts/acl/ACL.sol";


contract ACLHelper {
    function encodeOperator(uint256 param1, uint256 param2) internal constant returns (uint240) {
        return encodeIfElse(param1, param2, 0);
    }

    function encodeIfElse(uint256 condition, uint256 successParam, uint256 failureParam) internal constant returns (uint240) {
        return uint240(condition + (successParam << 32) + (failureParam << 64));
    }
}


contract AcceptOracle is ACLOracle {
    function canPerform(address who, address where, bytes32 what, uint256[] how) public constant returns (bool) {
        return true;
    }
}


contract RejectOracle is ACLOracle {
    function canPerform(address who, address where, bytes32 what, uint256[] how) public constant returns (bool) {
        return false;
    }
}


contract RevertOracle is ACLOracle {
    function canPerform(address who, address where, bytes32 what, uint256[] how) public constant returns (bool) {
        revert();
    }
}


contract ConditionalOracle is ACLOracle {
    function canPerform(address who, address where, bytes32 what, uint256[] how) public constant returns (bool) {
        return how[0] > 0;
    }
}
