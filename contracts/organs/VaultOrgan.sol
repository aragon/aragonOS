pragma solidity ^0.4.11;

import "./IVaultOrgan.sol";

import "../tokens/EtherToken.sol";
import "./IOrgan.sol";
import "zeppelin/SafeMath.sol";

contract VaultOrgan is IVaultOrgan, SafeMath, IOrgan {
    uint8 constant VAULT_PRIMARY_KEY = 0x02;

    uint8 constant BALANCE_SECONDARY_KEY = 0x00;
    bytes32 constant HALT_TIME_KEY = sha3(VAULT_PRIMARY_KEY, 0x01);
    bytes32 constant HALT_DURATION_KEY = sha3(VAULT_PRIMARY_KEY, 0x02);
    bytes32 constant SCAPE_HATCH_SECONDARY_KEY = sha3(VAULT_PRIMARY_KEY, 0x03);
    uint8 constant BLACKLIST_SECONDARY_KEY = 0x04;
    bytes32 constant ETHER_TOKEN_SECONDARY_KEY = sha3(VAULT_PRIMARY_KEY, 0x05);

    uint constant MAX_TOKEN_TRANSFER_GAS = 150000;
    uint constant MAX_HALT = 7 days; // can be prorrogated during halt

    // @dev deposit is not reachable on purpose using normal dispatch route
    // expects to be called as a delegatecall from kernel
    // @param _token: Address for the token being deposited in call
    // @param _amount: Token units being deposited
    function deposit(address _token, uint256 _amount)
    check_blacklist(_token)
    payable
    {
        if (_amount == 0)
            return;
        if (_token == 0 && msg.value == _amount)
            tokenizeEther(_amount); // if call has ETH, we tokenize it

        address token = _token == 0 ? getEtherToken() : _token;

        uint256 currentBalance = getTokenBalance(token);
        // This will actually be dispatched every time balance goes from 0 to non-zero.
        // The idea is that the frontend can listen for this event in all DAO history.
        // TODO: Is an event for when a certain token balance goes to 0 needed?
        if (currentBalance == 0)
            NewTokenDeposit(token);

        // TODO: Aragon Network funds redirect goes here :)

        uint256 newBalance = safeAdd(currentBalance, _amount); // - aragonNetworkFee;
        // Check token balance isn't less than expected.
        // Could be less because of a faulty erc20 implementation (can't trust)
        // Could be more because a token transfer can be done without notifying
        assert(newBalance <= ERC20(token).balanceOf(this));

        setTokenBalance(token, newBalance);
        Deposit(token, dao_msg().sender, _amount);
    }

    // @dev Function called from other organs, applications or the outside to send funds
    // @param _token: Token address to be tranferred
    // @param _to: Recipient of the tokens
    // @param _amount: Token units being sent
    function transfer(address _token, address _to, uint256 _amount)
    only_not_halted
    {
        doTransfer(_token, _to, _amount);
    }

    // @dev internal function that handles transfer logic.
    function doTransfer(address _token, address _to, uint256 _amount) internal {
        uint newBalance = performTokenTransferAccounting(_token, _amount, _to);
        secureTokenTransfer(_token, _to, _amount); // perform actual transfer

        assert(ERC20(_token).balanceOf(this) == newBalance); // check that we have as many tokens as we expected
    }

    // @dev Function called from other organs, applications or the outside to send ether
    // @param _to: Recipient of the ether
    // @param _amount: wei amount being sent
    function transferEther(address _to, uint256 _amount)
    only_not_halted
    {
        address etherToken = getEtherToken();
        uint newBalance = performTokenTransferAccounting(etherToken, _amount, _to);

        // secure withdraw sends ETH without reentrancy possibilities (send by selfdestruct)
        EtherToken(etherToken).secureWithdraw(_amount, _to);

        assert(ERC20(etherToken).balanceOf(this) == newBalance); // check that we have as many tokens as we expected
    }

    // @dev Function called to stop token withdraws for _haltTime seconds as a security measure.
    // @dev Halting vault organ opens the possibility to execute the scape hatch
    // @param _haltTime: Number of seconds vault will be halted (can be overwriten by another shorter halt)
    function halt(uint256 _haltTime) {
        assert(_haltTime <= MAX_HALT);

        // Store timestamp of the halt and halt period
        storageSet(HALT_TIME_KEY, now);
        storageSet(HALT_DURATION_KEY, _haltTime);
    }

    // @dev Function called as a security measure to remove all funds from the DAO
    // @dev Can only be executed during a halt
    // @param _tokens: Addresses of the tokens in which we execute the scape hatch (to avoid OOG errors)
    function scapeHatch(address[] _tokens)
    only_halted
    {
        address scapeHatch = getScapeHatch();
        require(scapeHatch > 0); // check it has been set to avoid burning the tokens

        // could go OOG but then you can always split calls in multiple calls with subsets of tokens
        for (uint i = 0; i < _tokens.length; i++) {
            address token = _tokens[i];
            doTransfer(token, scapeHatch, getTokenBalance(token));
        }
    }

    // @param _scapeHatch: New scape hatch address being set
    function setScapeHatch(address _scapeHatch) {
        storageSet(SCAPE_HATCH_SECONDARY_KEY, uint256(_scapeHatch));
    }

    // @dev Getter for scape hatch
    // @return address for current scape hatch
    function getScapeHatch() constant returns (address) {
        return address(storageGet(SCAPE_HATCH_SECONDARY_KEY));
    }

    // @dev Getter for token balance
    // @param _token: address of the token being requested
    // @return accounted DAO balance for a given token
    function getTokenBalance(address _token) constant returns (uint256) {
        return storageGet(storageKeyForBalance(_token));
    }

    // @dev Getter for halt status
    // @return started: timestamp for the moment the halt was executed
    // @return ends: timestamp for the moment the halt is scheduled to end
    function getHaltTime() constant returns (uint256 started, uint256 ends) {
        started = storageGet(HALT_TIME_KEY);
        ends = safeAdd(started, storageGet(HALT_DURATION_KEY));
    }

    // @dev Change the status of a token in the blacklist.
    // @dev Allows for not allowing a certain token at the lowest level
    // @param _token: Address for the token being modified
    // @param _blacklisted: New blacklist state for token
    function setTokenBlacklist(address _token, bool _blacklisted) {
        storageSet(storageKeyForBlacklist(_token), _blacklisted ? 1 : 0);
    }

    // @param _token: token being requested for blacklisting state
    // @return current blacklist state for _token
    function isTokenBlacklisted(address _token) constant returns (bool) {
        return storageGet(storageKeyForBlacklist(_token)) == 1;
    }

    // @dev Function to be called externally to withdraw accidentally sent tokens that weren't accounted
    // @param _token: address for the token being recovered
    // @param _to: recipient for recovered tokens
    function recover(address _token, address _to) {
        uint256 accountedBalance = getTokenBalance(_token);
        uint256 tokenBalance = ERC20(_token).balanceOf(this);

        // already checks if delta > 0 or throws
        uint256 tokenDelta = safeSub(tokenBalance, accountedBalance);

        if (tokenDelta == 0)
            return;

        secureTokenTransfer(_token, _to, tokenDelta);
        Recover(
            _token,
            dao_msg().sender,
            tokenDelta,
            _to
        );
    }

    // @dev Internal function that takes care of tokenizing ether to hold it as a ERC20 token
    // @param _amount: wei being tokenized
    function tokenizeEther(uint256 _amount) internal {
        assert(address(this).balance >= _amount);
        EtherToken(getEtherToken()).wrap.value(_amount)();
        // assert always that DAO keeps 0 ETH funds as there is no way to send them
        // TODO: Why does dao have balance? :o
        // assert(address(this).balance == 0);
    }

    // @dev Internal function that handles token accounting on withdraws
    // @param _token: Token address to be tranferred
    // @param _to: Recipient of the tokens
    // @param _amount: Token units being sent
    // @return new balance after substracting tokens being transferred
    function performTokenTransferAccounting(address _token, uint256 _amount, address _to)
    internal
    returns (uint256 newBalance)
    {
        newBalance = safeSub(getTokenBalance(_token), _amount); // will throw on overflow
        setTokenBalance(_token, newBalance);

        Withdraw(
            _token,
            dao_msg().sender,
            _amount,
            _to
        );
    }

    // @dev Internal function to modify storage for current token balance
    // @param _token: Token address to be tranferred
    // @param _balance: New token balance
    function setTokenBalance(address _token, uint256 _balance) internal {
        storageSet(storageKeyForBalance(_token), _balance);
    }

    // @dev Internal function that performs an external ERC20 transfer but throws if
    //      to much gas is used, to avoid reentrancy by malicious tokens
    // @param _token: Token address to be tranferred
    // @param _to: Recipient of the tokens
    // @param _amount: Token units being sent
    function secureTokenTransfer(address _token, address _to, uint256 _amount)
    max_gas(MAX_TOKEN_TRANSFER_GAS)
    internal
    {
        assert(
            ERC20(_token)
            .transfer(_to, _amount)
        );
    }

    function getEtherToken() constant returns (address) {
        return address(storageGet(ETHER_TOKEN_SECONDARY_KEY));
    }

    function setEtherToken(address newToken) {
        storageSet(ETHER_TOKEN_SECONDARY_KEY, uint256(newToken));
    }

    // @dev get key for token balance
    // @param _token: Token address checked
    // @return hash used as key in DAO storage
    function storageKeyForBalance(address _token) internal returns (bytes32) {
        return sha3(VAULT_PRIMARY_KEY, BALANCE_SECONDARY_KEY, _token);
    }

    // @dev get key for token blacklist
    // @param _token: Token address checked
    // @return hash used as key in DAO storage
    function storageKeyForBlacklist(address _token) internal returns (bytes32) {
        return sha3(VAULT_PRIMARY_KEY, BLACKLIST_SECONDARY_KEY, _token);
    }

    // @dev Function called by the DAO as a delegatecall for organ to do its setup
    //      on DAO context
    function setupEtherToken() {
        require(getEtherToken() == 0);
        setEtherToken(address(new EtherToken()));
    }

    modifier only_not_halted {
        var (,haltEnds) = getHaltTime();
        assert(now >= haltEnds);
        _;
    }

    modifier only_halted {
        var (,haltEnds) = getHaltTime();
        assert(now < haltEnds);
        _;
    }

    modifier check_blacklist(address _token) {
        require(!isTokenBlacklisted(_token));
        _;
    }

    modifier max_gas(uint max_delta) {
        uint initialGas = msg.gas;
        _;
        assert(initialGas - msg.gas < max_delta);
    }
}
