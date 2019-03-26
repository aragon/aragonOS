/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;


contract ACLParams {
    // Op types
    enum Op { NONE, EQ, NEQ, GT, LT, GTE, LTE, RET, NOT, AND, OR, XOR, IF_ELSE }

    // Op IDs
    uint8 internal constant BLOCK_NUMBER_PARAM_ID = 200;
    uint8 internal constant TIMESTAMP_PARAM_ID    = 201;
    // 202 is unused
    uint8 internal constant ORACLE_PARAM_ID       = 203;
    uint8 internal constant LOGIC_OP_PARAM_ID     = 204;
    uint8 internal constant PARAM_VALUE_PARAM_ID  = 205;
    // TODO: Add execution times param type?

    struct Param {
        uint8 id;
        uint8 op;
        uint240 value; // even though value is an uint240 it can store addresses
        // in the case of 32 byte hashes losing 2 bytes precision isn't a huge deal
        // op and id take less than 1 byte each so it can be kept in 1 sstore
    }
}
