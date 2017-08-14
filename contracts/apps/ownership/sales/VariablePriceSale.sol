pragma solidity ^0.4.13;

import "./TokenSale.sol";


contract VariablePriceSale is TokenSale {
    uint public cap;             // max tokens sale can get
    uint public minBuy;          // min amount to process sale
    bool public isInverseRate;   // divide instead of multiply exchange rate

    uint public totalCollected;

    uint64 public periodStartBlock;  // period initial block. if 0, last period ended
    struct SalePeriod {
        uint64 periodEnds;
        uint initialPrice;
        uint finalPrice;               // If set to 0, price is constant for period
    }

    uint constant MAX_PERIODS = 50;

    SalePeriod[] public periods;
    uint currentPeriod;

    function instantiate(
        address _dao,
        OwnershipApp _ownershipApp,
        ERC20 _raiseToken,
        ERC20 _saleToken,
        uint _cap,
        uint _minBuy,
        bool _isInverseRate,
        uint64 _startBlock,
        uint64[] _periodEnds,
        uint[] _prices
    ) {
        super.instantiate(
            _dao,
            _ownershipApp,
            _raiseToken,
            _saleToken
        );

        require(cap == 0 && _cap != 0); // checking it is the first time instantiate is called
        require(getBlockNumber() <= _startBlock);

        cap = _cap;
        minBuy = _minBuy;
        isInverseRate = _isInverseRate;
        periodStartBlock = _startBlock;

        require(_periodEnds.length > 0 && _periodEnds.length <= MAX_PERIODS);
        require(_startBlock < _periodEnds[0]);
        require(_periodEnds.length * 2 == _prices.length);

        for (uint i = 0; i < _periodEnds.length; i++) {
            periods.push(SalePeriod(_periodEnds[i], _prices[2 * i], _prices[2 * i + 1]));
            if (i > 0)
                require(periods[i - 1].periodEnds < periods[i].periodEnds);
        }
    }

    function getAcquiredTokens(uint _amount) constant returns (uint) {
        SalePeriod storage period = periods[currentPeriod];

        uint precision = 10 ** 3;  // given that exchangeRate is a uint, we need more precision for interpolating

        uint exchangeRate = period.initialPrice * precision;
        if (period.finalPrice != 0) { // interpolate
            uint periodDelta = period.periodEnds - periodStartBlock;
            uint periodState = getBlockNumber() - periodStartBlock;
            if (period.finalPrice > period.initialPrice) {
                uint p1 = period.finalPrice - period.initialPrice;
                exchangeRate += precision * p1 * periodState / periodDelta;
            } else {
                uint p2 = period.initialPrice - period.finalPrice;
                exchangeRate -= precision * p2 * periodState / periodDelta;
            }
        }

        return (isInverseRate ? _amount * precision / exchangeRate : _amount * exchangeRate / precision);
    }

    function buy(address _holder, uint _tokenAmount) internal transitionPeriod {
        require(getBlockNumber() >= periodStartBlock && getBlockNumber() < periods[currentPeriod].periodEnds);
        require(_tokenAmount >= minBuy);

        uint allowedAmount = _tokenAmount;
        if (totalCollected + _tokenAmount > cap)
            allowedAmount = cap - totalCollected;

        totalCollected += allowedAmount;

        uint boughtTokens = getAcquiredTokens(allowedAmount);
        mintTokens(_holder, boughtTokens);

        Buy(_holder, boughtTokens);

        if (allowedAmount < _tokenAmount)
            raiseToken.transfer(_holder, _tokenAmount - allowedAmount);
        if (totalCollected == cap)
            closeSale();
    }

    function close() transitionPeriod {
        require(getBlockNumber() >= periods[currentPeriod].periodEnds);
        closeSale();
    }

    function transitionIfNeeded() internal {
        uint64 newStartBlock = periodStartBlock;
        while (getBlockNumber() >= periods[currentPeriod].periodEnds) {
            // In all transitions but last
            if (periods.length > currentPeriod + 1) {
                newStartBlock = periods[currentPeriod].periodEnds;
                currentPeriod += 1;
            } else {
                newStartBlock = 0; // last period ended
                break;
            }
        }

        if (periodStartBlock != newStartBlock)
            periodStartBlock = newStartBlock;
    }

    modifier transitionPeriod {
        transitionIfNeeded();
        _;
    }

    function sell(address _holder, uint _x) internal {
        _holder; _x; // silence unused variables warning
        revert();
    }
}
