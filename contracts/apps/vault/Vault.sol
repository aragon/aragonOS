pragma solidity 0.4.15;

import "../App.sol";

import "../../zeppelin/token/ERC20.sol";

contract Vault is App {
    event SetAllowance(address indexed token, address indexed spender, uint256 amount);
    event TokenTransfer(address indexed token, address indexed receiver, uint256 amount);

    /**
    * @notice Request for `_spender` to spend up to `_amounts` in `_tokens`
    * @dev This action creates an ERC20 and will allow the spender to transferFrom the Vault address until the allowance is completely spent or it is overiden
    * @param _tokens Array of token addresses
    * @param _amounts Array of token amounts
    */
    function requestAllowances(ERC20[] _tokens, uint256[] _amounts) auth external {
        require(_tokens.length == _amounts.length);

        address spender = msg.sender;

        for (uint i = 0; i < _tokens.length; i++) {
            ERC20 token = _tokens[i];
            uint256 amount = _amounts[i];

            // Some token implementations will throw when changing an allowance from non-zero to non-zero
            // https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
            if (token.allowance(address(this), spender) > 0)
                assert(token.approve(spender, 0));

            if (amount > 0)
                assert(token.approve(spender, amount));

            SetAllowance(token, spender, amount);
        }
    }

    /**
    * @notice Transfer `_amount` `_token` from the Vault to `_receiver`
    * @dev This function should be used as little as possible, in favor of using allowances
    * @param _token Address of the token being transferred
    * @param _receiver Address of the recipient of tokens
    * @param _amount Amount of tokens being transferred
    */
    function transfer(ERC20 _token, address _receiver, uint256 _amount) auth external {
        assert(_token.transfer(_receiver, _amount));
        TokenTransfer(_token, _receiver, _amount);
    }
}
