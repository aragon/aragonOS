pragma solidity 0.4.24;

import "../../kernel/Kernel.sol";
import "../../lib/misc/ERCProxy.sol";


/** Ugly hack to work around this issue:
 * https://github.com/trufflesuite/truffle/issues/569
 * https://github.com/trufflesuite/truffle/issues/737
 */
contract KernelOverloadMock {
    Kernel kernel;

    event NewAppProxy(address proxy);

    constructor(address _kernel) public {
        kernel = Kernel(_kernel);
    }

    //function newAppInstance(bytes32 _name, address _appBase, bool _setDefault, bytes _initializePayload) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
    function newAppInstance(bytes32 _name, address _appBase, bool _setDefault, bytes _initializePayload) public returns (ERCProxy appProxy) {
        appProxy = kernel.newAppInstance(_name, _appBase, _setDefault, _initializePayload);
        emit NewAppProxy(appProxy);
    }

    // function newPinnedAppInstance(bytes32 _name, address _appBase, bool _setDefault, bytes _initializePayload) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
    function newPinnedAppInstance(bytes32 _name, address _appBase, bool _setDefault, bytes _initializePayload) public returns (ERCProxy appProxy) {
        appProxy = kernel.newPinnedAppInstance(_name, _appBase, _setDefault, _initializePayload);
        emit NewAppProxy(appProxy);
    }
}
