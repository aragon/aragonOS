pragma solidity 0.4.24;

import "../../../apm/Repo.sol";
import "../../../apps/UnsafeAragonApp.sol";


// Allows Repo to be used without a proxy or access controls
contract UnsafeRepo is Repo, UnsafeAragonApp {
    // Protected actions are always performable
    function canPerform(address, bytes32, uint256[]) public view returns (bool) {
        return true;
    }
}
