pragma solidity ^0.4.24;

import "../token/ERC20.sol";


// Note
interface IAragonAppFeesCashier {
    event AppFeeSet(bytes32 indexed appId, ERC20 token, uint256 amount);
    event AppFeeUnset(bytes32 indexed appId);
    event AppFeePaid(address indexed by, bytes32 appId, bytes data);

    function setAppFee(bytes32 appId, ERC20 token, uint256 amount) external;
    function setAppFees(bytes32[] appIds, ERC20[] tokens, uint256[] amounts) external;
    function unsetAppFee(bytes32 appId) external;
    function unsetAppFees(bytes32[] appIds) external;
    function payAppFees(bytes32 appId, bytes data) external;
    function getAppFee(bytes32 appId) external view returns (ERC20, uint256);
}
