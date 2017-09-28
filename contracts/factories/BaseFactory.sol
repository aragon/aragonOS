pragma solidity 0.4.15;

import "../kernel/KernelProxy.sol";
import "../kernel/Kernel.sol";

import "../apps/AppProxy.sol";

import "../apps/voting/VotingApp.sol";
import "../apps/token-manager/TokenManager.sol";
import "../apps/group/GroupApp.sol";
import "../apps/fundraising/FundraisingApp.sol";
import "../apps/vault/Vault.sol";
import "../apps/finance/FinanceApp.sol";

import "../common/MiniMeToken.sol";

contract BaseFactory {
    address public kernelRef;

    bytes32[6] public appIds;
    address[6] public appCode;

    EtherToken public etherToken;
    address minimeFactory;

    event DAODeploy(address dao, address token);

    function BaseFactory(address _kernelRef, bytes32[6] _appIds, address[6] _appCode, EtherToken _etherToken, address _minimeFactory) {
        kernelRef = _kernelRef;
        appIds = _appIds;
        appCode = _appCode;
        etherToken = _etherToken;
        minimeFactory = _minimeFactory;
    }

    function deploy(string _tokenName, string _tokenSymbol) {
        uint8 tokenDecimals = 1;
        string memory initialGroupName = "Founders";

        Kernel kernel = _deployKernel();
        MiniMeToken token = _deployToken(_tokenName, _tokenSymbol, tokenDecimals);

        _setAppCode(kernel);
        address[6] memory apps = _deployApps(kernel);

        VotingApp voting = VotingApp(apps[0]);
        TokenManager tokenManager = TokenManager(apps[1]);
        GroupApp group = GroupApp(apps[2]);
        FundraisingApp fundraising = FundraisingApp(apps[3]);
        Vault vault = Vault(apps[4]);
        FinanceApp finance = FinanceApp(apps[5]);

        _setDefaultPermissions(kernel, apps);

        _setupVoting(voting, token);
        _setupTokenManager(tokenManager, token);
        group.initialize(initialGroupName);
        fundraising.initialize(tokenManager, address(vault));
        finance.initialize(vault, etherToken, 30 days);

        _removeFactoryPermissions(kernel);

        DAODeploy(address(kernel), address(token));
    }

    function _setDefaultPermissions(Kernel _kernel, address[6] _apps) internal {
        VotingApp voting = VotingApp(_apps[0]);
        TokenManager tokenManager = TokenManager(_apps[1]);
        GroupApp founderGroup = GroupApp(_apps[2]);
        FundraisingApp fundraising = FundraisingApp(_apps[3]);
        Vault vault = Vault(_apps[4]);
        FinanceApp finance = FinanceApp(_apps[5]);

        // VOTING

        // only token holders can create votings (a voting can change this)
        _kernel.createPermission(address(tokenManager), address(voting), voting.VOTE_CREATOR_ROLE(), address(voting));
        // founders can modify the minimum acceptance quorum (a voting can change this)
        _kernel.createPermission(address(founderGroup), address(voting), voting.QUORUM_MODIFIER_ROLE(), address(voting));

        // TOKEN MANAGER

        // fundraising app can mint tokens (a voting can change this)
        _kernel.createPermission(address(fundraising), address(tokenManager), tokenManager.MINT_ROLE(), address(voting));
        // a voting is needed to issue tokens (a voting can change this)
        _kernel.createPermission(address(voting), address(tokenManager), tokenManager.ISSUE_ROLE(), address(voting));
        // founders can assign issued tokens (founders can change this)
        _kernel.createPermission(address(founderGroup), address(tokenManager), tokenManager.ASSIGN_ROLE(), address(founderGroup));
        // founders can revoke tokens (founders can change this)
        _kernel.createPermission(address(founderGroup), address(tokenManager), tokenManager.REVOKE_VESTING_ROLE(), address(founderGroup));

        // FOUNDER GROUP

        // temporarely allow Factory to add group members
        _kernel.createPermission(address(this), address(founderGroup), founderGroup.ADD_MEMBER_ROLE(), address(this));
        founderGroup.addMember(msg.sender);
        _kernel.revokePermission(address(this), address(founderGroup), founderGroup.ADD_MEMBER_ROLE());

        // allow group members to add more group members
        _kernel.createPermission(address(founderGroup), address(founderGroup), founderGroup.ADD_MEMBER_ROLE(), address(founderGroup));
        // allow group members to remove group members
        _kernel.createPermission(address(founderGroup), address(founderGroup), founderGroup.REMOVE_MEMBER_ROLE(), address(founderGroup));

        // FUNDRAISING

        // a voting can start a fundraise
        _kernel.createPermission(address(voting), address(fundraising), fundraising.CREATOR_ROLE(), address(voting));
        // founders can close fundraises
        _kernel.createPermission(address(founderGroup), address(fundraising), fundraising.CLOSER_ROLE(), address(founderGroup));

        // VAULT

        // Finance can transfer vault tokens (voting can change this)
        _kernel.createPermission(address(finance), address(vault), vault.TRANSFER_ROLE(), address(voting));
        // no-one can create allowances (voting can change that)
        _kernel.createPermission(address(0), address(vault), vault.ALLOWANCE_REQUESTOR_ROLE(), address(voting));

        // FINANCE

        // Founders can create payments (voting can change this)
        _kernel.createPermission(address(founderGroup), address(finance), finance.PAYMENT_CREATOR_ROLE(), address(voting));
        // Founders can disable payments (founders can change this)
        _kernel.createPermission(address(founderGroup), address(finance), finance.DISABLE_PAYMENT_ROLE(), address(founderGroup));
        // Founders can execute everyone's payments (founders can change this)
        _kernel.createPermission(address(founderGroup), address(finance), finance.EXECUTE_PAYMENTS_ROLE(), address(founderGroup));
        // Voting can change finance setings
        _kernel.createPermission(address(voting), address(finance), finance.CHANGE_SETTINGS_ROLE(), address(voting));
    }

    function _deployKernel() internal returns (Kernel kernel) {
        kernel = Kernel(new KernelProxy(kernelRef));
        kernel.initialize(address(this)); // allows factory to create all permissions
    }

    function _deployToken(string _tokenName, string _tokenSymbol, uint8 _tokenDecimals) internal returns (MiniMeToken token) {
        // deploy token without parent (not cloned)
        token = new MiniMeToken(minimeFactory, address(0), 0, _tokenName, _tokenDecimals, _tokenSymbol, true);
        token.generateTokens(msg.sender, 10 ** uint256(_tokenDecimals)); // give 1 token to creator
    }

    function _setAppCode(Kernel _kernel) internal {
        _kernel.createPermission(address(this), address(_kernel), _kernel.APP_UPGRADER_ROLE(), address(this));
        for (uint i = 0; i < appIds.length; i++) {
            _kernel.setAppCode(appIds[i], appCode[i]);
        }
        _kernel.revokePermission(address(this), address(_kernel), _kernel.APP_UPGRADER_ROLE());
    }

    function _deployApps(Kernel _kernel) internal returns (address[6] memory apps) {
        for (uint i = 0; i < apps.length; i++) {
            apps[i] = new AppProxy(_kernel, appIds[i]);
        }
    }

    function _setupVoting(VotingApp _voting, MiniMeToken _token) internal {
        uint256 percentageBase = _voting.PCT_BASE();

        uint256 supportNeeded = percentageBase / 2 + 1; // 50% + 1 vote
        uint256 minimumAcceptanceQuorum = percentageBase / 5 + 1; // 20% + 1 vote

        _voting.initialize(_token, supportNeeded, minimumAcceptanceQuorum, 7 days);

    }

    function _setupTokenManager(TokenManager _tokenManager, MiniMeToken _token) internal {
        _token.changeController(address(_tokenManager));

        _tokenManager.initializeNative(_token);
    }

    function _removeFactoryPermissions(Kernel _kernel) internal {
        _kernel.revokePermission(address(this), address(_kernel), _kernel.PERMISSION_CREATOR_ROLE());
    }
}
