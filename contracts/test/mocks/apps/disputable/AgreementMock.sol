pragma solidity 0.4.24;

import "../../../../apps/disputable/IAgreement.sol";


contract AgreementMock is IAgreement {
    function sign() external {
        // do nothing
    }

    function activate(
        address,
        ERC20,
        uint256,
        uint256,
        uint64
    )
        external
    {
        // do nothing
    }

    function deactivate(address) external {
        // do nothing
    }

    function newAction(uint256 /* _disputableActionId */, bytes /* _context */, address /* _submitter */) external returns (uint256) {
        // do nothing
        return 0;
    }

    function closeAction(uint256 /* _actionId */) external {
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
        // do nothing
    }

    function getCurrentSettingId() external view returns (uint256) {
        // do nothing
    }

    function getSetting(uint256) external view
        returns (
            IArbitrator,
            IAragonAppFeesCashier,
            string,
            bytes
        )
    {
        // do nothing
    }

    function getDisputableInfo(address) external view returns (bool, uint256) {
        // do nothing
    }

    function getCollateralRequirement(address, uint256) external view
        returns (
            ERC20,
            uint256,
            uint256,
            uint64
        )
    {
        // do nothing
    }

    function getAction(uint256) external view
        returns (
            address,
            uint256,
            uint256,
            uint256,
            address,
            bool,
            bytes,
            uint256
        )
    {
        // do nothing
    }

    function getChallenge(uint256) external view
        returns (
            uint256,
            address,
            uint64,
            bytes,
            uint256,
            uint256,
            ERC20,
            ChallengeState,
            bool,
            bool,
            uint256,
            uint256
        )
    {
        // do nothing
    }

    function submitEvidence(uint256 _disputeId, bytes _evidence, bool _finished) external {
        // do nothing
    }

    function rule(uint256 _disputeId, uint256 _ruling) external {
        // do nothing
    }

    function supportsInterface(bytes4 _interfaceId) public pure returns (bool) {
        // do nothing
    }

    function canPerform(address, address, address, bytes32, uint256[]) external view returns (bool) {
        // do nothing
    }
}
