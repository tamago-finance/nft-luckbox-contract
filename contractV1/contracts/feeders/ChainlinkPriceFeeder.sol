// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "../utility/Ownable.sol";
import "../utility/Whitelist.sol";
import "../interfaces/IPriceFeeder.sol"; 
import "../utility/LibMath.sol";
import "../utility/chainlink/interfaces/AggregatorV3Interface.sol";

contract ChainlinkPriceFeeder is IPriceFeeder {

    using LibMathUnsigned for uint256;

    string public name;
    uint256 public value = 100000;
    AggregatorV3Interface internal chainlinkPriceFeed;
    uint8 public decimals;
    uint256 private timestamp;
    Side private side; // not used heres

    /*
        Example:
        _name : Facebook
        _chainlinkPriceFeedAddress : 0xCe1051646393087e706288C1B57Fd26446657A7f
        _decimals : 8
    */

    constructor(string memory _name, address _chainlinkPriceFeedAddress, uint8 _decimals) public {

        require(_decimals == 8 || _decimals == 18 , "Decimals must be either 8 or 18");

        name = _name;
        decimals = _decimals;
        side = Side.FLAT;
        chainlinkPriceFeed = AggregatorV3Interface(_chainlinkPriceFeedAddress);
    }

    function getValue() public override view returns (uint256) {
        (
            , 
            int price,
            ,
            ,
        ) = chainlinkPriceFeed.latestRoundData();

        uint256 output = uint256(price);

        if (decimals == 8) {
            output = output.mul(10**10);
        }

        return output;
    }

    function getTimestamp() public override view returns (uint256) {
        return _getTimestamp();
    }

    // not used
    function getSide() public override view returns (Side) {
        return side;
    }

    function _getTimestamp() internal view returns (uint256) {
        (
            , 
            ,
            ,
            uint timeStamp,
        ) = chainlinkPriceFeed.latestRoundData();

        return uint256(timeStamp);
    }


}