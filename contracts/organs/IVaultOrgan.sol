pragma solidity ^0.4.11;

contract IVaultOrganEvents {
    event Deposit(address indexed token, address indexed sender, uint256 amount);
    event Withdraw(address indexed token, address indexed approvedBy, uint256 amount, address recipient);
    event Recover(address indexed token, address indexed approvedBy, uint256 amount, address recipient);
    event NewTokenDeposit(address token);
}

contract IVaultOrgan is IVaultOrganEvents {
    function deposit(address _token, uint256 _amount) external payable;
    function getTokenBalance(address _token) constant returns (uint256);

    function transfer(address _token, address _to, uint256 _amount) external;
    function transferEther(address _to, uint256 _amount) external;

    function halt(uint256 _haltTime) external;
    function getHaltTime() constant returns (uint256 started, uint256 ends);

    function scapeHatch(address[] _tokens) external;
    function setScapeHatch(address _scapeHatch) external;
    function getScapeHatch() constant returns (address);

    function setTokenBlacklist(address _token, bool _blacklisted) external;
    function isTokenBlacklisted(address _token) constant returns (bool);
    function recover(address _token, address _to) external;
}
