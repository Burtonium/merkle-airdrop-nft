// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Contributors {
    address[] public contributors;

    constructor(address[] memory _contributors) {
        contributors = _contributors;
    }

    function _withdrawToContributors() internal virtual {
        uint256 amountDivided = address(this).balance / contributors.length;
        uint256 deleted = 0;

        for (uint256 i = 0; i < contributors.length; i++) {
            // rewind for deleted contributors
            i -= deleted;
            deleted = 0;
            (bool success, ) = contributors[i].call{value: amountDivided}("");
            // If the transfer fails, remove contributor from the list
            if (!success) {
                contributors[i] = contributors[contributors.length - 1];
                contributors.pop();
                deleted++;
            }
        }
    }
}

contract ContributorsExposed is Contributors {
    constructor(address[] memory _contributors) Contributors(_contributors) {}

    function withdrawToContributors() public {
        super._withdrawToContributors();
    }
}

contract FailingContributor {
    fallback() external payable {
        revert("FailingContributor: pretty good at failing");
    }
}
