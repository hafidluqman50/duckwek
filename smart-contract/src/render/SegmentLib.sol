// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

library SegmentLib {
    uint256 internal constant STEP = 20;
    uint256 internal constant MAX_SEGMENTS = 96;

    error BadSegments();

    function validate(bytes memory segments) internal pure {
        if (segments.length == 0 || segments.length > MAX_SEGMENTS) revert BadSegments();

        for (uint256 index; index < segments.length; ++index) {
            uint8 segment = uint8(segments[index]);
            if ((segment & 0x0f) == 0 || (segment >> 4) > 6) revert BadSegments();
        }
    }

    function turnsAndLength(bytes memory segments) internal pure returns (uint16 turns, uint32 lengthMetres) {
        for (uint256 index; index < segments.length; ++index) {
            uint8 segment = uint8(segments[index]);
            if ((segment >> 4) != 0) ++turns;

            lengthMetres += uint32(segment & 0x0f) * uint32(STEP);
        }
    }

    function _directionVector(uint256 heading) private pure returns (int256 deltaX, int256 deltaY) {
        if (heading == 0) return (100, 0);

        if (heading == 1) return (71, 71);

        if (heading == 2) return (0, 100);

        if (heading == 3) return (-71, 71);

        if (heading == 4) return (-100, 0);

        if (heading == 5) return (-71, -71);

        if (heading == 6) return (0, -100);

        return (71, -71);
    }

    function walk(bytes memory segments)
        internal
        pure
        returns (int256[] memory pointsX, int256[] memory pointsY, bool closed, uint256 startHeading)
    {
        uint256 segmentCount = segments.length;
        pointsX = new int256[](segmentCount + 1);
        pointsY = new int256[](segmentCount + 1);
        uint256 heading = 0;
        for (uint256 index; index < segmentCount; ++index) {
            uint8 turnCode = uint8(segments[index]) >> 4;
            if (turnCode == 1) heading = (heading + 7) % 8;
            else if (turnCode == 2) heading = (heading + 1) % 8;
            else if (turnCode == 3) heading = (heading + 6) % 8;
            else if (turnCode == 4) heading = (heading + 2) % 8;
            else if (turnCode == 5) heading = (heading + 5) % 8;
            else if (turnCode == 6) heading = (heading + 3) % 8;
            if (index == 0) startHeading = heading;

            (int256 deltaX, int256 deltaY) = _directionVector(heading);
            int256 length = int256(uint256(uint8(segments[index]) & 0x0f) * STEP);
            pointsX[index + 1] = pointsX[index] + deltaX * length;
            pointsY[index + 1] = pointsY[index] + deltaY * length;
        }

        int256 closureLimit = int256(STEP) * 100;
        int256 endOffsetX = pointsX[segmentCount] - pointsX[0];
        int256 endOffsetY = pointsY[segmentCount] - pointsY[0];
        closed = (
            endOffsetX <= closureLimit && endOffsetX >= -closureLimit && endOffsetY <= closureLimit
                && endOffsetY >= -closureLimit
        );
    }
}
