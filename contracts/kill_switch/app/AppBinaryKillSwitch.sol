pragma solidity 0.4.24;

import "./AppKillSwitch.sol";
import "../base/BinaryKillSwitch.sol";


contract AppBinaryKillSwitch is AppKillSwitch, BinaryKillSwitch {
    function setContractAction(address _contract, ContractAction _action)
        external
        authP(SET_CONTRACT_ACTION_ROLE, arr(_baseApp(), msg.sender))
    {
        _setContractAction(_contract, _action);
    }
}
