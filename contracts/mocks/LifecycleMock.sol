pragma solidity 0.4.24;

import "../../contracts/common/Initializable.sol";
import "../../contracts/common/Petrifiable.sol";


contract LifecycleMock is Initializable, Petrifiable {
    function initializeMock() public {
        initialized();
    }

    function petrifyMock() public {
        petrify();
    }
}
