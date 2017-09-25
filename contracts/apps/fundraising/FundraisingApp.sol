pragma solidity 0.4.15;

import "../App.sol";
import "../../common/Initializable.sol";

import "../token-manager/TokenManager.sol";

import "../../zeppelin/token/ERC20.sol";
import "../../zeppelin/math/SafeMath.sol";
import "../../zeppelin/math/Math.sol";

contract FundraisingApp is App, Initializable {
    using SafeMath for uint256;

    TokenManager public tokenManager;
    address public vault;

    uint256 constant MAX_PERIODS = 50;
    uint64 constant MAX_UINT64 = uint64(-1);

    bytes32 constant public CREATOR_ROLE = bytes32(1);
    bytes32 constant public CLOSER_ROLE = bytes32(2);

    struct SalePeriod {
        uint64 periodEnds;
        uint256 initialPrice;
        uint256 finalPrice;
    }

    struct Sale {
        bool closed;

        address investor; // if set to 0 is public sale
        ERC20 raisedToken;

        uint256 maxRaised;
        uint256 maxSold;
        uint256 minBuy;
        bool isInversePrice;

        uint64 saleStartTime;
        uint64 periodStartTime;
        SalePeriod[] periods;
        uint256 currentPeriod;

        uint256 raisedAmount;
        uint256 soldAmount;
    }

    Sale[] sales;

    event NewSale(uint256 indexed saleId);
    event CloseSale(uint256 indexed saleId);

    /**
    * @param _tokenManager Reference to the token manager that will mint tokens on sales (Requires mint permission!)
    * @param _vault Address that will receive funds raised in sale
    */
    function initialize(TokenManager _tokenManager, address _vault) onlyInit {
        initialized();

        tokenManager = _tokenManager;
        vault = _vault;
    }

    /**
    * @notice Create token sale (TODO: Figure out how to explain better)
    * @param _investor Address allowed to buy in the sale. If set to 0x00.., anyone can buy
    * @param _raisedToken Address of the token being raised in the sale
    * @param _maxRaised Maximum amount of tokens raised
    * @param _maxSold Maximum amount of tokens that can be sold
    * @param _minBuy Minimum amount of raisedTokens that can have to be payed in a sale
    * @param _isInversePrice How pricing works. If inverse is set to true price will be used as a multiplicator, if set to false as a divisor
    * @param _periodStartTime Initial timestamp when sale starts
    * @param _periodEnds Array of timestamps when each period of the sale ends
    * @param _prices Array of prices for sale. For each period two prices are provided (initial and finalPrice). If different, price is linearly interpolated.
    */
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
    ) auth(CREATOR_ROLE) external returns (uint256 saleId)
    {
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

        sale.saleStartTime = _periodStartTime;
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

    /**
    * @notice Buy in sale with id `_saleId` with `_payedTokens` tokens
    * @param _saleId Sale numeric identifier
    * @param _payedTokens Amount of tokens payed
    */
    function buy(uint256 _saleId, uint256 _payedTokens) {
        ERC20 raisedToken = sales[_saleId].raisedToken;

        // Buying is attempted before transfering tokens, but if transfer fails it will revert the entire tx
        uint256 returnTokens = _buy(_saleId, msg.sender, _payedTokens);

        // No need to return tokens as we never take them from sender's balance
        assert(raisedToken.transferFrom(msg.sender, vault, _payedTokens.sub(returnTokens)));
    }

    /**
    * @notice Force the close of sale with id `_saleId` (It will always succeed if sale is open)
    * @param _saleId Sale numeric identifier
    */
    function forceCloseSale(uint256 _saleId) auth(CLOSER_ROLE) external {
        _closeSale(_saleId);
    }

    /**
    * @notice Close finished sale
    * @param _saleId Sale numeric identifier
    */
    function closeSale(uint256 _saleId) external {
        Sale storage sale = sales[_saleId];
        transitionSalePeriodIfNeeded(sale);

        require(sale.periodStartTime == MAX_UINT64);
        _closeSale(_saleId);
    }

    function getSale(uint256 _saleId) constant returns (bool closed, address investor, address raisedToken, uint256 maxRaised, uint256 maxSold, uint256 minBuy, bool isInversePrice, uint64 saleStartTime, uint256 periodsCount, uint256 currentPeriod, uint256 raisedAmount, uint256 soldAmount) {
        Sale storage sale = sales[_saleId];

        closed = sale.closed;
        investor = sale.investor;
        raisedToken = sale.raisedToken;
        maxRaised = sale.maxRaised;
        maxSold = sale.maxSold;
        minBuy = sale.minBuy;
        saleStartTime = sale.saleStartTime;
        isInversePrice = sale.isInversePrice;
        periodsCount = sale.periods.length;
        currentPeriod = sale.currentPeriod;
        raisedAmount = sale.raisedAmount;
        soldAmount = sale.soldAmount;
    }

    function getPeriod(uint256 _saleId, uint256 _salePeriod) constant returns (uint64 periodStarts, uint64 periodEnds, uint256 initialPrice, uint256 finalPrice) {
        Sale storage sale = sales[_saleId];
        SalePeriod storage period = sale.periods[_salePeriod];

        periodStarts = _salePeriod == 0 ? sale.saleStartTime : sale.periods[_salePeriod - 1].periodEnds;
        periodEnds = period.periodEnds;
        initialPrice = period.initialPrice;
        finalPrice = period.finalPrice;
    }

    /**
    * @param _saleId Sale numeric identifier
    * @return price Current price
    * @return isInversePrice Whether price affects with multiplication or division
    * @return pricePrecision Factor by which price has been multiplied for precision
    */
    function getCurrentPrice(uint256 _saleId) constant returns (uint256 price, bool isInversePrice, uint256 pricePrecision) {
        transitionSalePeriodIfNeeded(sales[_saleId]); // if done with 'sendTransaction' this function can modify state
        return calculatePrice(_saleId);
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

        uint256 boughtTokens;
        if (sale.isInversePrice) {
            boughtTokens = allowedAmount.mul(price).div(pricePrecision);
        } else {
            boughtTokens = allowedAmount.mul(pricePrecision).div(price);
        }

        // Only allow until max sold cap is hit
        uint256 allowedBuy = Math.min256(boughtTokens, sale.maxSold.sub(sale.soldAmount));

        // Calculate how much we need to refund for the tokens that weren't sold
        uint256 nonBoughtTokens = boughtTokens.sub(allowedBuy);

        uint256 returnAmount;
        if (!sale.isInversePrice) {
            returnAmount = nonBoughtTokens.mul(price).div(pricePrecision);
        } else {
            returnAmount = nonBoughtTokens.mul(pricePrecision).div(price);
        }

        uint256 finalAllowedAmount = allowedAmount.sub(returnAmount);

        sale.soldAmount = sale.soldAmount.add(allowedBuy);
        sale.raisedAmount = sale.raisedAmount.add(finalAllowedAmount);

        tokenManager.mint(_buyer, allowedBuy); // Do actual minting of tokens for buyer

        if (sale.soldAmount == sale.maxSold || sale.raisedAmount == sale.maxRaised)
            _closeSale(_saleId);

        return _payedTokens.sub(finalAllowedAmount); // how many tokens must be returned to buyer as they weren't allowed in
    }

    function _closeSale(uint256 _saleId) internal {
        require(!sales[_saleId].closed);
        sales[_saleId].closed = true;
        CloseSale(_saleId);
    }

    function calculatePrice(uint256 _saleId) internal constant returns (uint256 price, bool isInversePrice, uint256 pricePrecision) {
        Sale storage sale = sales[_saleId];

        SalePeriod storage period = sale.periods[sale.currentPeriod];

        pricePrecision = 10 ** 8;  // given that exchangeRate is a uint, we need more precision for interpolating
        isInversePrice = sale.isInversePrice;
        price = period.initialPrice.mul(pricePrecision);

        if (period.finalPrice != 0) { // interpolate price by period
            uint256 periodDelta = uint256(period.periodEnds).sub(uint256(sale.periodStartTime));
            uint256 periodState = getTimestamp().sub(uint256(sale.periodStartTime));
            if (period.finalPrice > period.initialPrice) {
                uint256 p1 = period.finalPrice.sub(period.initialPrice);
                uint256 inc = pricePrecision.mul(p1).mul(periodState).div(periodDelta);
                price = price.add(inc);
            } else {
                uint256 p2 = period.initialPrice.sub(period.finalPrice);
                uint256 dec = pricePrecision.mul(p2).mul(periodState).div(periodDelta);
                price = price.sub(dec);
            }
        }
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

    /*
    // TODO: Decide on ERC223 support
    // Just for ERC223 interfacing
    function buy(uint256 _saleId) { _saleId; }

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
    */
}
