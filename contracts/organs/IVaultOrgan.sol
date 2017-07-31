pragma solidity ^0.4.11;

contract VaultEvents {
    event Deposit(address indexed token, address indexed sender, uint256 amount);
    event Withdraw(address indexed token, address indexed approvedBy, uint256 amount, address recipient);
    event Recover(address indexed token, address indexed approvedBy, uint256 amount, address recipient);
    event NewTokenDeposit(address token);
}

contract IVaultOrgan is VaultEvents {
    function deposit(address _token, uint256 _amount) payable;
    function getTokenBalance(address _token) constant returns (uint256);

    function transfer(address _token, address _to, uint256 _amount);
    function transferEther(address _to, uint256 _amount);

    function halt(uint256 _haltTime);
    function getHaltTime() constant returns (uint256 started, uint256 ends);

    function scapeHatch(address[] _tokens);
    function setScapeHatch(address _scapeHatch);
    function getScapeHatch() constant returns (address);

    function setTokenBlacklist(address _token, bool _blacklisted);
    function isTokenBlacklisted(address _token) constant returns (bool);
    function recover(address _token, address _to);
}
