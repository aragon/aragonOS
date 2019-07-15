pragma solidity 0.4.24;

import "../../../../common/SafeERC20.sol";
import "../../../../lib/token/ERC20.sol";


contract SafeERC20Mock {
    using SafeERC20 for ERC20;
    event Result(bool result);

    function transfer(ERC20 token, address to, uint256 amount) external returns (bool) {
        bool result = token.safeTransfer(to, amount);
        emit Result(result);
        return result;
    }

    function transferFrom(ERC20 token, address from, address to, uint256 amount) external returns (bool) {
        bool result = token.safeTransferFrom(from, to, amount);
        emit Result(result);
        return result;
    }

    function approve(ERC20 token, address spender, uint256 amount) external returns (bool) {
        bool result = token.safeApprove(spender, amount);
        emit Result(result);
        return result;
    }

    function allowance(ERC20 token, address owner, address spender) external view returns (uint256) {
        return token.staticAllowance(owner, spender);
    }

    function balanceOf(ERC20 token, address owner) external view returns (uint256) {
        return token.staticBalanceOf(owner);
    }

    function totalSupply(ERC20 token) external view returns (uint256) {
        return token.staticTotalSupply();
    }
}
