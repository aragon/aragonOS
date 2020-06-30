pragma solidity ^0.4.24;

import "../token/ERC20.sol";


interface ITransactionFeesOracle {
    function setFee(bytes32 appId, ERC20 token, uint256 amount) external;
    function setFees(bytes32[] _appIds, ERC20[] _tokens, uint256[] _amounts) external;
    function unsetFee(bytes32 _appId) external;
    function unsetFees(bytes32[] _appIds) external;
    function getFee(bytes32 appId) external view returns (ERC20, uint256, address);
}
