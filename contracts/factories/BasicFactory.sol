/*
This is an automatically generated file. Please edit BasicFactory.sol.tmpl or the generate_factory.js script
*/

pragma solidity ^0.4.11;

import "../tokens/MiniMeIrrevocableVestedToken.sol";
import "../dao/DAO.sol";
import "../organs/MetaOrgan.sol";
import "../apps/Application.sol";
import "../apps/ownership/OwnershipApp.sol";
import "../apps/bylaws/BylawsApp.sol";
import "./ForwarderFactory.sol";

contract BasicFactory {
    event DeployedDAO(address dao);
    address public kernel;
    ForwarderFactory public forwarderFactory;
    address public metaorgan;
    address public vaultorgan;
    address public actionsorgan;

    address public bylawsapp;
    address public ownershipapp;
    address public statusapp;
    address public votingapp;

    function BasicFactory(address _kernel, ForwarderFactory _forwarderFactory, address _metaorgan, address _vaultorgan, address _actionsorgan, address _bylawsapp, address _ownershipapp, address _statusapp, address _votingapp) {
        kernel = _kernel;
        forwarderFactory = _forwarderFactory;
        metaorgan = _metaorgan;
        vaultorgan = _vaultorgan;
        actionsorgan = _actionsorgan;
        bylawsapp = _bylawsapp;
        ownershipapp = _ownershipapp;
        statusapp = _statusapp;
        votingapp = _votingapp;
    }

    function create(string _tokenName, string _tokenSymbol, bool _testrpc) {
        MiniMeIrrevocableVestedToken token = new MiniMeIrrevocableVestedToken(0, 0, 0, _tokenName, 1, _tokenSymbol, true);
        DAO dao = new DAO(kernel);
        token.changeController(address(dao));
        installOrgans(MetaOrgan(dao));
        address bylawsApp = installApps(MetaOrgan(dao), _testrpc);
        issueToken(address(dao), address(token));
        installBylaws(BylawsApp(bylawsApp), BylawsApp(address(dao)));
        MetaOrgan(dao).setPermissionsOracle(bylawsApp);
        // TODO: set status for sender

        DeployedDAO(dao);
    }

    function installOrgans(MetaOrgan dao) internal {
        bytes4[] memory metaorganSigs = new bytes4[](8);
        metaorganSigs[0] = o0_s0; // setPermissionsOracle(address)
        metaorganSigs[1] = o0_s1; // removeOrgan(bytes4[])
        metaorganSigs[2] = o0_s2; // installOrgan(address,bytes4[])
        metaorganSigs[3] = o0_s3; // installApp(address,bytes4[])
        metaorganSigs[4] = o0_s4; // ceaseToExist()
        metaorganSigs[5] = o0_s5; // get(bytes4)
        metaorganSigs[6] = o0_s6; // removeApp(bytes4[])
        metaorganSigs[7] = o0_s7; // replaceKernel(address)
        dao.installOrgan(metaorgan, metaorganSigs);

        bytes4[] memory vaultorganSigs = new bytes4[](15);
        vaultorganSigs[0] = o1_s0; // transferEther(address,uint256)
        vaultorganSigs[1] = o1_s1; // setTokenBlacklist(address,bool)
        vaultorganSigs[2] = o1_s2; // setupEtherToken()
        vaultorganSigs[3] = o1_s3; // getTokenBalance(address)
        vaultorganSigs[4] = o1_s4; // getScapeHatch()
        vaultorganSigs[5] = o1_s5; // deposit(address,uint256)
        vaultorganSigs[6] = o1_s6; // recover(address,address)
        vaultorganSigs[7] = o1_s7; // setEtherToken(address)
        vaultorganSigs[8] = o1_s8; // scapeHatch(address[])
        vaultorganSigs[9] = o1_s9; // getEtherToken()
        vaultorganSigs[10] = o1_s10; // getHaltTime()
        vaultorganSigs[11] = o1_s11; // transfer(address,address,uint256)
        vaultorganSigs[12] = o1_s12; // setScapeHatch(address)
        vaultorganSigs[13] = o1_s13; // isTokenBlacklisted(address)
        vaultorganSigs[14] = o1_s14; // halt(uint256)
        dao.installOrgan(vaultorgan, vaultorganSigs);

        bytes4[] memory actionsorganSigs = new bytes4[](1);
        actionsorganSigs[0] = o2_s0; // performAction(address,bytes)
        dao.installOrgan(actionsorgan, actionsorganSigs);

    }

    function installApps(MetaOrgan dao, bool _testrpc) internal returns (address app) {
        // Proxies are not working on testrpc, that's why for testing no proxy is created
        Application deployedbylawsapp = Application(_testrpc ? bylawsapp : forwarderFactory.createForwarder(bylawsapp));
        deployedbylawsapp.setDAO(address(dao));
        bytes4[] memory bylawsappSigs = new bytes4[](14);
        bylawsappSigs[0] = a0_s0; // getStatusBylaw(uint256)
        bylawsappSigs[1] = a0_s1; // setCombinatorBylaw(uint256,uint256,uint256,bool)
        bylawsappSigs[2] = a0_s2; // linkBylaw(bytes4,uint256)
        bylawsappSigs[3] = a0_s3; // setStatusBylaw(uint8,bool,bool)
        bylawsappSigs[4] = a0_s4; // setVotingBylaw(uint256,uint256,uint64,uint64,bool)
        bylawsappSigs[5] = a0_s5; // getAddressBylaw(uint256)
        bylawsappSigs[6] = a0_s6; // negateIfNeeded(bool,bool)
        bylawsappSigs[7] = a0_s7; // getBylawType(uint256)
        bylawsappSigs[8] = a0_s8; // getVotingBylaw(uint256)
        bylawsappSigs[9] = a0_s9; // setAddressBylaw(address,bool,bool)
        bylawsappSigs[10] = a0_s10; // canPerformAction(address,address,uint256,bytes)
        bylawsappSigs[11] = a0_s11; // getBylawNot(uint256)
        bylawsappSigs[12] = a0_s12; // getCombinatorBylaw(uint256)
        bylawsappSigs[13] = a0_s13; // bylawEntrypoint(bytes4)
        dao.installApp(deployedbylawsapp, bylawsappSigs);

        // Proxies are not working on testrpc, that's why for testing no proxy is created
        Application deployedownershipapp = Application(_testrpc ? ownershipapp : forwarderFactory.createForwarder(ownershipapp));
        deployedownershipapp.setDAO(address(dao));
        bytes4[] memory ownershipappSigs = new bytes4[](22);
        ownershipappSigs[0] = a1_s0; // sale_closeSale()
        ownershipappSigs[1] = a1_s1; // getTokenSale(uint256)
        ownershipappSigs[2] = a1_s2; // createTokenSale(address,address,bool)
        ownershipappSigs[3] = a1_s3; // sale_destroyTokens(address,address,uint256)
        ownershipappSigs[4] = a1_s4; // issueTokens(address,uint256)
        ownershipappSigs[5] = a1_s5; // onTransfer(address,address,uint256)
        ownershipappSigs[6] = a1_s6; // removeToken(address)
        ownershipappSigs[7] = a1_s7; // tokenSaleForAddress(address)
        ownershipappSigs[8] = a1_s8; // getTokenAddress(uint256)
        ownershipappSigs[9] = a1_s9; // getTokenCount()
        ownershipappSigs[10] = a1_s10; // updateIsController(address)
        ownershipappSigs[11] = a1_s11; // tokenIdForAddress(address)
        ownershipappSigs[12] = a1_s12; // addToken(address,uint256,uint128,uint128)
        ownershipappSigs[13] = a1_s13; // grantVestedTokens(address,address,uint256,uint64,uint64,uint64)
        ownershipappSigs[14] = a1_s14; // sale_mintTokens(address,address,uint256)
        ownershipappSigs[15] = a1_s15; // isHolder(address)
        ownershipappSigs[16] = a1_s16; // getTokenSaleCount()
        ownershipappSigs[17] = a1_s17; // onApprove(address,address,uint256)
        ownershipappSigs[18] = a1_s18; // closeTokenSale(address)
        ownershipappSigs[19] = a1_s19; // getToken(uint256)
        ownershipappSigs[20] = a1_s20; // proxyPayment(address)
        ownershipappSigs[21] = a1_s21; // grantTokens(address,address,uint256)
        dao.installApp(deployedownershipapp, ownershipappSigs);

        // Proxies are not working on testrpc, that's why for testing no proxy is created
        Application deployedstatusapp = Application(_testrpc ? statusapp : forwarderFactory.createForwarder(statusapp));
        deployedstatusapp.setDAO(address(dao));
        bytes4[] memory statusappSigs = new bytes4[](2);
        statusappSigs[0] = a2_s0; // setEntityStatus(address,uint8)
        statusappSigs[1] = a2_s1; // entityStatus(address)
        dao.installApp(deployedstatusapp, statusappSigs);

        // Proxies are not working on testrpc, that's why for testing no proxy is created
        Application deployedvotingapp = Application(_testrpc ? votingapp : forwarderFactory.createForwarder(votingapp));
        deployedvotingapp.setDAO(address(dao));
        bytes4[] memory votingappSigs = new bytes4[](12);
        votingappSigs[0] = a3_s0; // voteNay(uint256)
        votingappSigs[1] = a3_s1; // getVoteStatus(uint256)
        votingappSigs[2] = a3_s2; // isVoteCodeValid(address)
        votingappSigs[3] = a3_s3; // hashForCode(address)
        votingappSigs[4] = a3_s4; // createVote(address,uint64,uint64)
        votingappSigs[5] = a3_s5; // transitionStateIfChanged(uint256)
        votingappSigs[6] = a3_s6; // validVoteCode(bytes32)
        votingappSigs[7] = a3_s7; // setValidVoteCode(bytes32,bool)
        votingappSigs[8] = a3_s8; // voteYay(uint256)
        votingappSigs[9] = a3_s9; // isVoteApproved(address,uint256,uint256,uint64,uint64)
        votingappSigs[10] = a3_s10; // getStatusForVoteAddress(address)
        votingappSigs[11] = a3_s11; // voteYayAndClose(uint256)
        dao.installApp(deployedvotingapp, votingappSigs);

        return deployedbylawsapp; // first app is bylaws
    }

    function installBylaws(BylawsApp bylaws, BylawsApp dao_bylaws) internal {
        uint bylaw_1 = bylaws.setVotingBylaw(pct(80), pct(100), 1 days, 7 days, false);
        uint bylaw_2 = bylaws.setVotingBylaw(pct(75), pct(0), 1 days, 7 days, false);
        uint bylaw_3 = bylaws.setStatusBylaw(3, false, false);

        dao_bylaws.linkBylaw(o0_s0, bylaw_2); // setPermissionsOracle(address)
        dao_bylaws.linkBylaw(o0_s1, bylaw_2); // removeOrgan(bytes4[])
        dao_bylaws.linkBylaw(o0_s2, bylaw_2); // installOrgan(address,bytes4[])
        dao_bylaws.linkBylaw(o0_s3, bylaw_3); // installApp(address,bytes4[])
        dao_bylaws.linkBylaw(o0_s4, bylaw_1); // ceaseToExist()
        dao_bylaws.linkBylaw(o0_s6, bylaw_2); // removeApp(bytes4[])
        dao_bylaws.linkBylaw(o0_s7, bylaw_2); // replaceKernel(address)
    }

    function pct(uint x) internal constant returns (uint) {
        return x * 10 ** 16;
    }

    function issueToken(address dao, address token) internal {
        OwnershipApp(dao).addToken(address(token), 1, 1, 1);
        OwnershipApp(dao).grantTokens(address(token), msg.sender, 1);
    }

    // metaorgan
    bytes4 constant o0_s0 = 0x080440a6; // setPermissionsOracle(address)
    bytes4 constant o0_s1 = 0x4ef6cf12; // removeOrgan(bytes4[])
    bytes4 constant o0_s2 = 0x58184ef2; // installOrgan(address,bytes4[])
    bytes4 constant o0_s3 = 0x59a565d7; // installApp(address,bytes4[])
    bytes4 constant o0_s4 = 0x5bb95c74; // ceaseToExist()
    bytes4 constant o0_s5 = 0x62a2cf0c; // get(bytes4)
    bytes4 constant o0_s6 = 0x869effe3; // removeApp(bytes4[])
    bytes4 constant o0_s7 = 0xcebe30ac; // replaceKernel(address)
    // vaultorgan
    bytes4 constant o1_s0 = 0x05b1137b; // transferEther(address,uint256)
    bytes4 constant o1_s1 = 0x1ff0769a; // setTokenBlacklist(address,bool)
    bytes4 constant o1_s2 = 0x21a342e8; // setupEtherToken()
    bytes4 constant o1_s3 = 0x3aecd0e3; // getTokenBalance(address)
    bytes4 constant o1_s4 = 0x4371677c; // getScapeHatch()
    bytes4 constant o1_s5 = 0x47e7ef24; // deposit(address,uint256)
    bytes4 constant o1_s6 = 0x648bf774; // recover(address,address)
    bytes4 constant o1_s7 = 0x6ad419a8; // setEtherToken(address)
    bytes4 constant o1_s8 = 0x863ca8f0; // scapeHatch(address[])
    bytes4 constant o1_s9 = 0x877d08ee; // getEtherToken()
    bytes4 constant o1_s10 = 0xae2ae305; // getHaltTime()
    bytes4 constant o1_s11 = 0xbeabacc8; // transfer(address,address,uint256)
    bytes4 constant o1_s12 = 0xc4e65c99; // setScapeHatch(address)
    bytes4 constant o1_s13 = 0xce9be9ba; // isTokenBlacklisted(address)
    bytes4 constant o1_s14 = 0xfb1fad50; // halt(uint256)
    // actionsorgan
    bytes4 constant o2_s0 = 0x4036176a; // performAction(address,bytes)
    // bylawsapp
    bytes4 constant a0_s0 = 0x1d304a28; // getStatusBylaw(uint256)
    bytes4 constant a0_s1 = 0x29fcb9e4; // setCombinatorBylaw(uint256,uint256,uint256,bool)
    bytes4 constant a0_s2 = 0x2ca60ae3; // linkBylaw(bytes4,uint256)
    bytes4 constant a0_s3 = 0x39d2245b; // setStatusBylaw(uint8,bool,bool)
    bytes4 constant a0_s4 = 0x423c962c; // setVotingBylaw(uint256,uint256,uint64,uint64,bool)
    bytes4 constant a0_s5 = 0x50839d11; // getAddressBylaw(uint256)
    bytes4 constant a0_s6 = 0x51102b4b; // negateIfNeeded(bool,bool)
    bytes4 constant a0_s7 = 0x7ac41ef5; // getBylawType(uint256)
    bytes4 constant a0_s8 = 0x7b0dfa35; // getVotingBylaw(uint256)
    bytes4 constant a0_s9 = 0x81a08245; // setAddressBylaw(address,bool,bool)
    bytes4 constant a0_s10 = 0xb18fe4f3; // canPerformAction(address,address,uint256,bytes)
    bytes4 constant a0_s11 = 0xe289793e; // getBylawNot(uint256)
    bytes4 constant a0_s12 = 0xe69308d2; // getCombinatorBylaw(uint256)
    bytes4 constant a0_s13 = 0xea986c0a; // bylawEntrypoint(bytes4)
    // ownershipapp
    bytes4 constant a1_s0 = 0x10451468; // sale_closeSale()
    bytes4 constant a1_s1 = 0x1fbc147b; // getTokenSale(uint256)
    bytes4 constant a1_s2 = 0x3de7c5c5; // createTokenSale(address,address,bool)
    bytes4 constant a1_s3 = 0x3eaacd90; // sale_destroyTokens(address,address,uint256)
    bytes4 constant a1_s4 = 0x475a9fa9; // issueTokens(address,uint256)
    bytes4 constant a1_s5 = 0x4a393149; // onTransfer(address,address,uint256)
    bytes4 constant a1_s6 = 0x5fa7b584; // removeToken(address)
    bytes4 constant a1_s7 = 0x611cdd8f; // tokenSaleForAddress(address)
    bytes4 constant a1_s8 = 0x67ccdf38; // getTokenAddress(uint256)
    bytes4 constant a1_s9 = 0x78a89567; // getTokenCount()
    bytes4 constant a1_s10 = 0x897bc45d; // updateIsController(address)
    bytes4 constant a1_s11 = 0x9075845d; // tokenIdForAddress(address)
    bytes4 constant a1_s12 = 0xaef268fa; // addToken(address,uint256,uint128,uint128)
    bytes4 constant a1_s13 = 0xd30def44; // grantVestedTokens(address,address,uint256,uint64,uint64,uint64)
    bytes4 constant a1_s14 = 0xd49d6a0f; // sale_mintTokens(address,address,uint256)
    bytes4 constant a1_s15 = 0xd4d7b19a; // isHolder(address)
    bytes4 constant a1_s16 = 0xd985992f; // getTokenSaleCount()
    bytes4 constant a1_s17 = 0xda682aeb; // onApprove(address,address,uint256)
    bytes4 constant a1_s18 = 0xdbf5eb1c; // closeTokenSale(address)
    bytes4 constant a1_s19 = 0xe4b50cb8; // getToken(uint256)
    bytes4 constant a1_s20 = 0xf48c3054; // proxyPayment(address)
    bytes4 constant a1_s21 = 0xf881a92f; // grantTokens(address,address,uint256)
    // statusapp
    bytes4 constant a2_s0 = 0x6035fa06; // setEntityStatus(address,uint8)
    bytes4 constant a2_s1 = 0x6b87cdc4; // entityStatus(address)
    // votingapp
    bytes4 constant a3_s0 = 0x014396f2; // voteNay(uint256)
    bytes4 constant a3_s1 = 0x0519bb83; // getVoteStatus(uint256)
    bytes4 constant a3_s2 = 0x0cacbd1c; // isVoteCodeValid(address)
    bytes4 constant a3_s3 = 0x23e6c756; // hashForCode(address)
    bytes4 constant a3_s4 = 0x3ae05af2; // createVote(address,uint64,uint64)
    bytes4 constant a3_s5 = 0x3dfcedfe; // transitionStateIfChanged(uint256)
    bytes4 constant a3_s6 = 0x48681a20; // validVoteCode(bytes32)
    bytes4 constant a3_s7 = 0x64bfa2f6; // setValidVoteCode(bytes32,bool)
    bytes4 constant a3_s8 = 0x8f328d7a; // voteYay(uint256)
    bytes4 constant a3_s9 = 0xad49224c; // isVoteApproved(address,uint256,uint256,uint64,uint64)
    bytes4 constant a3_s10 = 0xad5dd1f5; // getStatusForVoteAddress(address)
    bytes4 constant a3_s11 = 0xcf9883e2; // voteYayAndClose(uint256)
}
