pragma solidity ^0.4.15;

import "./IScheduled.sol";


contract Scheduled is IScheduled {

    // limit the total number of times event can happen
    uint max_count;
    uint current_count;
    uint last_cron_ts;
    uint next_cron_ts;

    bytes2 ct_sec;
    bytes2 ct_min;
    bytes2 ct_hour;
    bytes2 ct_day;
    bytes2 ct_month;
    bytes2 ct_weekday;
    bytes2 ct_year;


    function Scheduled() {
    }

    function setSchedule(bytes2 _ct_sec, bytes2 _ct_min, bytes2 _ct_hour, bytes2 _ct_day, bytes2 _ct_month, bytes2 _ct_weekday, bytes2 _ct_year, uint _max_count) {
        ct_sec = _ct_sec;
        ct_min = _ct_min;
        ct_hour = _ct_hour;
        ct_day = _ct_day;
        ct_month = _ct_month;
        ct_weekday = _ct_weekday;
        ct_year = _ct_year;
        max_count = _max_count;
        last_cron_ts = block.timestamp;
        next_cron_ts = next(ct_sec, ct_min, ct_hour, ct_day, ct_month, ct_weekday, ct_year, last_cron_ts);


    }


    function next() external {
        assert((max_count==0) || (current_count < max_count));
        // if there is a limit, respect it
        assert(next_cron_ts < block.timestamp);

        current_count += 1;

        last_cron_ts = next_cron_ts;
        next_cron_ts = next(ct_sec, ct_min, ct_hour, ct_day, ct_month, ct_weekday, ct_year, next_cron_ts +1);

        task();

    }
}
