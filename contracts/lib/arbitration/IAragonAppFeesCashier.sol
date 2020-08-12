pragma solidity ^0.4.24;

import "../token/ERC20.sol";


/**
* @title AragonAppFeesCashier interface
* @dev This interface is the one of the `IAgreement` dependencies apart from the `IArbitrator`
*      It is used to pay the fees corresponding to the usage of a disputable app.
*      This interface was manually-copied from https://github.com/aragon/aragon-court/blob/v1.2.0/contracts/subscriptions/IAragonAppFeesCashier.sol
*      since we are using different solidity versions.
*/
interface IAragonAppFeesCashier {
    /**
    * @dev Emitted when an IAragonAppFeesCashier instance sets a new fee for an app
    * @param appId App identifier
    * @param token Token address to be used for the fees
    * @param amount Fee amount to be charged for the given app
    */
    event AppFeeSet(bytes32 indexed appId, ERC20 token, uint256 amount);

    /**
    * @dev Emitted when an IAragonAppFeesCashier instance unsets an app fee
    * @param appId App identifier
    */
    event AppFeeUnset(bytes32 indexed appId);

    /**
    * @dev Emitted when an IAragonAppFeesCashier instance receives a payment for an app
    * @param by Address paying the fees
    * @param appId App identifier
    * @param data Optional data
    */
    event AppFeePaid(address indexed by, bytes32 appId, bytes data);

    /**
    * @dev Set the fee amount and token to be used for an app
    * @param _appId App identifier
    * @param _token Token address to be used for the fees
    * @param _amount Fee amount to be charged for the given app
    */
    function setAppFee(bytes32 _appId, ERC20 _token, uint256 _amount) external;

    /**
    * @dev Set the fee amount and token to be used for a list of apps
    * @param _appIds List of app identifiers
    * @param _tokens List of token addresses to be used for the fees for each app
    * @param _amounts List of fee amounts to be charged for each app
    */
    function setAppFees(bytes32[] _appIds, ERC20[] _tokens, uint256[] _amounts) external;

    /**
    * @dev Remove the fee set for an app
    * @param _appId App identifier
    */
    function unsetAppFee(bytes32 _appId) external;

    /**
    * @dev Remove the fee set for a list of apps
    * @param _appIds List of app identifiers
    */
    function unsetAppFees(bytes32[] _appIds) external;

    /**
    * @dev Pay the fees corresponding to an app
    * @param _appId App identifier
    * @param _data Optional data input
    */
    function payAppFees(bytes32 _appId, bytes _data) external payable;

    /**
    * @dev Tell the fee token and amount set for a given app
    * @param _appId Identifier of the app being queried
    * @return token Fee token address set for the requested app
    * @return amount Fee token amount set for the requested app
    */
    function getAppFee(bytes32 _appId) external view returns (ERC20 token, uint256 amount);
}
