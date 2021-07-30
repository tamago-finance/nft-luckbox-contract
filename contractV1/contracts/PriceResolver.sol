// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./utility/Lockable.sol"; 
import "./interfaces/IPriceFeeder.sol";
import "./interfaces/IChainlinkPriceFeeder.sol";
import "./interfaces/ISide.sol";
import "./interfaces/ILeverageSize.sol";
import "./interfaces/IPriceResolver.sol";
import "./utility/Whitelist.sol";
import "./utility/Ownable.sol";
import "./utility/LibMath.sol";

/**
 * @title TBD
 */

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


/**
 * @title TBD
 */

contract PriceResolver is Lockable, Whitelist, ISide, IPriceResolver, ILeverageSize {
    
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;

    enum State {INITIAL, NORMAL, EMERGENCY, EXPIRED}

    // Price feeder contract.
    IChainlinkPriceFeeder public priceFeeder;
    // Proxy price feeder giving to leveraged tokens
    ProxyFeeder public priceFeederLong;
    ProxyFeeder public priceFeederShort;

    uint256 public emergencyReferencePrice;
    uint256 public startingPrice;
    State public state;
    LeverageSize public leverage;

    uint8 constant DAYS_TO_OBSERVE = 60;

    constructor(
        LeverageSize _leverage,
        address _priceFeederAddress,
        uint256 _emergencyReferencePrice,
        uint256 _startingPrice,
        address _devAddress
    ) public nonReentrant() {
        require( _priceFeederAddress != address(0), "Invalid Price Feeder address" );
        require( _emergencyReferencePrice != 0, "Reference price can't be zero" );

        priceFeederLong = new ProxyFeeder(Side.LONG);
        priceFeederShort = new ProxyFeeder(Side.SHORT);

        priceFeeder = IChainlinkPriceFeeder(_priceFeederAddress);
        emergencyReferencePrice = _emergencyReferencePrice;
        leverage = _leverage;
        startingPrice = _startingPrice;

        state = State.INITIAL;

        addAddress(_devAddress);
        
        if (_devAddress != msg.sender) {
            addAddress(msg.sender);
        }
    }

    function init() public nonReentrant() onlyWhitelisted() {
        require( state == State.INITIAL , "Invalid state" );

        priceFeederLong.init(address(this));
        priceFeederShort.init(address(this));

        state = State.NORMAL;
    }

    function setEmergencyPrice(uint256 _value) public nonReentrant() onlyWhitelisted() {
        emergencyReferencePrice = _value;
    }

    function getEmergencyReferencePrice() public view returns (uint256) {
        return emergencyReferencePrice;
    }

    function getPrimaryReferencePrice() public view returns (uint256) {
        (uint256 value, ) = priceFeeder.getAveragePrice( DAYS_TO_OBSERVE );
        return value;
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

    
    // INTERNAL FUNCTIONS
 
    // Use 120-days average price from ChainlinkPriceFeed's contract as the reference price first, fallback to emergency reference price 
    function _getReferencePrice() internal view returns (uint256) {
        try priceFeeder.getAveragePrice( DAYS_TO_OBSERVE ) returns (
            uint256 value,
            uint8 count
        ) {
            
            return value;
        } catch Error(
            string memory /*reason*/
        ) {
            return emergencyReferencePrice;
        } catch (
            bytes memory /*lowLevelData*/
        ) {
            return emergencyReferencePrice;
        }
    }


    function _coefficient() internal view returns (int256, int256) {
        int256 currentValue = (priceFeeder.getValue()).toInt256();
        int256 long = currentValue.wdiv(_getReferencePrice().toInt256());
        int256 short = (long.sub(1000000000000000000).mul(-1)).add(1000000000000000000);

        if (leverage == LeverageSize.HALF) {
            long = _sqrt(long);
            short = _sqrt(short);
        } else if (leverage == LeverageSize.TWO) {
            long = long.wmul(long);
            short = short.wmul(short);
        } else if (leverage == LeverageSize.THREE) {
            long = long.wmul(long).wmul(long);
            short = short.wmul(short).wmul(short);
        } else if (leverage == LeverageSize.FOUR) {
            long = long.wmul(long).wmul(long).wmul(long);
            short = short.wmul(short).wmul(short).wmul(short);
        }

        return (long, short);
    }

    function _getUnixDay() internal view returns (uint) {
        return now.div(86400);
    }

    function _sqrt(int256 y) internal pure returns (int256 z) {
        if (y > 3) {
            z = y;
            int256 x = (y / 2) + 1;
            while (x < z) {
                z = x;
                x = ((y / x) + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
        z = z.mul(10**9);
    }

}