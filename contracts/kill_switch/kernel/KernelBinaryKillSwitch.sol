pragma solidity 0.4.24;

import "./KernelKillSwitch.sol";
import "../base/BinaryKillSwitch.sol";


contract KernelBinaryKillSwitch is KernelKillSwitch, BinaryKillSwitch {
    constructor(bool _shouldPetrify) Kernel(_shouldPetrify) public {}

    function setContractAction(address _contract, ContractAction _action)
        external
        auth(SET_CONTRACT_ACTION_ROLE, arr(_contract, msg.sender))
    {
        _setContractAction(_contract, _action);
    }
}
