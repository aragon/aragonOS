pragma solidity 0.4.24;

import "../../../../apps/disputable/IAgreement.sol";


contract AgreementMock is IAgreement {
    function sign() external {
        // do nothing
    }

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

    function getSigner(address) external view returns (uint256, bool) {
        return (0, false);
    }

    function getCurrentSettingId() external view returns (uint256) {
        return 0;
    }

    function getSetting(uint256) external view returns (IArbitrator, IAragonAppFeesCashier, string, bytes) {
        return (IArbitrator(0), IAragonAppFeesCashier(0), new string(0), new bytes(0));
    }

    function getDisputableInfo(address) external view returns (bool, uint256) {
        return (false, 0);
    }

    function getCollateralRequirement(address, uint256) external view returns (ERC20, uint256, uint256, uint64) {
        return (ERC20(0), 0, 0, 0);
    }

    function getAction(uint256) external view returns (address, uint256, uint256, uint256, address, bool, bytes, uint256) {
        return (address(0), 0, 0, 0, address(0), false, new bytes(0), 0);
    }

    function getChallenge(uint256) external view returns (uint256, address, uint64, bytes, uint256, ChallengeState, bool, bool, uint256, uint256) {
        return (0, address(0), 0, new bytes(0), 0, ChallengeState.Waiting, false, false, 0, 0);
    }

    function getChallengeArbitratorFees(uint256) external view returns (uint256, ERC20, uint256, ERC20) {
        return (0, ERC20(0), 0, ERC20(0));
    }
}
