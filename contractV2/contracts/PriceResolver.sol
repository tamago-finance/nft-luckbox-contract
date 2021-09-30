// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./interfaces/IPriceResolver.sol";
import "./interfaces/IChainlinkPriceFeeder.sol";
import "./utility/LibMath.sol";

/**
 * @title A contract to resolves the asset price
 */

contract PriceResolver is Lockable, Whitelist, IPriceResolver {

    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;

    // Price feeder contract.
    IChainlinkPriceFeeder public priceFeeder;
    // Price feeder contract of collateral asset
    IChainlinkPriceFeeder public priceFeederCollateral;

    // fall-back value from avg price
    uint256 public emergencyAvgPrice;

    constructor(
        address _priceFeederAddress,
        address _priceFeederCollateralAddress,
        uint256 _emergencyAvgPrice,
        address _devAddress
    ) public nonReentrant {
        require( _priceFeederAddress != address(0), "Invalid _priceFeederAddress" );
        require( _priceFeederCollateralAddress != address(0), "Invalid _priceFeederCollateralAddress" );
        require( _emergencyAvgPrice != 0, "Reference price can't be zero" );

        priceFeeder = IChainlinkPriceFeeder(_priceFeederAddress);
        priceFeederCollateral = IChainlinkPriceFeeder(_priceFeederCollateralAddress);

        emergencyAvgPrice = _emergencyAvgPrice;

        addAddress(_devAddress);
        
        if (_devAddress != msg.sender) {
            addAddress(msg.sender);
        }
    }

    // update the fall-back avg price
    function setEmergencyPrice(uint256 _value) public nonReentrant onlyWhitelisted {
        emergencyAvgPrice = _value;
    }

    // get the fall-back avg price
    function getEmergencyReferencePrice() public view returns (uint256) {
        return emergencyAvgPrice;
    }

    // get the current price
    function getCurrentPrice() override external view returns (uint256) {
        return priceFeeder.getValue();
    }

    // get the current price of the collateral
    function getCurrentPriceCollateral() override external view returns (uint256) {
        return priceFeederCollateral.getValue();
    }

    // get avg 30d price of the collateral
    function getAvg30Price() override external view returns (uint256) {
        return _getAvgPrice(30);
    }

    // get avg 60d price of the collateral
    function getAvg60Price() override external view returns (uint256) {
        return _getAvgPrice(60);
    }

    // get raw mint ratio
    function getRawRatio() override external view returns (uint256) {
        return _rawRatio();
    }

    // get adjusted mint ratio
    function getCurrentRatio() override external view returns (uint256) {
        return _adjustedRatio();
    }

    // the flag to identify the market
    function isBullMarket() override public view returns (bool) {
        uint256 ratio = _rawRatio();
        if (ratio > 500000000000000000) {
            return true;
        } else {
            return false;
        }
    }

    // INTERNAL FUNCTIONS

    // get a collateral asset avg price of totalDay
    function _getAvgPrice(uint8 totalDay) internal view returns (uint256) {
        try priceFeederCollateral.getAveragePrice( totalDay ) returns (
            uint256 value,
            uint8 count
        ) {
            
            return value;
        } catch Error(
            string memory /*reason*/
        ) {
            return emergencyAvgPrice;
        } catch (
            bytes memory /*lowLevelData*/
        ) {
            return emergencyAvgPrice;
        }
    }

    // ratio = latest price / (avg 30d price + avg 60d price) , >0.5  = bull , <0.5 = bear
    function _rawRatio() internal view returns (uint256) {
        return ((priceFeederCollateral.getValue()).wdiv( _getAvgPrice(30).add(_getAvgPrice(60))));
    }

    // capping the ratio between 0.2 and 0.8
    function _adjustedRatio() internal view returns (uint256) {
        uint256 ratio = _rawRatio();
        if (ratio > 800000000000000000) { // 0.8
            ratio = 800000000000000000;
        } else if (ratio < 200000000000000000) { // 0.2
            ratio = 200000000000000000;
        }
        return ratio;
    }

}