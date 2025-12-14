/**
 * common.js
 */

/**
 * Picks a random element from an array.
 *
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}