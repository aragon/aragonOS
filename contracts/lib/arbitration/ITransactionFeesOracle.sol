pragma solidity ^0.4.24;

import "../token/ERC20.sol";


interface ITransactionFeesOracle {
    event TransactionFeeSet(bytes32 indexed appId, ERC20 token, uint256 amount);
    event TransactionFeeUnset(bytes32 indexed appId);
    event TransactionFeePaid(address indexed by, bytes32 appId, uint256 actionId);

    function setTransactionFee(bytes32 _appId, ERC20 _token, uint256 _amount) external;
    function setTransactionFees(bytes32[] _appIds, ERC20[] _tokens, uint256[] _amounts) external;
    function unsetTransactionFee(bytes32 _appId) external;
    function unsetTransactionFees(bytes32[] _appIds) external;
    function payTransactionFees(bytes32 _appId, uint256 _actionId) external;
    function getTransactionFee(bytes32 _appId) external view returns (ERC20, uint256);
}
