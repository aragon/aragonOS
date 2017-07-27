pragma solidity ^0.4.13;

import "zeppelin/token/ERC20.sol";
import "../../../organs/VaultOrgan.sol";
import "../../../kernel/Kernel.sol";
import "../../../tokens/EtherToken.sol";

import "../OwnershipApp.sol";


contract TokenSale {
    address public dao;
    OwnershipApp public ownershipApp;
    ERC20 public raiseToken;
    ERC20 public saleToken;

    event Buy(address indexed buyer, uint amount);
    event Sell(address indexed seller, uint amount);

    function buy(address holder, uint256 amount) internal;
    function sell(address holder, uint256 amount) internal;

    function instantiate(
        address _dao,
        OwnershipApp _ownershipApp,
        ERC20 _raiseToken,
        ERC20 _saleToken
    ) internal
    {
        require(dao == 0 && _dao != 0);
        dao = _dao;
        ownershipApp = _ownershipApp;
        raiseToken = _raiseToken;
        saleToken = _saleToken;
    }

    function tokenFallback(
        address _sender,
        address _origin,
        uint256 _value,
        bytes _data
    ) onlyToken returns (bool ok)
    {
        buy(_sender, _value);
        return true;
    }

    // ApproveAndCall compatible
    function receiveApproval(
        address _sender,
        uint256 _value,
        address _token,
        bytes _data
    ) {
        assert(
            ERC20(_token)
            .transferFrom(
                _sender,
                address(this),
                _value
            )
        );
        buy(_sender, _value);
    }

    function buy(address holder) payable {
        EtherToken etherToken = getEtherToken();
        require(raiseToken == etherToken);

        etherToken.wrap.value(msg.value)();
        buy(holder, msg.value);
    }

    function () payable {
        buy(msg.sender);
    }

    function mintTokens(address _recipient, uint _amount) internal {
        ownershipApp.sale_mintTokens(address(saleToken), _recipient, _amount);
    }

    function destroyTokens(address _holder, uint _amount) internal {
        ownershipApp.sale_destroyTokens(address(saleToken), _holder, _amount);
    }

    function closeSale() internal {
        sendFunds();
        ownershipApp.sale_closeSale();
    }

    // @dev make a send that is compatible with any kind of erc20
    function sendFunds() internal {
        raiseToken.approve(dao, 0);  // jic to avoid contracts that throw for not being 0 before allowance

        uint balance = raiseToken.balanceOf(address(this));
        if (balance == 0)
            return;
        raiseToken.approve(dao, balance);
        Kernel(dao).receiveApproval(
            address(this),
            balance,
            address(raiseToken),
            new bytes(0)
        );
    }

    function getEtherToken() constant returns (EtherToken) {
        return EtherToken(
            VaultOrgan(dao)
            .getEtherToken()
        );
    }

    // @dev just for mocking purposes
    function getBlockNumber() internal returns (uint64) {
        return uint64(block.number);
    }

    modifier onlyToken {
        require(msg.sender != address(raiseToken));
        _;
    }
}
