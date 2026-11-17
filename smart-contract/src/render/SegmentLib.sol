// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Track layout format (plan 0013 §12, G4): one byte per segment.
///   high nibble = turn applied before the segment: 0 straight, 1 left 45°, 2 right 45°, 3 left 90°, 4 right 90°,
///                 5 left 135°, 6 right 135°
///   low nibble  = length in steps of `STEP` metres (1..15)
/// The walk starts at heading east. The same format is read by the renderer here and by the engine off chain.
library SegmentLib {
    uint256 internal constant STEP = 20; // metres per length unit
    uint256 internal constant MAX_SEGMENTS = 96;

    error BadSegments();

    function validate(bytes memory seg) internal pure {
        if (seg.length == 0 || seg.length > MAX_SEGMENTS) revert BadSegments();
        for (uint256 i; i < seg.length; ++i) {
            uint8 b = uint8(seg[i]);
            if ((b & 0x0f) == 0 || (b >> 4) > 6) revert BadSegments();
        }
    }

    function turnsAndLength(bytes memory seg) internal pure returns (uint16 turns, uint32 lengthM) {
        for (uint256 i; i < seg.length; ++i) {
            uint8 b = uint8(seg[i]);
            if ((b >> 4) != 0) ++turns;
            lengthM += uint32(b & 0x0f) * uint32(STEP);
        }
    }

    /// @dev Unit vectors scaled by 100, heading index grows clockwise on screen (y down): E, SE, S, SW, W, NW, N, NE.
    function _vec(uint256 h) private pure returns (int256 dx, int256 dy) {
        if (h == 0) return (100, 0);
        if (h == 1) return (71, 71);
        if (h == 2) return (0, 100);
        if (h == 3) return (-71, 71);
        if (h == 4) return (-100, 0);
        if (h == 5) return (-71, -71);
        if (h == 6) return (0, -100);
        return (71, -71);
    }

    /// @return xs ys the n+1 vertices (units of 1/100 metre) ; closed true when the walk ends within one step of its start;
    ///         startHeading is the heading of the first segment (0..7).
    function walk(bytes memory seg) internal pure returns (int256[] memory xs, int256[] memory ys, bool closed, uint256 startHeading) {
        uint256 n = seg.length;
        xs = new int256[](n + 1);
        ys = new int256[](n + 1);
        uint256 h = 0;
        for (uint256 i; i < n; ++i) {
            uint8 t = uint8(seg[i]) >> 4;
            if (t == 1) h = (h + 7) % 8;
            else if (t == 2) h = (h + 1) % 8;
            else if (t == 3) h = (h + 6) % 8;
            else if (t == 4) h = (h + 2) % 8;
            else if (t == 5) h = (h + 5) % 8;
            else if (t == 6) h = (h + 3) % 8;
            if (i == 0) startHeading = h;
            (int256 dx, int256 dy) = _vec(h);
            int256 len = int256(uint256(uint8(seg[i]) & 0x0f) * STEP);
            xs[i + 1] = xs[i] + dx * len;
            ys[i + 1] = ys[i] + dy * len;
        }
        int256 lim = int256(STEP) * 100;
        int256 ex = xs[n] - xs[0];
        int256 ey = ys[n] - ys[0];
        closed = (ex <= lim && ex >= -lim && ey <= lim && ey >= -lim);
    }
}
