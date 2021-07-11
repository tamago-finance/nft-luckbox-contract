// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./utility/Lockable.sol"; 
import "./interfaces/IPriceFeeder.sol";
import "./interfaces/ISide.sol";
import "./interfaces/IPriceResolver.sol";
import "./utility/Whitelist.sol";
import "./utility/Ownable.sol";
import "./utility/LibMath.sol";

contract ProxyFeeder is IPriceFeeder, Ownable {

    uint256 private value;
    Side private side;

    IPriceResolver private priceResolver;

    constructor(Side _side) public {
        side = _side;
    }

    function init(address _priceResolverAddress) onlyOwner() external {
        require( _priceResolverAddress != address(0), "Invalid Price Resolver address" );
        
        priceResolver = IPriceResolver(_priceResolverAddress);
    }

    function getValue() public override view returns (uint256) {
        (uint256 longPrice, uint256 shortPrice ) = priceResolver.getAdjustedPrice();
        if (side == Side.LONG) {
            return longPrice;
        } else {
            return shortPrice;
        }
    }

    function getTimestamp() public override view returns (uint256) {
        return now;
    }

    function getSide() public override view returns (Side) {
        return side;
    }
}


contract PriceResolver is Lockable, Whitelist, ISide, IPriceResolver {
    
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;

    enum State {INITIAL, NORMAL, EMERGENCY, EXPIRED}
    enum Leverage {ONE, TWO, THREE, FOUR}

    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // Proxy price feeder giving to leveraged tokens
    ProxyFeeder public priceFeederLong;
    ProxyFeeder public priceFeederShort;

    // Day from 1970 => Price
    mapping(uint => uint256) public historicalPrices;

    uint256 public referencePrice;
    uint256 public startingPrice;
    State public state;
    Leverage public leverage;

    uint8 constant MAX_DATA_POINTS = 120; // Total data points to be observed

    constructor(
        Leverage _leverage,
        address _priceFeederAddress,
        uint256 _referencePrice,
        uint256 _startingPrice,
        address _devAddress
    ) public nonReentrant() {
        require( _priceFeederAddress != address(0), "Invalid Price Feeder address" );
        require( _referencePrice != 0, "Reference price can't be zero" );

        priceFeederLong = new ProxyFeeder(Side.LONG);
        priceFeederShort = new ProxyFeeder(Side.SHORT);

        priceFeeder = IPriceFeeder(_priceFeederAddress);
        referencePrice = _referencePrice;
        leverage = _leverage;
        startingPrice = _startingPrice;

        state = State.INITIAL;

        addAddress(_devAddress);
    }

    function init() public nonReentrant() onlyWhitelisted() {
        require( state == State.INITIAL , "Invalid state" );

        priceFeederLong.init(address(this));
        priceFeederShort.init(address(this));

        state = State.NORMAL;
    }

    // invoke it daily
    function dump() public nonReentrant() onlyWhitelisted() {
        uint256 value = priceFeeder.getValue();
        uint day = _getUnixDay();

        historicalPrices[day] = value;
    }

    function forceDump(uint day, uint256 value) public nonReentrant() onlyWhitelisted() {
        historicalPrices[day] = value;
    }

    // dangerous
    function updateReferencePrice() public nonReentrant() onlyWhitelisted() {
        uint256 price = getAvgPrice();
        require(price!=0, "Avg Price error");
        referencePrice = price;
    }

    function getAvgPrice() public view returns (uint256) {
        uint day = _getUnixDay();

        uint count = 0;
        uint256 sum = 0;
        uint256 totalSample = 0;

        while (MAX_DATA_POINTS >= count) {

            uint256 value = historicalPrices[day.sub(count)];

            if (value != 0) {
                sum = sum.add(value);
                totalSample++;
            }

            count++;
        }
        
        return sum.div(totalSample);
    }

    function getCurrentPrice() override external view returns (uint256) {
        return priceFeeder.getValue();
    }

    function getPriceFeederLong() override external view returns (address) {
        return address(priceFeederLong);
    }

    function getPriceFeederShort() override external view returns (address) {
        return address(priceFeederShort);
    }

    function getAdjustedPrice() override external view returns (uint256, uint256) {
        (int256 longCoeff, int256 shortCoeff) = _coefficient();
        
        return (startingPrice.wmul(longCoeff.toUint256()),startingPrice.wmul(shortCoeff.toUint256()));
    }

    function currentCoefficient() override external view returns (int256, int256) {
        return _coefficient();
    }

    function getStartingPrice() override external view returns (uint256) {
        return startingPrice;
    }

    function currentUnixDay() public view returns (uint) {
        return _getUnixDay();
    }

    function _coefficient() internal view returns (int256, int256) {
        int256 currentValue = (priceFeeder.getValue()).toInt256();
        int256 long = currentValue.wdiv(referencePrice.toInt256());
        int256 short = (long.sub(1000000000000000000).mul(-1)).add(1000000000000000000);

        if (leverage == Leverage.TWO) {
            long = long.wmul(long);
            short = short.wmul(short);
        } else if (leverage == Leverage.THREE) {
            long = long.wmul(long).wmul(long);
            short = short.wmul(short).wmul(short);
        } else if (leverage == Leverage.FOUR) {
            long = long.wmul(long).wmul(long).wmul(long);
            short = short.wmul(short).wmul(short).wmul(short);
        }

        return (long, short);
    }

    function _getUnixDay() internal view returns (uint) {
        return now.div(86400);
    }

}