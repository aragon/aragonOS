pragma solidity 0.4.24;

import "../../../apps/AragonApp.sol";
import "../../../apps/UnsafeAragonApp.sol";
import "../../../common/DepositableStorage.sol";


contract AppStubDepositable is AragonApp, DepositableStorage {
    function () external payable {
        require(isDepositable());
    }

    function initialize() onlyInit public {
        initialized();
    }

    function enableDeposits() external {
        setDepositable(true);
    }
}

contract UnsafeAppStubDepositable is AppStubDepositable, UnsafeAragonApp {
    constructor(IKernel _kernel) public {
        setKernel(_kernel);
    }
}
