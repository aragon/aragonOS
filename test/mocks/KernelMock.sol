pragma solidity 0.4.18;

import "../../contracts/kernel/Kernel.sol";
import "../../contracts/lib/misc/ERCProxy.sol";


/** Ugly hack to work around this issue:
 * https://github.com/trufflesuite/truffle/issues/569
 * https://github.com/trufflesuite/truffle/issues/737
 */
contract KernelMock {
    Kernel kernel;

    event NewAppProxy(address proxy);

    function KernelMock(address _kernel) {
        kernel = Kernel(_kernel);
    }

    //function newAppInstance(bytes32 _name, address _appBase, bool _setDefault) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
    function newAppInstance(bytes32 _name, address _appBase, bool _setDefault) public returns (ERCProxy appProxy) {
        appProxy = kernel.newAppInstance(_name, _appBase, _setDefault);
        NewAppProxy(appProxy);
    }
}
