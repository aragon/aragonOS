/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../acl/IACL.sol";
import "../common/IVaultRecoverable.sol";
import "../apps/disputable/IAgreement.sol";
import "../apps/disputable/IDisputable.sol";


interface IKernelEvents {
    event SetApp(bytes32 indexed namespace, bytes32 indexed appId, address app);
}


// This should be an interface, but interfaces can't inherit yet :(
contract IKernel is IKernelEvents, IVaultRecoverable {
    function setAgreement(IDisputable _disputableApp, IAgreement _agreement) external;

    function acl() public view returns (IACL);
    function hasPermission(address who, address where, bytes32 what, bytes how) public view returns (bool);

    function setApp(bytes32 namespace, bytes32 appId, address app) public;
    function getApp(bytes32 namespace, bytes32 appId) public view returns (address);
}
