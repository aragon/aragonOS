pragma solidity ^0.4.11;


contract IVote {
    function wasExecuted() constant public returns (bool);
    function execute();
}


contract Vote is IVote {
    address public dao;
    bytes public data;
    bool executed;

    function instantiate(address _dao, bytes _data) {
        require(dao == 0 && data.length == 0); // dont allow to reinstantiate a vote
        require(_dao != 0);
        dao = _dao;
        data = _data;
    }

    function execute() {
        require(!executed);
        executed = true;
        assert(dao.call(data));
    }

    function wasExecuted() constant public returns (bool) {
        return executed;
    }
}
