pragma solidity ^0.4.15;
import "./Crontab.sol";

contract IScheduled is Crontab {
    function setSchedule(bytes2 _ct_sec, bytes2 _ct_min, bytes2 _ct_hour, bytes2 _ct_day, bytes2 _ct_month, bytes2 _ct_weekday, bytes2 _ct_year, uint _max_count);
    function task() internal; 
}

