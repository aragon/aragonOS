pragma solidity 0.4.24;

import "../../../apps/AragonApp.sol";


contract AragonAppMock is AragonApp {
    bytes4 public constant ARAGON_APP_INTERFACE = ARAGON_APP_INTERFACE_ID;

    function initialize() external {
        initialized();
    }

    function interfaceID() external pure returns (bytes4) {
        IAragonApp iAragonApp;
        return iAragonApp.kernel.selector ^
            iAragonApp.appId.selector;
    }
}
