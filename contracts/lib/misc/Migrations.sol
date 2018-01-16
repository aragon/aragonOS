pragma solidity ^0.4.2;


contract Migrations {
    address public owner;
    uint public lastCompletedMigration;

    modifier restricted() {
        if (msg.sender == owner)
            _;
    }

    function Migrations()  public {
        owner = msg.sender;
    }

    function setCompleted(uint completed) restricted public {
        lastCompletedMigration = completed;
    }

    function upgrade(address newAddress) restricted public {
        Migrations upgraded = Migrations(newAddress);
        upgraded.setCompleted(lastCompletedMigration);
    }
}
