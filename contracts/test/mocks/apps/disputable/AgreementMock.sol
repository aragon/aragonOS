pragma solidity 0.4.24;

import "../../../../apps/disputable/IAgreement.sol";


contract AgreementMock is IAgreement {

    function activate(address, ERC20, uint256, uint256, uint64) external {
        // do nothing
    }

    function deactivate(address) external {
        // do nothing
    }

    function newAction(uint256, bytes, address) external returns (uint256) {
        return 0;
    }

    function closeAction(uint256) external {
        // do nothing
    }

    function challengeAction(uint256, uint256, bool, bytes) external {
        // do nothing
    }

    function settleAction(uint256) external {
        // do nothing
    }

    function disputeAction(uint256, bool) external {
        // do nothing
    }

    function getDisputableInfo(address) external view returns (bool, uint256) {
        return (false, 0);
    }

    function getCollateralRequirement(address, uint256) external view returns (ERC20, uint256, uint256, uint64) {
        return (ERC20(0), 0, 0, 0);
    }
}
