export const MANUAL_ROUTE_PROFILES = [
	{
		value: 'cycling',
		label: 'Электро',
		baseUrl: 'https://routing.openstreetmap.de/routed-bike',
		apiProfile: 'bike',
	},
	{
		value: 'driving',
		label: 'Авто',
		baseUrl: 'https://routing.openstreetmap.de/routed-car',
		apiProfile: 'driving',
	},
	{
		value: 'walking',
		label: 'Пешком',
		baseUrl: 'https://routing.openstreetmap.de/routed-foot',
		apiProfile: 'foot',
	},
]

export const DEFAULT_MANUAL_ROUTE_COLOR = '#ff6b6b'

export const getManualRouteProfileConfig = value =>
	MANUAL_ROUTE_PROFILES.find(profile => profile.value === value) ||
	MANUAL_ROUTE_PROFILES[0]
