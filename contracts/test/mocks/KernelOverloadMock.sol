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

    //function newAppInstance(bytes32 _name, address _appBase, bytes _initializePayload, bool _setDefault) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
    function newAppInstance(bytes32 _name, address _appBase, bytes _initializePayload, bool _setDefault) public returns (ERCProxy appProxy) {
        appProxy = kernel.newAppInstance(_name, _appBase, _initializePayload, _setDefault);
        emit NewAppProxy(appProxy);
    }

    // function newPinnedAppInstance(bytes32 _name, address _appBase, bytes _initializePayload, bool _setDefault) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
    function newPinnedAppInstance(bytes32 _name, address _appBase, bytes _initializePayload, bool _setDefault) public returns (ERCProxy appProxy) {
        appProxy = kernel.newPinnedAppInstance(_name, _appBase, _initializePayload, _setDefault);
        emit NewAppProxy(appProxy);
    }
}
