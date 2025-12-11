const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search'

const buildQueryParams = params =>
	new URLSearchParams({
		format: 'json',
		addressdetails: '1',
		limit: '5',
		language: 'ru',
		...params,
	})

const buildDisplayName = item => {
	const address = item.address || {}
	return (
		address.city ||
		address.town ||
		address.village ||
		address.settlement ||
		address.municipality ||
		address.county ||
		address.state ||
		address.region ||
		address.country ||
		item.display_name ||
		item.name
	)
}

export const searchCityCoordinates = async query => {
	if (!query || !query.trim()) {
		throw new Error('Укажите название города')
	}

	const url = `${NOMINATIM_BASE_URL}?${buildQueryParams({
		q: query.trim(),
	})}`

	const response = await fetch(url, {
		headers: {
			'Accept-Language': 'ru',
		},
	})

	if (!response.ok) {
		throw new Error('Не удалось получить координаты города')
	}

	const data = await response.json()

	if (!Array.isArray(data) || data.length === 0) {
		throw new Error('Город не найден. Попробуйте уточнить название.')
	}

	return data.map(item => {
		const shortName = buildDisplayName(item) || query.trim()
		return {
			name: shortName,
			fullName: item.display_name || shortName,
			lat: parseFloat(item.lat),
			lng: parseFloat(item.lon),
			address: item.address || {},
		}
	})
}
