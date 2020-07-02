pragma solidity ^0.4.24;

import "../token/ERC20.sol";


interface IAragonAppFeesCashier {
    event AppFeeSet(bytes32 indexed appId, ERC20 token, uint256 amount);
    event AppFeeUnset(bytes32 indexed appId);
    event AppFeePaid(address indexed by, bytes32 appId, bytes data);

    function setAppFee(bytes32 _appId, ERC20 _token, uint256 _amount) external;
    function setAppFees(bytes32[] _appIds, ERC20[] _tokens, uint256[] _amounts) external;
    function unsetAppFee(bytes32 _appId) external;
    function unsetAppFees(bytes32[] _appIds) external;
    function payAppFees(bytes32 _appId, bytes _data) external payable;
    function getAppFee(bytes32 _appId) external view returns (ERC20, uint256);
}
