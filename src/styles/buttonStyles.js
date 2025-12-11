const baseShape = {
	borderRadius: '12px',
	fontWeight: 600,
	letterSpacing: '-0.01em',
}

export const motionButtonProps = {
	whileHover: { scale: 1.03, y: -1 },
	whileTap: { scale: 0.96 },
	transition: { duration: 0.12, ease: 'easeOut' },
}

export const baseButtonStyles = {
	...baseShape,
	boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
	transition: 'transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease',
	_hover: { transform: 'translateY(-1px)', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' },
	_active: { transform: 'translateY(0)', boxShadow: '0 5px 14px rgba(0,0,0,0.12)' },
	_focusVisible: { boxShadow: '0 0 0 3px rgba(99,102,241,0.35)' },
}

export const subtleButtonStyles = {
	...baseShape,
	boxShadow: 'none',
	transition: 'transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease',
	_hover: { transform: 'translateY(-1px)', bg: 'gray.50' },
	_active: { transform: 'translateY(0)', bg: 'gray.100' },
	_focusVisible: { boxShadow: '0 0 0 3px rgba(99,102,241,0.35)' },
}

export const baseIconButtonStyles = {
	...baseShape,
	borderRadius: '12px',
	borderWidth: 2,
	borderColor: 'gray.200',
	boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
	transition: 'transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease',
	_hover: { transform: 'translateY(-1px)', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' },
	_active: { transform: 'translateY(0)', boxShadow: '0 5px 14px rgba(0,0,0,0.12)' },
	_focusVisible: { boxShadow: '0 0 0 3px rgba(99,102,241,0.35)' },
}

export const subtleIconButtonStyles = {
	...baseIconButtonStyles,
	boxShadow: 'none',
	borderWidth: 1,
	borderColor: 'gray.200',
	_hover: { ...baseIconButtonStyles._hover, boxShadow: '0 10px 22px rgba(0,0,0,0.1)' },
}
