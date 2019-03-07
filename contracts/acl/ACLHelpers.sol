/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "./ACLParams.sol";


contract ACLHelpers is ACLParams {
    function decodeParamOp(uint256 _x) internal pure returns (uint8 b) {
        return uint8(_x >> (8 * 30));
    }

    function decodeParamId(uint256 _x) internal pure returns (uint8 b) {
        return uint8(_x >> (8 * 31));
    }

    function decodeParamsList(uint256 _x) internal pure returns (uint32 a, uint32 b, uint32 c) {
        a = uint32(_x);
        b = uint32(_x >> (8 * 4));
        c = uint32(_x >> (8 * 8));
    }

    function encodeParams(Param[] params) internal pure returns (uint256[]) {
        uint256[] memory encodedParams = new uint256[](params.length);

        for (uint i = 0; i < params.length; i++) {
            encodedParams[i] = encodeParam(params[i]);
        }

        return encodedParams;
    }

    function encodeParam(Param param) internal pure returns (uint256) {
        return uint256(param.id) << 248 | uint256(param.op) << 240 | param.value;
    }

    function encodeOperator(uint256 param1, uint256 param2) internal pure returns (uint240) {
        return uint240(param1 + (param2 << 32) + (0 << 64));
    }

    function encodeIfElse(uint256 condition, uint256 successParam, uint256 failureParam) internal pure returns (uint240) {
        return uint240(condition + (successParam << 32) + (failureParam << 64));
    }
}
