pragma solidity 0.4.18;

import "../../contracts/apm/Repo.sol";
import "../../contracts/apps/UnsafeAragonApp.sol";


// Allows Repo to be used without a proxy or access controls
contract UnsafeRepo is Repo, UnsafeAragonApp {
    // Protected actions are always performable
    function canPerform(address _sender, bytes32 _role, uint256[] _params) public view returns (bool) {
        return true;
    }
}
