import {
	Box,
	Button,
	Card,
	CardBody,
	Flex,
	FormControl,
	FormLabel,
	Heading,
	Input,
	InputGroup,
	InputRightElement,
	Stack,
	Text,
	VStack,
	useToast,
} from '@chakra-ui/react'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ApiError, loginUser, registerUser } from '../services/authService'
import { searchCityCoordinates } from '../services/geocodeService'
import { getKnownUser, saveKnownUser } from '../services/localAuthStore'

const normalizeAuthUser = data => {
	if (!data) return null

	const userData = data.user || data
	const normalized = {
		id:
			userData.userId ??
			userData.id ??
			(Number.isFinite(userData) ? Number(userData) : null),
		email: userData.email || null,
		username: userData.username || null,
		avatarUrl: userData.avatarUrl || null,
		createdAt: userData.createdAt || null,
	}

	return normalized.id ? normalized : null
}

const extractToken = data => data?.token || data?.accessToken || null

const initialRegisterForm = {
	userId: '',
	email: '',
	password: '',
	confirmPassword: '',
	username: '',
	city: '',
}

const initialLoginForm = {
	email: '',
	password: '',
}

const CITY_LOOKUP_MIN_CHARS = 3
const CITY_LOOKUP_DEBOUNCE = 400

const AuthPage = ({
	onAuthSuccess,
	defaultMode = 'login',
	footer = null,
	onGuestAccess = null,
}) => {
	const toast = useToast()
	const [mode, setMode] = useState(defaultMode)
	const [registerForm, setRegisterForm] = useState(initialRegisterForm)
	const [loginForm, setLoginForm] = useState(initialLoginForm)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState(null)
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [cityLookupStatus, setCityLookupStatus] = useState({
		loading: false,
		error: null,
	})
	const [citySuggestions, setCitySuggestions] = useState([])
	const [cityQuery, setCityQuery] = useState('')
	const cityLookupTimeout = useRef(null)

	const isRegisterMode = mode === 'register'

	const modeTitle = useMemo(
		() => (isRegisterMode ? 'Регистрация' : 'Вход'),
		[isRegisterMode]
	)

	const handleModeChange = newMode => {
		if (mode === newMode) return
		setMode(newMode)
		setError(null)
		setIsSubmitting(false)
	}

	const updateRegisterField = (field, value) => {
		setRegisterForm(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const updateLoginField = (field, value) => {
		setLoginForm(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const persistAuth = (data, passwordForCache = null, emailForCache = null) => {
		if (!onAuthSuccess) return
		const user = normalizeAuthUser(data)
		const token = extractToken(data)
		if (!user) {
			throw new Error('Некорректный ответ сервера')
		}

		if (passwordForCache && emailForCache) {
			saveKnownUser(emailForCache.trim().toLowerCase(), {
				user,
				token,
				password: passwordForCache,
			})
		}

		onAuthSuccess({ user, token })
	}

	const handleRegister = async () => {
		const userId = Number(registerForm.userId)
		if (!Number.isInteger(userId) || userId <= 0) {
			throw new Error('Укажите корректный числовой userId')
		}
		if ((registerForm.password || '').length < 8) {
			throw new Error('Пароль должен содержать минимум 8 символов')
		}
		if (registerForm.password !== registerForm.confirmPassword) {
			throw new Error('Пароли не совпадают')
		}

		const payload = {
			userId,
			email: registerForm.email.trim(),
			password: registerForm.password,
		}

		if (registerForm.username?.trim()) {
			payload.username = registerForm.username.trim()
		}
		if (registerForm.city?.trim()) {
			payload.city = registerForm.city.trim()
		}

		const data = await registerUser(payload)
		persistAuth(data, registerForm.password, registerForm.email)
		setRegisterForm(initialRegisterForm)
	}

	const handleLogin = async () => {
		const email = loginForm.email.trim().toLowerCase()
		const payload = {
			email,
			password: loginForm.password,
		}

		try {
			const data = await loginUser(payload)
			persistAuth(data, loginForm.password, loginForm.email)
			setLoginForm(initialLoginForm)
			return
		} catch (error) {
			if (!(error instanceof ApiError) || error.status !== 404) {
				throw error
			}
			const cachedUser = getKnownUser(email)
			if (!cachedUser) {
				throw new Error('Сервер авторизации недоступен, попробуйте позже')
			}
			if (cachedUser.password !== loginForm.password) {
				throw new Error('Неверный пароль (офлайн авторизация)')
			}
			saveKnownUser(email, cachedUser)
			onAuthSuccess({
				user: cachedUser.user,
				token: cachedUser.token || null,
			})
			toast({
				position: 'top-right',
				title: 'Офлайн вход',
				description:
					'Сервер авторизации недоступен, использованы сохранённые данные',
				status: 'warning',
				duration: 4000,
				isClosable: true,
			})
			setLoginForm(initialLoginForm)
		}
	}

	const handleSubmit = async event => {
		event.preventDefault()
		setError(null)
		setIsSubmitting(true)

		try {
			if (isRegisterMode) {
				await handleRegister()
			} else {
				await handleLogin()
			}

			toast({
				position: 'top-right',
				title: isRegisterMode ? 'Регистрация успешна' : 'Добро пожаловать',
				status: 'success',
				duration: 3000,
				isClosable: true,
			})

			// небольшая задержка, чтобы UI успел показать toast
			setTimeout(() => {
				if (!window.location.hash || window.location.hash === '#/auth') {
					window.location.replace('#/')
				}
			}, 100)
		} catch (err) {
			setError(err.message || 'Ошибка авторизации')
		} finally {
			setIsSubmitting(false)
		}
	}

	const renderPasswordInput = ({
		value,
		onChange,
		placeholder = 'Пароль',
		show,
		onToggle,
		name = 'password',
	}) => (
		<InputGroup size='md'>
			<Input
				type={show ? 'text' : 'password'}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				name={name}
				required
			/>
			<InputRightElement width='4.5rem'>
				<Button h='1.5rem' size='sm' onClick={onToggle}>
					{show ? 'Скрыть' : 'Показать'}
				</Button>
			</InputRightElement>
		</InputGroup>
	)

	const handleRegisterCityChange = value => {
		setCityLookupStatus(prev =>
			prev.error ? { ...prev, error: null } : prev
		)
		updateRegisterField('city', value)
		setCityQuery(value)
		const suggestion = citySuggestions.find(
			item => item.name.toLowerCase() === value.trim().toLowerCase()
		)
		if (suggestion) {
			updateRegisterField('city', suggestion.name)
			setCityQuery(suggestion.name)
		}
	}

	useEffect(() => {
		setCityQuery(registerForm.city || '')
	}, [registerForm.city])

	useEffect(() => {
		if (!isRegisterMode) {
			setCitySuggestions([])
			setCityLookupStatus({ loading: false, error: null })
			return
		}

		const normalized = cityQuery.trim()

		if (cityLookupTimeout.current) {
			clearTimeout(cityLookupTimeout.current)
		}

		if (!normalized || normalized.length < CITY_LOOKUP_MIN_CHARS) {
			setCitySuggestions([])
			setCityLookupStatus(prev => ({ ...prev, loading: false }))
			return
		}

		setCityLookupStatus(prev => ({ ...prev, loading: true, error: null }))

		let isMounted = true
		const timeoutId = setTimeout(async () => {
			try {
				const results = await searchCityCoordinates(normalized)
				if (!isMounted) return
				setCitySuggestions(results)
				setCityLookupStatus({ loading: false, error: null })
			} catch (lookupError) {
				if (!isMounted) return
				setCitySuggestions([])
				setCityLookupStatus({
					loading: false,
					error:
						lookupError?.message ||
						'Не удалось найти город, попробуйте уточнить запрос',
				})
			}
		}, CITY_LOOKUP_DEBOUNCE)

		cityLookupTimeout.current = timeoutId

		return () => {
			isMounted = false
			clearTimeout(timeoutId)
		}
	}, [cityQuery, isRegisterMode])

	return (
		<Flex
			minH='100vh'
			align='center'
			justify='center'
			bg='gray.50'
			px={4}
			py={8}
		>
			<VStack spacing={6} align='stretch' w='100%' maxW='460px'>
				<Card w='100%' boxShadow='lg'>
					<CardBody>
						<VStack spacing={4} align='stretch'>
							<Heading textAlign='center' size='md'>
								{modeTitle}
							</Heading>
							<Stack direction='row' spacing={3} justify='center'>
								<Button
									variant={isRegisterMode ? 'ghost' : 'solid'}
									colorScheme='blue'
									onClick={() => handleModeChange('login')}
									size='sm'
								>
									Вход
								</Button>
								<Button
									variant={isRegisterMode ? 'solid' : 'ghost'}
									colorScheme='purple'
									onClick={() => handleModeChange('register')}
									size='sm'
								>
									Регистрация
								</Button>
							</Stack>
							<Box as='form' onSubmit={handleSubmit}>
								<VStack spacing={3} align='stretch'>
									<FormControl isRequired>
										<FormLabel fontSize='sm'>E-mail</FormLabel>
										<Input
											type='email'
											value={
												isRegisterMode ? registerForm.email : loginForm.email
											}
											onChange={e =>
												isRegisterMode
													? updateRegisterField('email', e.target.value)
													: updateLoginField('email', e.target.value)
											}
											placeholder='you@example.com'
										/>
									</FormControl>
									<FormControl isRequired>
										<FormLabel fontSize='sm'>Пароль</FormLabel>
										{renderPasswordInput({
											value: isRegisterMode
												? registerForm.password
												: loginForm.password,
											onChange: e =>
												isRegisterMode
													? updateRegisterField('password', e.target.value)
													: updateLoginField('password', e.target.value),
											show: showPassword,
											onToggle: () => setShowPassword(prev => !prev),
										})}
									</FormControl>

									{isRegisterMode && (
										<>
											<FormControl isRequired>
												<FormLabel fontSize='sm'>
													Повторите пароль
												</FormLabel>
												{renderPasswordInput({
													value: registerForm.confirmPassword,
													onChange: e =>
														updateRegisterField(
															'confirmPassword',
															e.target.value
														),
													placeholder: 'Подтверждение',
													show: showConfirmPassword,
													onToggle: () =>
														setShowConfirmPassword(prev => !prev),
													name: 'confirmPassword',
												})}
											</FormControl>
											<FormControl isRequired>
												<FormLabel fontSize='sm'>User ID</FormLabel>
												<Input
													type='number'
													placeholder='Например, 200885469'
													value={registerForm.userId}
													onChange={e =>
														updateRegisterField('userId', e.target.value)
													}
												/>
											</FormControl>
											<FormControl>
												<FormLabel fontSize='sm'>Имя</FormLabel>
												<Input
													value={registerForm.username}
													onChange={e =>
														updateRegisterField('username', e.target.value)
													}
													placeholder='Ваш ник или имя'
												/>
											</FormControl>
											<FormControl>
												<FormLabel fontSize='sm'>Город</FormLabel>
												<VStack spacing={1} align='stretch'>
													<Input
														value={registerForm.city}
														onChange={e =>
															handleRegisterCityChange(e.target.value)
														}
														placeholder='Начните вводить название города'
														list='register-city-suggestions'
														autoComplete='off'
													/>
													{cityLookupStatus.loading && (
														<Text fontSize='xs' color='gray.500'>
															Ищем города...
														</Text>
													)}
													{cityLookupStatus.error && (
														<Text fontSize='xs' color='red.500'>
															{cityLookupStatus.error}
														</Text>
													)}
												</VStack>
												<datalist id='register-city-suggestions'>
													{citySuggestions.map(suggestion => (
														<option
															key={`${suggestion.name}-${suggestion.lat}-${suggestion.lng}`}
															value={suggestion.name}
														/>
													))}
												</datalist>
											</FormControl>
										</>
									)}
									{error && (
										<Text color='red.500' fontSize='sm'>
											{error}
										</Text>
									)}
									<Button
										type='submit'
										colorScheme='blue'
										isLoading={isSubmitting}
										width='100%'
									>
										{modeTitle}
									</Button>
								</VStack>
							</Box>
							{typeof onGuestAccess === 'function' && (
								<Button
									type='button'
									variant='ghost'
									colorScheme='gray'
									onClick={onGuestAccess}
									mt={2}
								>
									Продолжить как гость
								</Button>
							)}
						</VStack>
					</CardBody>
				</Card>
				{footer}
			</VStack>
		</Flex>
	)
}

export default AuthPage
