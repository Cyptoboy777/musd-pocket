// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The slice of Mezo's MUSD protocol (github.com/mezo-org/musd) that MUSD Pocket uses.

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @dev BorrowerOperationsSignatures: lets a borrower authorise a trove action with an
///      EIP-712 signature that someone else submits. We use WithdrawMUSD with
///      recipient = MUSD Pocket, so the newly minted MUSD lands straight in a goal.
interface IBorrowerOperationsSignatures {
    function withdrawMUSDWithSignature(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        address _recipient,
        bytes memory _signature,
        uint256 _deadline
    ) external;

    function getNonce(address user) external view returns (uint256);
}

interface ITroveManager {
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
}

interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}
