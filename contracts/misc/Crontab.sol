pragma solidity ^0.4.11;

// From https://github.com/pipermerriam/ethereum-cron

contract DateTime {
    /*
     *  Date and Time utilities for ethereum contracts
     *
     *  address: 0x1a6184cd4c5bea62b0116de7962ee7315b7bcbce
     */
    struct DateTime {
        uint16 year;
        uint8 month;
        uint8 day;
        uint8 hour;
        uint8 minute;
        uint8 second;
        uint8 weekday;
    }

    uint constant DAY_IN_SECONDS = 86400;
    uint constant YEAR_IN_SECONDS = 31536000;
    uint constant LEAP_YEAR_IN_SECONDS = 31622400;

    uint constant HOUR_IN_SECONDS = 3600;
    uint constant MINUTE_IN_SECONDS = 60;

    uint16 constant ORIGIN_YEAR = 1970;

    function isLeapYear(uint16 year) constant returns (bool) {
        if (year % 4 != 0) {
            return false;
        }
        if (year % 100 != 0) {
            return true;
        }
        if (year % 400 != 0) {
            return false;
        }
        return true;
    }

    function leapYearsBefore(uint year) constant returns (uint) {
        year -= 1;
        return year / 4 - year / 100 + year / 400;
    }

    function getDaysInMonth(uint8 month, uint16 year) constant returns (uint8) {
        if (month == 1 || month == 3 || month == 5 || month == 7 || month == 8 || month == 10 || month == 12) {
            return 31;
        }
        else if (month == 4 || month == 6 || month == 9 || month == 11) {
            return 30;
        }
        else if (isLeapYear(year)) {
            return 29;
        }
        else {
            return 28;
        }
    }

    function parseTimestamp(uint timestamp) internal returns (DateTime dt) {
        uint secondsAccountedFor = 0;
        uint buf;
        uint8 i;

        // Year
        dt.year = getYear(timestamp);
        buf = leapYearsBefore(dt.year) - leapYearsBefore(ORIGIN_YEAR);

        secondsAccountedFor += LEAP_YEAR_IN_SECONDS * buf;
        secondsAccountedFor += YEAR_IN_SECONDS * (dt.year - ORIGIN_YEAR - buf);

        // Month
        uint secondsInMonth;
        for (i = 1; i <= 12; i++) {
            secondsInMonth = DAY_IN_SECONDS * getDaysInMonth(i, dt.year);
            if (secondsInMonth + secondsAccountedFor > timestamp) {
                dt.month = i;
                break;
            }
            secondsAccountedFor += secondsInMonth;
        }

        // Day
        for (i = 1; i <= getDaysInMonth(dt.month, dt.year); i++) {
            if (DAY_IN_SECONDS + secondsAccountedFor > timestamp) {
                dt.day = i;
                break;
            }
            secondsAccountedFor += DAY_IN_SECONDS;
        }

        // Hour
        dt.hour = getHour(timestamp);

        // Minute
        dt.minute = getMinute(timestamp);

        // Second
        dt.second = getSecond(timestamp);

        // Day of week.
        dt.weekday = getWeekday(timestamp);
    }

    function getYear(uint timestamp) constant returns (uint16) {
        uint secondsAccountedFor = 0;
        uint16 year;
        uint numLeapYears;

        // Year
        year = uint16(ORIGIN_YEAR + timestamp / YEAR_IN_SECONDS);
        numLeapYears = leapYearsBefore(year) - leapYearsBefore(ORIGIN_YEAR);

        secondsAccountedFor += LEAP_YEAR_IN_SECONDS * numLeapYears;
        secondsAccountedFor += YEAR_IN_SECONDS * (year - ORIGIN_YEAR - numLeapYears);

        while (secondsAccountedFor > timestamp) {
            if (isLeapYear(uint16(year - 1))) {
                secondsAccountedFor -= LEAP_YEAR_IN_SECONDS;
            }
            else {
                secondsAccountedFor -= YEAR_IN_SECONDS;
            }
            year -= 1;
        }
        return year;
    }

    function getMonth(uint timestamp) constant returns (uint8) {
        return parseTimestamp(timestamp).month;
    }

    function getDay(uint timestamp) constant returns (uint8) {
        return parseTimestamp(timestamp).day;
    }

    function getHour(uint timestamp) constant returns (uint8) {
        return uint8((timestamp / 60 / 60) % 24);
    }

    function getMinute(uint timestamp) constant returns (uint8) {
        return uint8((timestamp / 60) % 60);
    }

    function getSecond(uint timestamp) constant returns (uint8) {
        return uint8(timestamp % 60);
    }

    function getWeekday(uint timestamp) constant returns (uint8) {
        return uint8((timestamp / DAY_IN_SECONDS + 4) % 7);
    }

    function toTimestamp(uint16 year, uint8 month, uint8 day) constant returns (uint timestamp) {
        return toTimestamp(year, month, day, 0, 0, 0);
    }

    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour) constant returns (uint timestamp) {
        return toTimestamp(year, month, day, hour, 0, 0);
    }

    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour, uint8 minute) constant returns (uint timestamp) {
        return toTimestamp(year, month, day, hour, minute, 0);
    }

    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour, uint8 minute, uint8 second) constant returns (uint timestamp) {
        uint16 i;

        // Year
        for (i = ORIGIN_YEAR; i < year; i++) {
            if (isLeapYear(i)) {
                timestamp += LEAP_YEAR_IN_SECONDS;
            }
            else {
                timestamp += YEAR_IN_SECONDS;
            }
        }

        // Month
        uint8[12] monthDayCounts;
        monthDayCounts[0] = 31;
        if (isLeapYear(year)) {
            monthDayCounts[1] = 29;
        }
        else {
            monthDayCounts[1] = 28;
        }
        monthDayCounts[2] = 31;
        monthDayCounts[3] = 30;
        monthDayCounts[4] = 31;
        monthDayCounts[5] = 30;
        monthDayCounts[6] = 31;
        monthDayCounts[7] = 31;
        monthDayCounts[8] = 30;
        monthDayCounts[9] = 31;
        monthDayCounts[10] = 30;
        monthDayCounts[11] = 31;

        for (i = 1; i < month; i++) {
            timestamp += DAY_IN_SECONDS * monthDayCounts[i - 1];
        }

        // Day
        timestamp += DAY_IN_SECONDS * (day - 1);

        // Hour
        timestamp += HOUR_IN_SECONDS * (hour);

        // Minute
        timestamp += MINUTE_IN_SECONDS * (minute);

        // Second
        timestamp += second;

        return timestamp;
    }

    function __throw() {
        uint[] arst;
        arst[1];
    }
}


contract Crontab is DateTime {
    /*
     *  Crontab parsing implementation.
     *  - https://en.wikipedia.org/wiki/Cron#CRON_expression
     */

    byte constant STAR = '*';

    function next(bytes2 ct_second, bytes2 ct_minute, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday, bytes2 ct_year) constant returns (uint) {
        return next(ct_second, ct_minute, ct_hour, ct_day, ct_month, ct_weekday, ct_year, now);
    }

    function next(bytes2 ct_second, bytes2 ct_minute, bytes2 ct_hour, bytes2 ct_day, bytes2 ct_month, bytes2 ct_weekday, bytes4 ct_year, uint timestamp) constant returns (uint) {
        /*
         *  Given the 7 possible parts of a crontab entry, return the
         *  next timestamp that this entry should be executed.
         *
         *  Currently only supports `*` or a single number.
         */
        uint current = timestamp;
        uint _next;

        while (true) {
            _next = findNextSecond(current, ct_second);
            if (_next != current) {
                current = _next;
                continue;
            }

            _next = findNextMinute(current, ct_minute);
            if (_next != current) {
                current = _next;
                continue;
            }
            current = _next;

            _next = findNextHour(current, ct_hour);
            if (_next != current) {
                current = _next;
                continue;
            }
            current = _next;

            _next = findNextWeekday(current, ct_weekday);
            if (_next != current) {
                current = _next;
                continue;
            }
            current = _next;

            _next = findNextDay(current, ct_day);
            if (_next != current) {
                current = _next;
                continue;
            }
            current = _next;

            _next = findNextMonth(current, ct_month);
            if (_next != current) {
                current = _next;
                continue;
            }
            current = _next;

            _next = findNextYear(current, ct_year);
            if (_next != current) {
                current = _next;
                continue;
            }

            return _next;
        }
    }

    function findNextSecond(uint timestamp, bytes2 ct_second) constant returns (uint) {
        if (ct_second == STAR) {
            return timestamp;
        }
        uint8 target = uint8(_patternToNumber(ct_second));

        if (target > 59) {
            // temporary solution until validation is implemented.
            __throw();
        }

        uint8 current = getSecond(timestamp);

        if (current <= target) {
            return timestamp + (target - current);
        }
        return timestamp + target + 60 - current;
    }

    function findNextMinute(uint timestamp, bytes2 ct_minute) constant returns (uint) {
        if (ct_minute == STAR) {
            return timestamp;
        }
        uint8 target = uint8(_patternToNumber(ct_minute));

        if (target > 59) {
            // temporary solution until validation is implemented.
            __throw();
        }

        uint8 current = getMinute(timestamp);

        if (current <= target) {
            return timestamp + MINUTE_IN_SECONDS * (target - current);
        }
        return timestamp + MINUTE_IN_SECONDS * (target + 60 - current);
    }

    function findNextHour(uint timestamp, bytes2 ct_hour) constant returns (uint) {
        if (ct_hour == STAR) {
            return timestamp;
        }
        uint8 target = uint8(_patternToNumber(ct_hour));

        if (target > 23) {
            // temporary solution until validation is implemented.
            __throw();
        }

        uint8 current = getHour(timestamp);

        if (current <= target) {
            return timestamp + HOUR_IN_SECONDS * (target - current);
        }
        return timestamp + HOUR_IN_SECONDS * (target + 24 - current);
    }

    function findNextWeekday(uint timestamp, bytes2 ct_weekday) constant returns (uint) {
        if (ct_weekday == STAR) {
            return timestamp;
        }
        uint8 target = uint8(_patternToNumber(ct_weekday));

        if (target > 6) {
            // temporary solution until validation is implemented.
            __throw();
        }

        uint8 current = getWeekday(timestamp);

        if (current <= target) {
            return timestamp + DAY_IN_SECONDS * (target - current);
        }
        return timestamp + DAY_IN_SECONDS * (target + 7 - current);
    }

    function findNextDay(uint timestamp, bytes2 ct_day) constant returns (uint) {
        if (ct_day == STAR) {
            return timestamp;
        }
        uint8 target = uint8(_patternToNumber(ct_day));

        if (target < 1 || target > 31) {
            // temporary solution until validation is implemented.
            __throw();
        }

        uint _next = timestamp;

        for (uint8 i = 0; i < 12; i++) {
            uint8 current = getDay(_next);
            uint8 current_month = getMonth(_next);
            uint8 days_in_month = getDaysInMonth(current_month, getYear(_next));

            if (target > days_in_month || current > target) {
                _next += DAY_IN_SECONDS * (days_in_month - current + 1);
                continue;
            }
            return _next + DAY_IN_SECONDS * (target - current);
        }
        // Shouldn't be possible since 
        __throw();
    }

    function findNextMonth(uint timestamp, bytes2 ct_month) constant returns (uint) {
        if (ct_month == STAR) {
            return timestamp;
        }
        uint8 target = uint8(_patternToNumber(ct_month));

        if (target < 1 || target > 12) {
            // temporary solution until validation is implemented.
            __throw();
        }

        uint _next = timestamp;
        uint8 current;
        uint8 origin_day = getDay(timestamp);
        uint8 current_day;
        uint8 days_in_month;
        uint8 days_in_next_month;

        for (uint8 i = 0; i < 12; i++) {
            current = getMonth(_next);

            if (current == target) {
                return _next;
            }

            current_day = getDay(_next);
            days_in_month = getDaysInMonth(current, getYear(_next));
            if (current == 12) {
                days_in_next_month = getDaysInMonth(1, getYear(_next) + 1);
            }
            else {
                days_in_next_month = getDaysInMonth(current + 1, getYear(_next));
            }

            _next += DAY_IN_SECONDS * (days_in_month - current_day + min(origin_day, days_in_next_month));
        }
        // Shouldn't be possible since 
        __throw();
    }

    function findNextYear(uint timestamp, bytes4 ct_year) constant returns (uint) {
        if (ct_year == STAR) {
            return timestamp;
        }
        uint16 target = _patternToNumber(ct_year);

        if (target < getYear(timestamp) || target > 2099) {
            // temporary solution until validation is implemented.
            __throw();
        }

        uint16 current = getYear(timestamp);

        uint numLeapYears = leapYearsBefore(target) - leapYearsBefore(current);
        uint next = timestamp;

        next += LEAP_YEAR_IN_SECONDS * numLeapYears;
        next += YEAR_IN_SECONDS * (target - current - numLeapYears);

        if (getMonth(timestamp) >= 3) {
            if (isLeapYear(current) && !isLeapYear(target)) {
                next -= DAY_IN_SECONDS;
            }

            if (isLeapYear(target) && !isLeapYear(current)) {
                next += DAY_IN_SECONDS;
            }
        }
        else if (getMonth(timestamp) == 2 && getDay(timestamp) == 29 && !isLeapYear(target)) {
            next -= DAY_IN_SECONDS;
        }

        return next;
    }

    function max(uint a, uint b) constant returns (uint) {
        if (a >= b) {
            return a;
        }
        return b;
    }

    function min(uint a, uint b) constant returns (uint) {
        if (a <= b) {
            return a;
        }
        return b;
    }

    function _patternToNumber(bytes4 pattern) constant returns (uint16 res){
        byte _byte;

        _byte = byte(uint(pattern) / (2 ** 24));
        if (_byte != 0x0) {
            res = 10 * res +  uint16(uint8(_byte) - 48);
        }

        _byte = byte(uint(pattern) / (2 ** 16));
        if (_byte != 0x0) {
            res = 10 * res +  uint16(uint8(_byte) - 48);
        }

        _byte = byte(uint(pattern) / (2 ** 8));
        if (_byte != 0x0) {
            res = 10 * res + uint16(uint8(_byte) - 48);
        }

        _byte = byte(uint(pattern));
        if (_byte != 0x0) {
            res = 10 * res + uint16(uint8(_byte) - 48);
        }

        return res;
    }
}
