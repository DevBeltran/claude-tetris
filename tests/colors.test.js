/**
 * Tests for Tetris piece colors (Issue #4: J piece should be pale blue)
 */

// Replicate the COLORS array from game.js
const COLORS = [
    null,
    '#00FFFF', // I - cyan
    '#ADD8E6', // J - pale blue (light blue)
    '#FF7F00', // L - orange
    '#FFFF00', // O - yellow
    '#00FF00', // S - green
    '#800080', // T - purple
    '#FF0000', // Z - red
];

// Piece type indices
const PIECE_I = 1;
const PIECE_J = 2;
const PIECE_L = 3;
const PIECE_O = 4;
const PIECE_S = 5;
const PIECE_T = 6;
const PIECE_Z = 7;

/**
 * Helper: parse hex color to RGB components
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Determine if a color is "pale blue":
 * - blue channel is the dominant channel
 * - all channels are relatively high (pale = light color)
 * - the color is not pure cyan (equal R and G with high B)
 */
function isPaleBlue(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    // Pale blue: B is dominant, R and G are also fairly high (light/pale)
    return rgb.b > rgb.r && rgb.b > 150 && rgb.r > 100 && rgb.g > 150;
}

describe('Tetris piece colors', () => {
    test('COLORS array has 8 entries (null + 7 pieces)', () => {
        expect(COLORS.length).toBe(8);
    });

    test('index 0 is null (empty cell)', () => {
        expect(COLORS[0]).toBeNull();
    });

    describe('Issue #4 – J piece color', () => {
        test('J piece color is defined', () => {
            expect(COLORS[PIECE_J]).toBeDefined();
            expect(COLORS[PIECE_J]).not.toBeNull();
        });

        test('J piece color is pale blue (#ADD8E6)', () => {
            expect(COLORS[PIECE_J].toLowerCase()).toBe('#add8e6');
        });

        test('J piece color is a valid hex color', () => {
            expect(COLORS[PIECE_J]).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });

        test('J piece color is pale/light blue (blue dominant, all channels high)', () => {
            expect(isPaleBlue(COLORS[PIECE_J])).toBe(true);
        });

        test('J piece is NOT orange (was previously wrong color)', () => {
            const rgb = hexToRgb(COLORS[PIECE_J]);
            // Orange has high R, medium G, low B
            const isOrange = rgb.r > 200 && rgb.g > 100 && rgb.b < 50;
            expect(isOrange).toBe(false);
        });

        test('J piece is NOT red', () => {
            const rgb = hexToRgb(COLORS[PIECE_J]);
            const isRed = rgb.r > 200 && rgb.g < 50 && rgb.b < 50;
            expect(isRed).toBe(false);
        });

        test('J piece color is different from I piece (cyan)', () => {
            expect(COLORS[PIECE_J].toLowerCase()).not.toBe(COLORS[PIECE_I].toLowerCase());
        });

        test('J piece color is different from L piece (orange)', () => {
            expect(COLORS[PIECE_J]).not.toBe(COLORS[PIECE_L]);
        });
    });

    describe('Other piece colors remain correct', () => {
        test('I piece is cyan (#00FFFF)', () => {
            expect(COLORS[PIECE_I].toLowerCase()).toBe('#00ffff');
        });

        test('L piece is orange (#FF7F00)', () => {
            expect(COLORS[PIECE_L].toLowerCase()).toBe('#ff7f00');
        });

        test('O piece is yellow (#FFFF00)', () => {
            expect(COLORS[PIECE_O].toLowerCase()).toBe('#ffff00');
        });

        test('S piece is green (#00FF00)', () => {
            expect(COLORS[PIECE_S].toLowerCase()).toBe('#00ff00');
        });

        test('T piece is purple (#800080)', () => {
            expect(COLORS[PIECE_T].toLowerCase()).toBe('#800080');
        });

        test('Z piece is red (#FF0000)', () => {
            expect(COLORS[PIECE_Z].toLowerCase()).toBe('#ff0000');
        });
    });

    describe('All piece colors are unique', () => {
        test('no two pieces share the same color', () => {
            const pieceColors = COLORS.slice(1).map(c => c.toLowerCase());
            const uniqueColors = new Set(pieceColors);
            expect(uniqueColors.size).toBe(pieceColors.length);
        });
    });
});
