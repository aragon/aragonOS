pragma solidity 0.4.24;

import "../../kernel/Kernel.sol";
import "../../lib/misc/ERCProxy.sol";


/** Ugly hack to work around this issue:
 * https://github.com/trufflesuite/truffle/issues/569
 * https://github.com/trufflesuite/truffle/issues/737
 *
 * NOTE: awkwardly, by default we have access to the full version of `newAppInstance()` but only the
 * minimized version for `newPinnedAppInstance()`
 */
contract KernelOverloadMock {
    Kernel public kernel;

    event NewAppProxy(address proxy);

    constructor(Kernel _kernel) public {
        kernel = _kernel;
    }

    /*
    function newAppInstance(bytes32 _appId, address _appBase)
        public
        auth(APP_MANAGER_ROLE, arr(KERNEL_APP_BASES_NAMESPACE, _appId))
        returns (ERCProxy appProxy)
    */
    function newAppInstance(bytes32 _appId, address _appBase, bytes _initializePayload, bool _setDefault)
        public
        returns (ERCProxy appProxy)
    {
        appProxy = kernel.newAppInstance(_appId, _appBase, _initializePayload, _setDefault);
        emit NewAppProxy(appProxy);
    }

    /*
    function newPinnedAppInstance(bytes32 _appId, address _appBase, bytes _initializePayload, bool _setDefault)
        public
        auth(APP_MANAGER_ROLE, arr(KERNEL_APP_BASES_NAMESPACE, _appId))
        returns (ERCProxy appProxy)
    */
    function newPinnedAppInstance(bytes32 _appId, address _appBase, bytes _initializePayload, bool _setDefault)
        public
        returns (ERCProxy appProxy)
    {
        appProxy = kernel.newPinnedAppInstance(_appId, _appBase, _initializePayload, _setDefault);
        emit NewAppProxy(appProxy);
    }
}
