export const formatRouteDate = timestamp => {
	if (!timestamp) return 'Дата неизвестна'
	return new Date(timestamp).toLocaleDateString('ru-RU', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	})
}

export const resolveRouteAuthor = (
	route,
	{ currentUserId = null, currentUserName = '' } = {}
) => {
	if (!route) return ''
	const normalizeValue = value => {
		if (!value) return ''
		if (typeof value === 'string') return value
		if (typeof value === 'object') {
			return (
				value.name ||
				value.username ||
				value.userName ||
				value.displayName ||
				value.fullName ||
				''
			)
		}
		return ''
	}

	const candidateKeys = [
		'authorName',
		'author',
		'ownerName',
		'createdBy',
		'username',
		'userName',
		'user',
		'displayName',
		'fullName',
	]

	const sources = [
		route,
		route.route,
		route.meta,
		route.meta?.route,
		route.route?.meta,
		route.meta?.route?.meta,
		route.route?.meta?.route,
	]

	const pickFromSource = source => {
		if (!source) return ''
		for (const key of candidateKeys) {
			if (key in source) {
				const normalized = normalizeValue(source[key])
				if (normalized) return normalized
			}
		}
		return ''
	}

	for (const source of sources) {
		const direct = pickFromSource(source)
		if (direct) return direct
	}

	const deepSearch = (value, depth = 0) => {
		if (!value || typeof value !== 'object' || depth > 2) return ''
		for (const [key, nested] of Object.entries(value)) {
			if (
				typeof nested === 'string' &&
				(key.toLowerCase().includes('author') ||
					key.toLowerCase().includes('owner') ||
					key.toLowerCase().includes('user'))
			) {
				return nested
			}
			if (typeof nested === 'object') {
				const candidate = pickFromSource(nested)
				if (candidate) return candidate
				const deeper = deepSearch(nested, depth + 1)
				if (deeper) return deeper
			}
		}
		return ''
	}

	for (const source of sources) {
		const nested = deepSearch(source)
		if (nested) return nested
	}

	const resolveAuthorId = obj => {
		const id = obj?.authorId
		if (id === undefined || id === null) return null
		if (
			currentUserId !== null &&
			String(id) === String(currentUserId) &&
			currentUserName
		) {
			return currentUserName
		}
		return `ID ${id}`
	}

	for (const source of sources) {
		const resolvedId = resolveAuthorId(source)
		if (resolvedId) return resolvedId
	}

	const findAuthorId = (value, depth = 0) => {
		if (!value || typeof value !== 'object' || depth > 2) return null
		if (value.authorId !== undefined && value.authorId !== null) {
			return value.authorId
		}
		for (const nested of Object.values(value)) {
			if (typeof nested === 'object') {
				const found = findAuthorId(nested, depth + 1)
				if (found !== null && found !== undefined) return found
			}
		}
		return null
	}

	const deepAuthorId = findAuthorId(route)
	if (deepAuthorId !== null && deepAuthorId !== undefined) {
		return resolveAuthorId({ authorId: deepAuthorId })
	}

	return ''
}
