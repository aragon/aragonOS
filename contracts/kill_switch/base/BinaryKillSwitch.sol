pragma solidity 0.4.24;

import "./KillSwitch.sol";
import "./IssuesRegistry.sol";


contract BinaryKillSwitch is KillSwitch {
    bytes32 constant public SET_IGNORED_CONTRACTS_ROLE = keccak256("SET_IGNORED_CONTRACTS_ROLE");

    mapping (address => bool) internal ignoredContracts;

    event ContractIgnored(address _contract, bool ignored);

    function setContractIgnore(address _contract, bool _ignored) external;

    function isContractIgnored(address _contract) public view returns (bool) {
        return ignoredContracts[_contract];
    }

    function isSeverityIgnored(address /*_contract*/, IssuesRegistry.Severity _severity) public view returns (bool) {
        return _severity == IssuesRegistry.Severity.None;
    }

    function _setContractIgnore(address _contract, bool _ignored) internal {
        ignoredContracts[_contract] = _ignored;
        emit ContractIgnored(_contract, _ignored);
    }
}
