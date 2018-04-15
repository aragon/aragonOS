pragma solidity 0.4.18;

import "./DelegateProxy.sol";
import "../common/EtherTokenConstant.sol";
import "../lib/zeppelin/token/ERC20.sol";
import "../lib/misc/ERCProxy.sol";


contract FundsProxy is DelegateProxy, ERCProxy, EtherTokenConstant {
    event ProxyDeposit(address sender, uint256 value);

    function getDefaultVault() internal returns (address);

    /**
     * @notice Send funds to default Vault. This contract should never receive funds,
     *         but in case it does, this function allows to recover them.
     * @param _token Token balance to be sent to Vault.
     */
    function transferToVault(address _token) external {
        address vault = getDefaultVault();
        require(isContract(vault));

        if (_token == ETH) {
            // solium-disable-next-line security/no-call-value
            require(vault.call.value(address(this).balance)());
        } else {
            uint256 amount = ERC20(_token).balanceOf(this);
            ERC20(_token).transfer(vault, amount);
        }
    }

    function () payable public {
        // send / transfer
        if (msg.gas < FWD_GAS_LIMIT) {
            require(msg.value > 0 && msg.data.length == 0);
            ProxyDeposit(msg.sender, msg.value);
        } else { // all calls except for send or transfer
            address target = implementation();
            delegatedFwd(target, msg.data);
        }
    }
}
