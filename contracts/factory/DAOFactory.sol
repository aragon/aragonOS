pragma solidity 0.4.18;

import "../kernel/Kernel.sol";
import "../kernel/KernelProxy.sol";

contract DAOFactory {
    address public baseKernel;

    function DAOFactory() {
        // No need to init as it cannot be killed by devops199
        baseKernel = address(new Kernel());
    }

    function newDAO(address _root) returns (Kernel dao) {
        dao = Kernel(new KernelProxy(baseKernel));
        dao.initialize(_root);
    }
}
