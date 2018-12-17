// Inspired by AdEx (https://github.com/AdExNetwork/adex-protocol-eth/blob/b9df617829661a7518ee10f4cb6c4108659dd6d5/contracts/libs/SafeERC20.sol)
// and 0x (https://github.com/0xProject/0x-monorepo/blob/737d1dc54d72872e24abce5a1dbe1b66d35fa21a/contracts/protocol/contracts/protocol/AssetProxy/ERC20Proxy.sol#L143)

pragma solidity ^0.4.24;

import "../lib/token/ERC20.sol";

// Same as ERC20 except the return values of these interfaces have been removed to allow us to
// manually check them
interface GeneralERC20 {
    function transfer(address to, uint256 value) external;
    function transferFrom(address from, address to, uint256 value) external;
    function approve(address spender, uint256 value) external;
}


library SafeERC20 {
    string private constant ERROR_TOKEN_BALANCE_REVERTED = "SAFE_ERC_20_BALANCE_REVERTED";
    string private constant ERROR_TOKEN_ALLOWANCE_REVERTED = "SAFE_ERC_20_BALANCE_REVERTED";

    function checkSuccess() private pure returns (bool ret) {
        assembly {
            // Check number of bytes returned from last function call
            switch returndatasize

            // No bytes returned: assume success
            case 0x0 {
                ret := 1
            }

            // 32 bytes returned: check if non-zero
            case 0x20 {
                // Copy 32 bytes into scratch space
                returndatacopy(0x0, 0x0, 0x20)

                // Only return success if returned data was true
                ret := eq(mload(0x0), 1)
            }

            // Not sure what was returned: don't mark as success
            default { }
        }
    }

    function staticInvoke(address _addr, bytes memory _calldata)
        private
        view
        returns (bool success, uint256 ret)
    {
        assembly {
            success := staticcall(
                gas,                  // forward all gas
                _addr,                // address
                add(_calldata, 0x20), // calldata start
                mload(_calldata),     // calldata length
                0,                    // write output over scratch
                32                    // uint256 return
            )

            switch success
            case 1 {
                ret := mload(0)
            }
            default {}
        }
    }

    /**
    * @dev Same as a standards-compliant ERC20.transfer().
    *      Note that this makes an external call to the token.
    */
    function safeTransfer(ERC20 _token, address _to, uint256 _amount) internal returns (bool) {
        GeneralERC20(_token).transfer(_to, _amount);
        return checkSuccess();
    }

    /**
    * @dev Same as a standards-compliant ERC20.transferFrom().
    *      Note that this makes an external call to the token.
    */
    function safeTransferFrom(ERC20 _token, address _from, address _to, uint256 _amount) internal returns (bool) {
        GeneralERC20(_token).transferFrom(_from, _to, _amount);
        return checkSuccess();
    }

    /**
    * @dev Same as a standards-compliant ERC20.approve().
    *      Note that this makes an external call to the token.
    */
    function safeApprove(ERC20 _token, address _spender, uint256 _amount) internal returns (bool) {
        GeneralERC20(_token).approve(_spender, _amount);
        return checkSuccess();
    }

    function staticBalanceOf(ERC20 _token, address _owner) internal view returns (uint256 tokenBalance) {
        bytes memory balanceOfCallData = abi.encodeWithSelector(
            ERC20(_token).balanceOf.selector,
            _owner
        );
        bool success;
        (success, tokenBalance) = staticInvoke(_token, balanceOfCallData);
        require(success, ERROR_TOKEN_BALANCE_REVERTED);
    }

    function staticAllowance(ERC20 _token, address _owner, address _spender) internal view returns (uint256 allowance) {
        bytes memory allowanceCallData = abi.encodeWithSelector(
            ERC20(_token).allowance.selector,
            _owner,
            _spender
        );
        bool success;
        (success, allowance) = staticInvoke(_token, allowanceCallData);
        require(success, ERROR_TOKEN_ALLOWANCE_REVERTED);
    }
}
