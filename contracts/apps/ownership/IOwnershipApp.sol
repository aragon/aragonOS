pragma solidity ^0.4.11;

import "../../tokens/MiniMeController.sol";

contract ITokenHolderOracle {
    function isHolder(address _holder) constant returns (bool);
}

contract IOwnershipSale {
    function sale_mintTokens(address tokenAddress, address recipient, uint amount) external;
    function sale_destroyTokens(address tokenAddress, address holder, uint amount) external;
    function sale_closeSale() external;
}

contract IOwnershipApp is ITokenHolderOracle, IOwnershipSale, MiniMeController {
    event AddToken(address indexed tokenAddress, uint indexed tokenId);
    event RemoveToken(address indexed tokenAddress);
    event ChangeTokenId(address indexed tokenAddress, uint indexed oldTokenId, uint indexed newTokenId);
    event CreateTokenSale(address indexed saleAddress, uint indexed saleId);
    event CloseTokenSale(address indexed saleAddress, uint indexed saleId);

    function addToken(address tokenAddress, uint256 issueAmount, uint128 governanceRights, uint128 economicRights) external;
    function removeToken(address tokenAddress) external;

    function issueTokens(address tokenAddress, uint256 amount);
    function grantTokens(address tokenAddress, address recipient, uint256 amount) external;
    function grantVestedTokens(address tokenAddress, address recipient, uint256 amount, uint64 start, uint64 cliff, uint64 vesting) external;

    function createTokenSale(address saleAddress, address tokenAddress, bool canDestroy) external;
    function closeTokenSale(address saleAddress) external;

    function updateIsController(address tokenAddress);

    function getTokenCount() constant returns (uint);
    function getToken(uint tokenId) constant returns (address, uint128, uint128, bool);
    function getTokenSaleCount() constant returns (uint);
    function getTokenSale(uint tokenSaleId) constant returns (address, address, bool, bool);
    function getTokenAddress(uint256 i) constant returns (address);
}
