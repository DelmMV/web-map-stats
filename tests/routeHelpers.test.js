import { describe, expect, it } from 'vitest'
import {
	computeRouteDistanceKmValue,
	computeRouteDistanceText,
	extractDescription,
	extractDifficulty,
	extractRouteDateText,
	extractSurfaceTypes,
	formatDifficulty,
	getDateFromObjectId,
	normalizeCoordinates,
	resolveDateValue,
	UNKNOWN_DATE_LABEL,
} from '../src/utils/routeHelpers'
import { formatRouteDate } from '../src/utils/routeFormatters'

describe('routeHelpers', () => {
	describe('getDateFromObjectId / resolveDateValue', () => {
		it('parses ObjectId-like strings', () => {
			// 65000000 -> hex timestamp => 2023-09-10T00:00:00.000Z
			const date = getDateFromObjectId('650000000000000000000000')
			expect(date).toBeInstanceOf(Date)
			expect(date.getUTCFullYear()).toBe(2023)
		})

		it('returns null for invalid ObjectId', () => {
			expect(getDateFromObjectId('not-an-id')).toBeNull()
		})

		it('handles various input shapes', () => {
			const ts = Date.now()
			expect(resolveDateValue(ts)).toBeInstanceOf(Date)
			expect(resolveDateValue({ $date: ts })).toBeInstanceOf(Date)
			expect(resolveDateValue('invalid')).toBeNull()
		})
	})

	describe('extractRouteDateText', () => {
		it('picks date from known keys', () => {
			const route = { createdAt: '2024-01-02T00:00:00Z' }
			expect(extractRouteDateText(route)).toBe(formatRouteDate(new Date(route.createdAt)))
		})

		it('falls back to ObjectId and unknown label', () => {
			const idBased = { routeId: '650000000000000000000000' }
			expect(extractRouteDateText(idBased)).not.toBe(UNKNOWN_DATE_LABEL)
			expect(extractRouteDateText({})).toBe(UNKNOWN_DATE_LABEL)
		})
	})

	describe('extractSurfaceTypes', () => {
		it('collects unique surfaces from nested sources', () => {
			const surfaces = extractSurfaceTypes({
				meta: { route: { surfaceTypes: ['road', 'road', 'bike_lanes'] } },
			})
			expect(surfaces).toEqual(['road', 'bike_lanes'])
		})
	})

	describe('extractDifficulty / formatDifficulty', () => {
		it('normalizes difficulty', () => {
			expect(formatDifficulty(extractDifficulty({ difficulty: 'medium' }))).toBe('Средний')
			expect(formatDifficulty('custom')).toBe('custom')
		})
	})

	describe('normalizeCoordinates', () => {
		it('decodes polyline string', () => {
			const poly = '_p~iF~ps|U_ulLnnqC_mqNvxq`@' // 3 points
			const coords = normalizeCoordinates({ path: poly })
			expect(coords.length).toBe(3)
			expect(coords[0].lat).toBeCloseTo(3.85, 2)
			expect(coords[0].lng).toBeCloseTo(-12.02, 2)
		})

		it('normalizes array of points', () => {
			const coords = normalizeCoordinates({ pathCoordinates: [[1, 2], [3, 4]] })
			expect(coords).toEqual([
				{ lat: 1, lng: 2 },
				{ lat: 3, lng: 4 },
			])
		})
	})

	describe('computeRouteDistanceKmValue/Text', () => {
		it('returns null/placeholder for empty data', () => {
			expect(computeRouteDistanceKmValue({})).toBeNull()
			expect(computeRouteDistanceText({})).toBe('—')
		})

		it('uses provided distanceKm', () => {
			expect(computeRouteDistanceKmValue({ distanceKm: 12.34 })).toBe(12.34)
		})
	})

	describe('extractDescription', () => {
		it('finds first desc-like string', () => {
			const data = { meta: { description: 'test', other: { descText: 'fallback' } } }
			expect(extractDescription(data)).toBe('test')
		})

		it('returns empty string if nothing found', () => {
			expect(extractDescription({})).toBe('')
		})
	})
})
