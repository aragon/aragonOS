/*
This is an automatically generated file. Please edit BasicFactory.sol.tmpl or the generate_factory.js script
*/

pragma solidity ^0.4.11;

import "../tokens/MiniMeIrrevocableVestedToken.sol";
import "../dao/DAO.sol";
import "../organs/MetaOrgan.sol";
import "../apps/Application.sol";
import "../apps/ownership/OwnershipApp.sol";
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
        installApps(MetaOrgan(dao), _testrpc);
        issueToken(address(dao), address(token));
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

    function installApps(MetaOrgan dao, bool _testrpc) internal {
        // Proxies are not working on testrpc, that's why for testing no proxy is created
        Application deployedbylawsapp = Application(_testrpc ? bylawsapp : forwarderFactory.createForwarder(bylawsapp));
        deployedbylawsapp.setDAO(address(dao));
        bytes4[] memory bylawsappSigs = new bytes4[](15);
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
        bylawsappSigs[11] = a0_s11; // canPerformAction(bytes4,address,bytes,address,uint256)
        bylawsappSigs[12] = a0_s12; // getBylawNot(uint256)
        bylawsappSigs[13] = a0_s13; // getCombinatorBylaw(uint256)
        bylawsappSigs[14] = a0_s14; // bylawEntrypoint(bytes4)
        dao.installApp(deployedbylawsapp, bylawsappSigs);

        // Proxies are not working on testrpc, that's why for testing no proxy is created
        Application deployedownershipapp = Application(_testrpc ? ownershipapp : forwarderFactory.createForwarder(ownershipapp));
        deployedownershipapp.setDAO(address(dao));
        bytes4[] memory ownershipappSigs = new bytes4[](23);
        ownershipappSigs[0] = a1_s0; // sale_closeSale()
        ownershipappSigs[1] = a1_s1; // getTokenSale(uint256)
        ownershipappSigs[2] = a1_s2; // getData()
        ownershipappSigs[3] = a1_s3; // createTokenSale(address,address,bool)
        ownershipappSigs[4] = a1_s4; // sale_destroyTokens(address,address,uint256)
        ownershipappSigs[5] = a1_s5; // issueTokens(address,uint256)
        ownershipappSigs[6] = a1_s6; // onTransfer(address,address,uint256)
        ownershipappSigs[7] = a1_s7; // removeToken(address)
        ownershipappSigs[8] = a1_s8; // tokenSaleForAddress(address)
        ownershipappSigs[9] = a1_s9; // getTokenAddress(uint256)
        ownershipappSigs[10] = a1_s10; // getTokenCount()
        ownershipappSigs[11] = a1_s11; // updateIsController(address)
        ownershipappSigs[12] = a1_s12; // tokenIdForAddress(address)
        ownershipappSigs[13] = a1_s13; // addToken(address,uint256,uint128,uint128)
        ownershipappSigs[14] = a1_s14; // grantVestedTokens(address,address,uint256,uint64,uint64,uint64)
        ownershipappSigs[15] = a1_s15; // sale_mintTokens(address,address,uint256)
        ownershipappSigs[16] = a1_s16; // isHolder(address)
        ownershipappSigs[17] = a1_s17; // getTokenSaleCount()
        ownershipappSigs[18] = a1_s18; // onApprove(address,address,uint256)
        ownershipappSigs[19] = a1_s19; // closeTokenSale(address)
        ownershipappSigs[20] = a1_s20; // getToken(uint256)
        ownershipappSigs[21] = a1_s21; // proxyPayment(address)
        ownershipappSigs[22] = a1_s22; // grantTokens(address,address,uint256)
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
        bytes4[] memory votingappSigs = new bytes4[](13);
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
        votingappSigs[12] = a3_s12; // contractSize(address)
        dao.installApp(deployedvotingapp, votingappSigs);

    }

    function issueToken(address dao, address token) internal {
        OwnershipApp(dao).addToken(address(token), 1, 1, 1);
        OwnershipApp(dao).grantTokens(address(token), msg.sender, 1);
    }

    bytes4 constant o0_s0 = 0x080440a6;
    bytes4 constant o0_s1 = 0x4ef6cf12;
    bytes4 constant o0_s2 = 0x58184ef2;
    bytes4 constant o0_s3 = 0x59a565d7;
    bytes4 constant o0_s4 = 0x5bb95c74;
    bytes4 constant o0_s5 = 0x62a2cf0c;
    bytes4 constant o0_s6 = 0x869effe3;
    bytes4 constant o0_s7 = 0xcebe30ac;
    bytes4 constant o1_s0 = 0x05b1137b;
    bytes4 constant o1_s1 = 0x1ff0769a;
    bytes4 constant o1_s2 = 0x21a342e8;
    bytes4 constant o1_s3 = 0x3aecd0e3;
    bytes4 constant o1_s4 = 0x4371677c;
    bytes4 constant o1_s5 = 0x47e7ef24;
    bytes4 constant o1_s6 = 0x648bf774;
    bytes4 constant o1_s7 = 0x6ad419a8;
    bytes4 constant o1_s8 = 0x863ca8f0;
    bytes4 constant o1_s9 = 0x877d08ee;
    bytes4 constant o1_s10 = 0xae2ae305;
    bytes4 constant o1_s11 = 0xbeabacc8;
    bytes4 constant o1_s12 = 0xc4e65c99;
    bytes4 constant o1_s13 = 0xce9be9ba;
    bytes4 constant o1_s14 = 0xfb1fad50;
    bytes4 constant o2_s0 = 0x4036176a;

    bytes4 constant a0_s0 = 0x1d304a28;
    bytes4 constant a0_s1 = 0x29fcb9e4;
    bytes4 constant a0_s2 = 0x2ca60ae3;
    bytes4 constant a0_s3 = 0x39d2245b;
    bytes4 constant a0_s4 = 0x423c962c;
    bytes4 constant a0_s5 = 0x50839d11;
    bytes4 constant a0_s6 = 0x51102b4b;
    bytes4 constant a0_s7 = 0x7ac41ef5;
    bytes4 constant a0_s8 = 0x7b0dfa35;
    bytes4 constant a0_s9 = 0x81a08245;
    bytes4 constant a0_s10 = 0xb18fe4f3;
    bytes4 constant a0_s11 = 0xbbd8f9e1;
    bytes4 constant a0_s12 = 0xe289793e;
    bytes4 constant a0_s13 = 0xe69308d2;
    bytes4 constant a0_s14 = 0xea986c0a;
    bytes4 constant a1_s0 = 0x10451468;
    bytes4 constant a1_s1 = 0x1fbc147b;
    bytes4 constant a1_s2 = 0x3bc5de30;
    bytes4 constant a1_s3 = 0x3de7c5c5;
    bytes4 constant a1_s4 = 0x3eaacd90;
    bytes4 constant a1_s5 = 0x475a9fa9;
    bytes4 constant a1_s6 = 0x4a393149;
    bytes4 constant a1_s7 = 0x5fa7b584;
    bytes4 constant a1_s8 = 0x611cdd8f;
    bytes4 constant a1_s9 = 0x67ccdf38;
    bytes4 constant a1_s10 = 0x78a89567;
    bytes4 constant a1_s11 = 0x897bc45d;
    bytes4 constant a1_s12 = 0x9075845d;
    bytes4 constant a1_s13 = 0xaef268fa;
    bytes4 constant a1_s14 = 0xd30def44;
    bytes4 constant a1_s15 = 0xd49d6a0f;
    bytes4 constant a1_s16 = 0xd4d7b19a;
    bytes4 constant a1_s17 = 0xd985992f;
    bytes4 constant a1_s18 = 0xda682aeb;
    bytes4 constant a1_s19 = 0xdbf5eb1c;
    bytes4 constant a1_s20 = 0xe4b50cb8;
    bytes4 constant a1_s21 = 0xf48c3054;
    bytes4 constant a1_s22 = 0xf881a92f;
    bytes4 constant a2_s0 = 0x6035fa06;
    bytes4 constant a2_s1 = 0x6b87cdc4;
    bytes4 constant a3_s0 = 0x014396f2;
    bytes4 constant a3_s1 = 0x0519bb83;
    bytes4 constant a3_s2 = 0x0cacbd1c;
    bytes4 constant a3_s3 = 0x23e6c756;
    bytes4 constant a3_s4 = 0x3ae05af2;
    bytes4 constant a3_s5 = 0x3dfcedfe;
    bytes4 constant a3_s6 = 0x48681a20;
    bytes4 constant a3_s7 = 0x64bfa2f6;
    bytes4 constant a3_s8 = 0x8f328d7a;
    bytes4 constant a3_s9 = 0xad49224c;
    bytes4 constant a3_s10 = 0xad5dd1f5;
    bytes4 constant a3_s11 = 0xcf9883e2;
    bytes4 constant a3_s12 = 0xeb67cee8;
}
