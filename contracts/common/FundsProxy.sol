pragma solidity 0.4.18;

import "./DelegateProxy.sol";
import "../lib/zeppelin/token/ERC20.sol";
import "../lib/misc/ERCProxy.sol";


contract FundsProxy is DelegateProxy, ERCProxy {
    address constant public ETH = 0x0;

    event ProxyDeposit(address sender, uint256 value);

    function getDefaultVault() internal returns (address);

    /**
     * @notice Send funds to default Vault. This contract should never receive funds,
     *         but in case it does, this function allows to recover them.
     * @param _token Token balance to be sent to Vault. ETH(0x0) for ether.
     */
    function transferToVault(address _token) external {
        address vault = getDefaultVault();
        require(isContract(vault));

        if (_token == ETH) {
            vault.transfer(address(this).balance);
        } else {
            uint256 amount = ERC20(_token).balanceOf(this);
            ERC20(_token).transfer(vault, amount);
        }
    }

    function () payable public {
        // all calls except for send or transfer
        if (msg.gas > 10000) {
            address target = implementation();
            require(target != 0); // if app code hasn't been set yet, don't call
            delegatedFwd(target, msg.data);
        }

        // send / transfer
        require(msg.value > 0 && msg.data.length == 0);
        ProxyDeposit(msg.sender, msg.value);
    }
}
