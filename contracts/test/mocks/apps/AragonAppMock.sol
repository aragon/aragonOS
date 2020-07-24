pragma solidity 0.4.24;

import "../../../apps/IAragonApp.sol";


contract AragonAppMock is IAragonApp {
    bytes4 public constant ARAGON_APP_INTERFACE = ARAGON_APP_INTERFACE_ID;

    function interfaceID() external pure returns (bytes4) {
        IAragonApp iAragonApp;
        return iAragonApp.kernel.selector ^
            iAragonApp.appId.selector;
    }

    function kernel() public view returns (IKernel) {}
    function appId() public view returns (bytes32) {}
}
