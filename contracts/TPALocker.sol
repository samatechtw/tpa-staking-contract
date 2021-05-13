// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { Ownable } from "./Ownable.sol";
import { IERC20 } from "./IERC20.sol";

/// TPA locker specifically for holding unstaked TPA from TPAStaking.sol
contract TPALocker is Ownable {

    event Locked(address lockAddress, uint256 amount, uint256 releaseTime);
    event Unlocked(address lockAddress, uint256 amount);

    struct Lock {
        // The amount of TPA locked
        uint256 tpa;
        // Timestamp of lock release
        uint256 releaseTime;
    }

    /// Token used for locking operations
    IERC20 public token;

    /// Used for validating reduced gas cost locking method
    address tpaStaking;

    mapping(address => Lock[]) public locker;

    /// @notice Construct locking contract with initial configuration
    constructor(address _token) {
        token = IERC20(_token);
    }

    function setStakingContract(address _tpaStaking) external onlyOwner {
        tpaStaking = _tpaStaking;
    }
    
    /// Allow the staking contract to directly lock tokens with `transfer`
    function stakingLock(address lockAddress, uint256 amount, uint256 releaseTime) public {
        require(msg.sender == tpaStaking, "Only TPAStaking");
        _lock(lockAddress, amount, releaseTime);
    }

    function lock(uint256 amount, uint256 releaseTime) public {
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= amount, "Allowance low");

        token.transferFrom(msg.sender, address(this), amount);
        _lock(msg.sender, amount, releaseTime);
    }

    function releasable(address lockAddress) public view returns(uint256) {
        uint256 amount = 0;
        for(uint256 idx = 0; idx < locker[lockAddress].length; idx += 1) {
            if(locker[lockAddress][idx].releaseTime <= block.timestamp) {
                amount += locker[lockAddress][idx].tpa;
            }
        }
        return amount;
    }

    function locked(address lockAddress) public view returns(uint256) {
        uint256 amount = 0;
        for(uint256 idx = 0; idx < locker[lockAddress].length; idx += 1) {
            amount += locker[lockAddress][idx].tpa;
        }
        return amount;
    }

    function unlock() public {
        require(locker[msg.sender].length > 0, "No locks");
        bool deleted = false;
        for(uint256 idx = 0; idx < locker[msg.sender].length; idx += 1) {
            // If Lock was deleted, continue at same list position.
            if(deleted) {
                idx -= 1;
                deleted = false;
            }
            if(locker[msg.sender][idx].releaseTime <= block.timestamp) {
                _unlock(msg.sender, idx);
                deleted = true;
            }
        }
    }
    
    function _lock(address lockAddress, uint256 amount, uint256 releaseTime) internal {
        locker[lockAddress].push(Lock({ tpa: amount, releaseTime: releaseTime }));
        emit Locked(lockAddress, amount, releaseTime);
    }
    
    function _unlock(address lockAddress, uint256 idx) internal {
        Lock storage lockInfo = locker[lockAddress][idx];
        uint256 releaseAmount = lockInfo.tpa;

        delete locker[lockAddress][idx];
        locker[lockAddress][idx] = locker[lockAddress][locker[lockAddress].length - 1];
        locker[lockAddress].pop();
        
        emit Unlocked(lockAddress, releaseAmount);
        token.transfer(lockAddress, releaseAmount);
    }
}