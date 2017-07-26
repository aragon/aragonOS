/*
This is an automatically generated file. Please edit BasicFactory.sol.tmpl or the generate_factory.js script
*/

pragma solidity ^0.4.11;

import "../tokens/MiniMeIrrevocableVestedToken.sol";
import "../dao/DAO.sol";
import "../organs/MetaOrgan.sol";
import "./ApplicationFactory.sol";

contract BasicFactory {
    address metaorgan;
    address vaultorgan;
    address actionsorgan;

    ApplicationFactory bylawsapp;
    ApplicationFactory ownershipapp;
    ApplicationFactory statusapp;
    ApplicationFactory votingapp;

    function BasicFactory(address _kernel, address _metaorgan, address _vaultorgan, address _actionsorgan, address _bylawsapp, address _ownershipapp, address _statusapp, address _votingapp) {
        metaorgan = _metaorgan;
        vaultorgan = _vaultorgan;
        actionsorgan = _actionsorgan;
        bylawsapp = ApplicationFactory(_bylawsapp);
        ownershipapp = ApplicationFactory(_ownershipapp);
        statusapp = ApplicationFactory(_statusapp);
        votingapp = ApplicationFactory(_votingapp);
    }

    function create(string _tokenName, string _tokenSymbol) {
        MiniMeIrrevocableVestedToken token = new MiniMeIrrevocableVestedToken(0, 0, 0, _tokenName, 1, _tokenSymbol, true);
        DAO dao = new DAO(0);
        token.changeController(address(dao));
        installOrgans(MetaOrgan(dao));
    }

    function installOrgans(MetaOrgan dao) internal {
        bytes4[] memory metaorganSigs = new bytes4[](8);
        metaorganSigs[0] = 0x080440a6; // setPermissionsOracle(address)
        metaorganSigs[1] = 0x4ef6cf12; // removeOrgan(bytes4[])
        metaorganSigs[2] = 0x58184ef2; // installOrgan(address,bytes4[])
        metaorganSigs[3] = 0x59a565d7; // installApp(address,bytes4[])
        metaorganSigs[4] = 0x5bb95c74; // ceaseToExist()
        metaorganSigs[5] = 0x62a2cf0c; // get(bytes4)
        metaorganSigs[6] = 0x869effe3; // removeApp(bytes4[])
        metaorganSigs[7] = 0xcebe30ac; // replaceKernel(address)
        dao.installOrgan(metaorgan, metaorganSigs);

        bytes4[] memory vaultorganSigs = new bytes4[](15);
        vaultorganSigs[0] = 0x05b1137b; // transferEther(address,uint256)
        vaultorganSigs[1] = 0x1ff0769a; // setTokenBlacklist(address,bool)
        vaultorganSigs[2] = 0x21a342e8; // setupEtherToken()
        vaultorganSigs[3] = 0x3aecd0e3; // getTokenBalance(address)
        vaultorganSigs[4] = 0x4371677c; // getScapeHatch()
        vaultorganSigs[5] = 0x47e7ef24; // deposit(address,uint256)
        vaultorganSigs[6] = 0x648bf774; // recover(address,address)
        vaultorganSigs[7] = 0x6ad419a8; // setEtherToken(address)
        vaultorganSigs[8] = 0x863ca8f0; // scapeHatch(address[])
        vaultorganSigs[9] = 0x877d08ee; // getEtherToken()
        vaultorganSigs[10] = 0xae2ae305; // getHaltTime()
        vaultorganSigs[11] = 0xbeabacc8; // transfer(address,address,uint256)
        vaultorganSigs[12] = 0xc4e65c99; // setScapeHatch(address)
        vaultorganSigs[13] = 0xce9be9ba; // isTokenBlacklisted(address)
        vaultorganSigs[14] = 0xfb1fad50; // halt(uint256)
        dao.installOrgan(vaultorgan, vaultorganSigs);

        bytes4[] memory actionsorganSigs = new bytes4[](1);
        actionsorganSigs[0] = 0x4036176a; // performAction(address,bytes)
        dao.installOrgan(actionsorgan, actionsorganSigs);

    }

    function installApps(MetaOrgan dao) internal {
        address deployedbylawsapp = bylawsapp.deployApp(address(dao));
        bytes4[] memory bylawsappSigs = new bytes4[](15);
        bylawsappSigs[0] = 0x1d304a28; // getStatusBylaw(uint256)
        bylawsappSigs[1] = 0x29fcb9e4; // setCombinatorBylaw(uint256,uint256,uint256,bool)
        bylawsappSigs[2] = 0x2ca60ae3; // linkBylaw(bytes4,uint256)
        bylawsappSigs[3] = 0x39d2245b; // setStatusBylaw(uint8,bool,bool)
        bylawsappSigs[4] = 0x423c962c; // setVotingBylaw(uint256,uint256,uint64,uint64,bool)
        bylawsappSigs[5] = 0x50839d11; // getAddressBylaw(uint256)
        bylawsappSigs[6] = 0x51102b4b; // negateIfNeeded(bool,bool)
        bylawsappSigs[7] = 0x7ac41ef5; // getBylawType(uint256)
        bylawsappSigs[8] = 0x7b0dfa35; // getVotingBylaw(uint256)
        bylawsappSigs[9] = 0x81a08245; // setAddressBylaw(address,bool,bool)
        bylawsappSigs[10] = 0xb18fe4f3; // canPerformAction(address,address,uint256,bytes)
        bylawsappSigs[11] = 0xbbd8f9e1; // canPerformAction(bytes4,address,bytes,address,uint256)
        bylawsappSigs[12] = 0xe289793e; // getBylawNot(uint256)
        bylawsappSigs[13] = 0xe69308d2; // getCombinatorBylaw(uint256)
        bylawsappSigs[14] = 0xea986c0a; // bylawEntrypoint(bytes4)
        dao.installOrgan(deployedbylawsapp, bylawsappSigs);

        address deployedownershipapp = ownershipapp.deployApp(address(dao));
        bytes4[] memory ownershipappSigs = new bytes4[](23);
        ownershipappSigs[0] = 0x10451468; // sale_closeSale()
        ownershipappSigs[1] = 0x1fbc147b; // getTokenSale(uint256)
        ownershipappSigs[2] = 0x3bc5de30; // getData()
        ownershipappSigs[3] = 0x3de7c5c5; // createTokenSale(address,address,bool)
        ownershipappSigs[4] = 0x3eaacd90; // sale_destroyTokens(address,address,uint256)
        ownershipappSigs[5] = 0x475a9fa9; // issueTokens(address,uint256)
        ownershipappSigs[6] = 0x4a393149; // onTransfer(address,address,uint256)
        ownershipappSigs[7] = 0x5fa7b584; // removeToken(address)
        ownershipappSigs[8] = 0x611cdd8f; // tokenSaleForAddress(address)
        ownershipappSigs[9] = 0x67ccdf38; // getTokenAddress(uint256)
        ownershipappSigs[10] = 0x78a89567; // getTokenCount()
        ownershipappSigs[11] = 0x897bc45d; // updateIsController(address)
        ownershipappSigs[12] = 0x9075845d; // tokenIdForAddress(address)
        ownershipappSigs[13] = 0xaef268fa; // addToken(address,uint256,uint128,uint128)
        ownershipappSigs[14] = 0xd30def44; // grantVestedTokens(address,address,uint256,uint64,uint64,uint64)
        ownershipappSigs[15] = 0xd49d6a0f; // sale_mintTokens(address,address,uint256)
        ownershipappSigs[16] = 0xd4d7b19a; // isHolder(address)
        ownershipappSigs[17] = 0xd985992f; // getTokenSaleCount()
        ownershipappSigs[18] = 0xda682aeb; // onApprove(address,address,uint256)
        ownershipappSigs[19] = 0xdbf5eb1c; // closeTokenSale(address)
        ownershipappSigs[20] = 0xe4b50cb8; // getToken(uint256)
        ownershipappSigs[21] = 0xf48c3054; // proxyPayment(address)
        ownershipappSigs[22] = 0xf881a92f; // grantTokens(address,address,uint256)
        dao.installOrgan(deployedownershipapp, ownershipappSigs);

        address deployedstatusapp = statusapp.deployApp(address(dao));
        bytes4[] memory statusappSigs = new bytes4[](2);
        statusappSigs[0] = 0x6035fa06; // setEntityStatus(address,uint8)
        statusappSigs[1] = 0x6b87cdc4; // entityStatus(address)
        dao.installOrgan(deployedstatusapp, statusappSigs);

        address deployedvotingapp = votingapp.deployApp(address(dao));
        bytes4[] memory votingappSigs = new bytes4[](13);
        votingappSigs[0] = 0x014396f2; // voteNay(uint256)
        votingappSigs[1] = 0x0519bb83; // getVoteStatus(uint256)
        votingappSigs[2] = 0x0cacbd1c; // isVoteCodeValid(address)
        votingappSigs[3] = 0x23e6c756; // hashForCode(address)
        votingappSigs[4] = 0x3ae05af2; // createVote(address,uint64,uint64)
        votingappSigs[5] = 0x3dfcedfe; // transitionStateIfChanged(uint256)
        votingappSigs[6] = 0x48681a20; // validVoteCode(bytes32)
        votingappSigs[7] = 0x64bfa2f6; // setValidVoteCode(bytes32,bool)
        votingappSigs[8] = 0x8f328d7a; // voteYay(uint256)
        votingappSigs[9] = 0xad49224c; // isVoteApproved(address,uint256,uint256,uint64,uint64)
        votingappSigs[10] = 0xad5dd1f5; // getStatusForVoteAddress(address)
        votingappSigs[11] = 0xcf9883e2; // voteYayAndClose(uint256)
        votingappSigs[12] = 0xeb67cee8; // contractSize(address)
        dao.installOrgan(deployedvotingapp, votingappSigs);

    }
}
