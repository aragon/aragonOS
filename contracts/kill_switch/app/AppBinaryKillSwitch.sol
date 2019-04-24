pragma solidity 0.4.24;

import "./AppKillSwitch.sol";
import "../base/BinaryKillSwitch.sol";


contract AppBinaryKillSwitch is AppKillSwitch, BinaryKillSwitch {
    function setContractIgnore(address _contract, bool _ignored)
        external
        authP(SET_IGNORED_CONTRACTS_ROLE, arr(_baseApp(), msg.sender))
    {
        _setContractIgnore(_contract, _ignored);
    }
}
