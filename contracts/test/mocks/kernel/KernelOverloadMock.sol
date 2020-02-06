pragma solidity 0.4.24;

import "../../../kernel/Kernel.sol";
import "../../../lib/misc/ERCProxy.sol";


/** Ugly hack to work around this issue:
 * https://github.com/trufflesuite/truffle/issues/569
 * https://github.com/trufflesuite/truffle/issues/737
 *
 * NOTE: awkwardly, by default we have access to the full version of `newAppInstance()` but only the
 * minimized version for `newPinnedAppInstance()`
 */
contract KernelOverloadMock is Kernel {
    constructor(bool _shouldPetrify) Kernel(_shouldPetrify) public {}

    // Overriding function to bypass Truffle's overloading issues
    function newAppInstanceWithoutPayload(bytes32 _appId, address _appBase) public returns (ERCProxy) {
        return super.newAppInstance(_appId, _appBase);
    }

    // Overriding function to bypass Truffle's overloading issues
    function newAppInstanceWithPayload(bytes32 _appId, address _appBase, bytes _initializePayload, bool _setDefault) public returns (ERCProxy) {
        return super.newAppInstance(_appId, _appBase, _initializePayload, _setDefault);
    }

    // Overriding function to bypass Truffle's overloading issues
    function newPinnedAppInstanceWithoutPayload(bytes32 _appId, address _appBase) public returns (ERCProxy) {
        return super.newPinnedAppInstance(_appId, _appBase);
    }

    // Overriding function to bypass Truffle's overloading issues
    function newPinnedAppInstanceWithPayload(bytes32 _appId, address _appBase, bytes _initializePayload, bool _setDefault) public returns (ERCProxy) {
        return super.newPinnedAppInstance(_appId, _appBase, _initializePayload, _setDefault);
    }
}
