// SPDX-License-Identifier: MIT
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;


import "./utility/Lockable.sol"; 
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./utility/Whitelist.sol";

/**
 * @title Clearing House contract
 */

contract ClearingHouse is Lockable, Whitelist {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;


    enum Side { BUY, SELL }


    // Adjustable params
    uint256 public initMarginRatio = 50000000000000000; // 5%s
    uint256 public maintenanceMarginRatio = 50000000000000000; // 5%
    uint256 public liquidationFeeRatio = 50000000000000000; // 5%

    event CreatedClearingHouse();

    constructor(
        
    ) public nonReentrant() {
        

        addAddress(msg.sender);

        emit CreatedClearingHouse();
    }


    // Only admin
    function setInitMarginRatio(uint256 value) external onlyWhitelisted() {
        require(initMarginRatio != value, "duplicated value" );
        initMarginRatio = value;
    }

    // Only admin
    function setMaintenanceMarginRatio(uint256 value) external onlyWhitelisted() {
        require(maintenanceMarginRatio != value, "duplicated value" );
        maintenanceMarginRatio = value;
    }

    // Only admin
    function setLiquidationFeeRatio(uint256 value) external onlyWhitelisted() {
        require(liquidationFeeRatio != value, "duplicated value" );
        liquidationFeeRatio = value;
    }

    // open new position
    // FIXME : To be pausable
    // function openPosition(
    //     IAmm _amm,
    //     Side _side,
    //     uint256 _quoteAssetAmount,
    //     uint256 _leverage,
    //     uint256 _baseAssetAmountLimit
    // ) external nonReentrant() {
        
    //     address trader = _msgSender();
    //     PositionResp memory positionResp;
    //     {
    //         int256 oldPositionSize = _adjustPositionForLiquidityChanged(_amm, trader).size;

    //     }
    // }

    // INTERNAL

    // function _adjustPositionForLiquidityChanged(IAmm _amm, address _trader) internal returns (Position memory) {
    //     Position memory unadjustedPosition = _getUnadjustedPosition(_amm, _trader);
    //     if (unadjustedPosition.size == 0) {
    //         return unadjustedPosition;
    //     }

    //     Position memory adjustedPosition = _calcPositionAfterLiquidityMigration(
    //         _amm,
    //         unadjustedPosition,
    //         latestLiquidityIndex
    //     );

    //     return adjustedPosition;
    // }

    // function _getUnadjustedPosition(IAmm _amm, address _trader) public view returns (Position memory position) {
    //     position = ammMap[address(_amm)].positionMap[_trader];
    // }

    // function _calcPositionAfterLiquidityMigration(
    //     IAmm _amm,
    //     Position memory _position
    // ) internal view returns (Position memory) {

    //     // update the old curve's reserve
    //     // by applying notionalDelta to the old curve
    //     Decimal.decimal memory updatedOldBaseReserve;
    //     Decimal.decimal memory updatedOldQuoteReserve;
    //     if (notionalDelta.toInt() != 0) {
    //         Decimal.decimal memory baseAssetWorth = _amm.getInputPriceWithReserves(
    //             notionalDelta.toInt() > 0 ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM,
    //             notionalDelta.abs(),
    //             lastSnapshot.quoteAssetReserve,
    //             lastSnapshot.baseAssetReserve
    //         );
    //         updatedOldQuoteReserve = notionalDelta.addD(lastSnapshot.quoteAssetReserve).abs();
    //         if (notionalDelta.toInt() > 0) {
    //             updatedOldBaseReserve = lastSnapshot.baseAssetReserve.subD(baseAssetWorth);
    //         } else {
    //             updatedOldBaseReserve = lastSnapshot.baseAssetReserve.addD(baseAssetWorth);
    //         }
    //     } else {
    //         updatedOldQuoteReserve = lastSnapshot.quoteAssetReserve;
    //         updatedOldBaseReserve = lastSnapshot.baseAssetReserve;
    //     }

    //     // calculate the new position size
    //     _position.size = _amm.calcBaseAssetAfterLiquidityMigration(
    //         _position.size,
    //         updatedOldQuoteReserve,
    //         updatedOldBaseReserve
    //     );
    //     _position.liquidityHistoryIndex = _latestLiquidityIndex;

    //     return _position;
    // }

}