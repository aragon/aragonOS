pragma solidity 0.4.15;

import "../App.sol";

import "../token-manager/TokenManager.sol";

import "zeppelin-solidity/contracts/token/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/math/Math.sol";

contract FundraisingApp is App, Initializable {
    using SafeMath for uint256;

    struct SalePeriod {
        uint64 periodEnds;
        uint256 initialPrice;
        uint256 finalPrice;
    }

    struct Sale {
        address investor; // if set to 0 is public sale
        ERC20 raisedToken;

        uint256 maxRaised;
        uint256 maxSold;
        uint256 minBuy;
        bool isInversePrice;

        uint64 periodStartTime;
        SalePeriod[] periods;
        uint256 currentPeriod;

        uint256 raisedAmount;
        uint256 soldAmount;
        bool closed;
    }

    Sale[] public sales;
    TokenManager tokenManager;
    address vault;

    uint256 constant MAX_PERIODS = 50;
    uint64 constant MAX_UINT64 = uint64(-1);

    event NewSale(uint256 indexed saleId);
    event CloseSale(uint256 indexed saleId);

    function initialize(TokenManager _tokenManager, address _vault) onlyInit {
        initialized();

        tokenManager = _tokenManager;
        vault = _vault;
    }

    function newSale(
        address _investor,
        ERC20 _raisedToken,
        uint256 _maxRaised,
        uint256 _maxSold,
        uint256 _minBuy,
        bool _isInversePrice,
        uint64 _periodStartTime,
        uint64[] _periodEnds,
        uint256[] _prices
    ) auth external returns (uint256 saleId) {
        // Dont allow token multiplication sales
        require(address(_raisedToken) != 0 && _raisedToken != ERC20(tokenManager.token()));

        saleId = sales.length++;
        Sale storage sale = sales[saleId];

        sale.investor = _investor;
        sale.raisedToken = _raisedToken;
        sale.maxRaised = _maxRaised;
        sale.maxSold = _maxSold;
        sale.minBuy = _minBuy;
        sale.isInversePrice = _isInversePrice;
        sale.periodStartTime = _periodStartTime;

        require(_periodEnds.length > 0 && _periodEnds.length <= MAX_PERIODS);
        require(_periodStartTime < _periodEnds[0]);
        require(_periodEnds.length * 2 == _prices.length);

        for (uint i = 0; i < _periodEnds.length; i++) {
            sale.periods.push(SalePeriod(_periodEnds[i], _prices[2 * i], _prices[2 * i + 1]));
            if (i > 0)
               require(sale.periods[i - 1].periodEnds < sale.periods[i].periodEnds);
        }

        NewSale(saleId);
    }

    function buy(uint256 _saleId, uint256 _payedTokens) {
        ERC20 raisedToken = sales[_saleId].raisedToken;

        uint256 returnTokens = _buy(_saleId, msg.sender, _payedTokens);

        // No need to return tokens as we never take them from sender's balance
        assert(raisedToken.transferFrom(msg.sender, vault, _payedTokens.sub(returnTokens)));
    }

    // Just for ERC223 interfacing
    function buy(uint256 _saleId) {}

    function tokenFallback(address _sender, address _origin, uint256 _value, bytes _data) returns (bool ok) {
        _origin;

        uint256 saleId = parseSaleId(_data);

        ERC20 raisedToken = sales[saleId].raisedToken;
        require(msg.sender == address(raisedToken));

        uint256 returnTokens = _buy(saleId, _sender, _value);

        assert(raisedToken.transfer(vault, _value.sub(returnTokens)));
        if (returnTokens > 0) assert(raisedToken.transfer(_sender, returnTokens));

        return true;
    }

    function parseSaleId(bytes data) constant returns (uint256 saleId) {
        assembly { saleId := mload(add(data, 0x24)) } // read first parameter of buy function call
    }

    function _buy(uint256 _saleId, address _buyer, uint256 _payedTokens) internal returns (uint256 returnTokens) {
        Sale storage sale = sales[_saleId];

        transitionSalePeriodIfNeeded(sale);

        require(sale.investor == 0 || sale.investor == _buyer);
        require(_payedTokens >= sale.minBuy);
        require(getTimestamp() >= sale.periodStartTime);
        require(!sale.closed);

        // Only allow until max raised cap is hit
        uint256 allowedAmount = Math.min256(_payedTokens, sale.maxRaised.sub(sale.raisedAmount));

        var (price,,pricePrecision) = calculatePrice(_saleId);
        uint256 boughtTokens = sale.isInversePrice ? allowedAmount.mul(price).div(pricePrecision) : allowedAmount.mul(pricePrecision).div(price);

        // Only allow until max sold cap is hit
        uint256 allowedBuy = Math.min256(boughtTokens, sale.maxSold.sub(sale.soldAmount));

        // Calculate how much we need to refund for the tokens that weren't sold
        uint256 nonBoughtTokens = boughtTokens.sub(allowedBuy);
        uint256 returnAmount = !sale.isInversePrice ? nonBoughtTokens.mul(price).div(pricePrecision) : nonBoughtTokens.mul(pricePrecision).div(price);
        uint256 finalAllowedAmount = allowedAmount.sub(returnAmount);

        sale.soldAmount = sale.soldAmount.add(allowedBuy);
        sale.raisedAmount = sale.raisedAmount.add(finalAllowedAmount);

        tokenManager.mint(_buyer, allowedBuy);

        if (sale.soldAmount == sale.maxSold || sale.raisedAmount == sale.maxRaised)
            _closeSale(_saleId);

        return _payedTokens.sub(finalAllowedAmount);
    }

    function forceCloseSale(uint256 _saleId) auth external {
        _closeSale(_saleId);
    }

    function closeSale(uint256 _saleId) external {
        Sale storage sale = sales[_saleId];
        transitionSalePeriodIfNeeded(sale);

        require(sale.periodStartTime == MAX_UINT64);
        _closeSale(_saleId);
    }

    function _closeSale(uint256 _saleId) internal {
        sales[_saleId].closed = true;
        CloseSale(_saleId);
    }

    function calculatePrice(uint256 _saleId) internal constant returns (uint256 price, bool isInversePrice, uint256 pricePrecision) {
        Sale storage sale = sales[_saleId];

        SalePeriod storage period = sale.periods[sale.currentPeriod];

        pricePrecision = 10 ** 8;  // given that exchangeRate is a uint, we need more precision for interpolating
        isInversePrice = sale.isInversePrice;
        price = period.initialPrice.mul(pricePrecision);

        if (period.finalPrice != 0) { // interpolate
            uint periodDelta = uint256(period.periodEnds).sub(uint256(sale.periodStartTime));
            uint periodState = getTimestamp().sub(uint256(sale.periodStartTime));
            if (period.finalPrice > period.initialPrice) {
                uint p1 = period.finalPrice.sub(period.initialPrice);
                price = price.add(pricePrecision.mul(p1).mul(periodState).div(periodDelta));
            } else {
                uint p2 = period.initialPrice.sub(period.finalPrice);
                price = price.sub(pricePrecision.mul(p2).mul(periodState).div(periodDelta));
            }
        }
    }

    function getCurrentPrice(uint256 _saleId) constant returns (uint256 price, bool isInversePrice, uint256 pricePrecision) {
        transitionSalePeriodIfNeeded(sales[_saleId]);
        return calculatePrice(_saleId);
    }

    function transitionSalePeriodIfNeeded(Sale storage sale) internal {
        uint64 newStartTime = sale.periodStartTime;
        uint256 newCurrentPeriod = sale.currentPeriod;
        while (getTimestamp() >= sale.periods[newCurrentPeriod].periodEnds) {
            // In all transitions but last
            if (sale.periods.length > newCurrentPeriod + 1) {
                newStartTime = sale.periods[newCurrentPeriod].periodEnds;
                newCurrentPeriod += 1;
            } else {
                newStartTime = MAX_UINT64; // last period ended
                break;
            }
        }

        if (sale.periodStartTime != newStartTime)
            sale.periodStartTime = newStartTime;

        if (sale.currentPeriod != newCurrentPeriod)
            sale.currentPeriod = newCurrentPeriod;
    }


    function getTimestamp() internal constant returns (uint256) { return now; }
}
