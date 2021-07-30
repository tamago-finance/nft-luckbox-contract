// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "../utility/Ownable.sol";
import "../utility/Whitelist.sol";
import "../interfaces/IChainlinkPriceFeeder.sol";
import "../utility/LibMath.sol";
import "../utility/chainlink/interfaces/AggregatorV3Interface.sol";

contract ChainlinkPriceFeeder is IChainlinkPriceFeeder {
    using LibMathUnsigned for uint256;
    using LibMathSigned for int256;

    string public name;
    // uint256 public value = 100000;
    AggregatorV3Interface internal chainlinkPriceFeed;
    uint8 public decimals;
    uint256 private timestamp;
    Side private side; // not used heres

    uint8 constant MAX_DAY_BACKWARD = 120;
    uint8 constant MAX_ROUND_RECURSIVE = 125;
    uint8 constant MAX_DATA_POINT = 6;

    /*
        Example:
        _name : Facebook
        _chainlinkPriceFeedAddress : 0xCe1051646393087e706288C1B57Fd26446657A7f
        _decimals : 8
    */

    constructor(
        string memory _name,
        address _chainlinkPriceFeedAddress,
        uint8 _decimals
    ) public {
        require(
            _decimals == 8 || _decimals == 18,
            "Decimals must be either 8 or 18"
        );

        name = _name;
        decimals = _decimals;
        side = Side.FLAT;
        chainlinkPriceFeed = AggregatorV3Interface(_chainlinkPriceFeedAddress);
    }


    // get current price
    function getValue() external view override returns (uint256) {
        (uint256 value, ) = _getCurrentValue();
        return value;
    }

    // get current timmestamp
    function getTimestamp() external view override returns (uint256) {
        return _getTimestamp();
    }

    // not used here
    function getSide() external view override returns (Side) {
        return side;
    }

    // get the price from the given day (ago)
    function getPastValue(uint8 dayAgo)
        external
        view
        override
        returns (int256, uint256)
    {
        return _getPastValue(dayAgo);
    }

    // get the average price from the last given day until today, sampling only MAX_DATA_POINT to avoid gas error
    function getAveragePrice(uint8 totalDay)
        external
        view
        override
        returns (uint256, uint8)
    {
        require(
            MAX_DAY_BACKWARD >= totalDay,
            "Given day is exceeding MAX_DAY_BACKWARD"
        );

        uint8 totalCount = 0;
        uint256 sum = 0;
        int256 v;

        for (uint256 i = 0; i < totalDay; i++) {
            if (totalDay > MAX_DATA_POINT) {
                if ( i % (totalDay / MAX_DATA_POINT) == 0 ) {
                    (v, ) = _getPastValue(uint8(i));
                    if (v != 0) {
                        v = v.div(10**9);
                        sum = sum.add((v).toUint256()); 
                        totalCount += 1;
                    } 
                }
            } else {
                // sum all values from last 7 days
                (v, ) = _getPastValue(uint8(i));
                if (v != 0) {
                    v = v.div(10**9);
                    sum = sum.add((v).toUint256());
                    totalCount += 1;
                }
            }
        }
        sum = sum.mul(10**9);
        return (sum.div(totalCount), totalCount);
    }

    // calculate roundID from the given day
    function _calculateRoundIdAtDay(uint8 dayAgo)
        internal
        view
        returns (uint256)
    {
        (uint80 roundID, , , , ) = chainlinkPriceFeed.latestRoundData();

        uint256 targetRoundId = (uint256(roundID)).sub(
            (_totalRoundInDay()).mul(uint256(dayAgo))
        );

        return targetRoundId;
    }

    // total rounds per day
    function totalRoundInDay() public view returns (uint256) {
        return _totalRoundInDay();
    }

    // INTERNAL FUNCTIONS

    function _totalRoundInDay() internal view returns (uint256) {
        uint256 total = 0;

        (uint80 roundID, , , uint256 timeStamp, ) = chainlinkPriceFeed
            .latestRoundData();

        uint256 startTimestamp = timeStamp;
        uint256 endTimestamp = now;
        uint256 targetTimestamp = timeStamp.sub(86400);

        for (uint256 i = 0; i < MAX_ROUND_RECURSIVE; i++) {
            roundID -= 1;
            total += 1;

            (roundID, , , endTimestamp, ) = chainlinkPriceFeed.getRoundData(
                roundID
            );

            if (targetTimestamp > endTimestamp) {
                break;
            }
        }

        uint256 timeSpan = startTimestamp.sub(endTimestamp);
        return (total.mul(86400)).div(timeSpan);
    }

    function _getTimestamp() internal view returns (uint256) {
        (, , , uint256 timeStamp, ) = chainlinkPriceFeed.latestRoundData();

        return uint256(timeStamp);
    }

    function _getPastValue(uint8 dayAgo)
        internal
        view
        returns (int256, uint256)
    {
        require(
            MAX_DAY_BACKWARD >= dayAgo,
            "Given day is exceeding MAX_DAY_BACKWARD"
        );

        if (dayAgo == 0) {
            (uint256 latestValue, uint256 latestTimeStamp) = _getCurrentValue();
            return (int256(latestValue), latestTimeStamp);
        }

        uint256 targetRoundId = _calculateRoundIdAtDay(dayAgo);

        // (, int256 value, , uint256 timeStamp, ) = chainlinkPriceFeed
        //     .getRoundData(uint80(targetRoundId));
        // return (value, timeStamp);

        try chainlinkPriceFeed.getRoundData(uint80(targetRoundId)) returns (
            uint80 chainlinkId,
            int256 chanlinkValue,
            uint256 chainlinkStarted,
            uint256 chainlinkTimestamp,
            uint80 chainlinkAnswer
        ) {
            if (decimals == 8) {
                chanlinkValue = chanlinkValue.mul(10**10);
            }
            return (chanlinkValue, chainlinkTimestamp);
        } catch Error(
            string memory /*reason*/
        ) {
            return (0, 0);
        } catch (
            bytes memory /*lowLevelData*/
        ) {
            return (0, 0);
        }
    }

    function _getCurrentValue() internal view returns (uint256, uint256) {
        (, int256 price, , uint256 timeStamp, ) = chainlinkPriceFeed
            .latestRoundData();

        uint256 output = uint256(price);

        if (decimals == 8) {
            output = output.mul(10**10);
        }

        return (output, timeStamp);
    }
}
