// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "./IERC20.sol";

library SafeERC20 {
    error SafeERC20FailedOperation(address token, bytes data);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, value)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert SafeERC20FailedOperation(address(token), data);
        }
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert SafeERC20FailedOperation(address(token), data);
        }
    }
}
