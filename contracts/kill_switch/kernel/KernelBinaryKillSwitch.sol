pragma solidity 0.4.24;

import "./KernelKillSwitch.sol";
import "../base/BinaryKillSwitch.sol";


contract KernelBinaryKillSwitch is KernelKillSwitch, BinaryKillSwitch {
    constructor(bool _shouldPetrify) Kernel(_shouldPetrify) public {}

    function setContractIgnore(address _contract, bool _ignored)
        external
        auth(SET_IGNORED_CONTRACTS_ROLE, arr(_contract, msg.sender))
    {
        _setContractIgnore(_contract, _ignored);
    }
}
