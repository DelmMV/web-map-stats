import React, { Suspense, lazy } from 'react'
import {
	Box,
	Drawer,
	DrawerBody,
	DrawerCloseButton,
	DrawerContent,
	DrawerOverlay,
} from '@chakra-ui/react'

const DrawerMenu = lazy(() => import('./DrawerMenu'))

const DrawerMenuContainer = ({
        isDesktop,
        sidebarPosition,
        onSidebarPointerDown,
        drawerIsOpen,
        onDrawerClose,
        menuProps,
}) => {
        const stopPropagation = event => {
                event.stopPropagation()
        }

        if (isDesktop) {
                return (
                        <Box
                                position='fixed'
                                style={{ top: `${sidebarPosition.top}px`, right: `${sidebarPosition.right}px` }}
                                width='320px'
                                maxHeight='calc(100vh - 90px)'
                                overflowY='auto'
                                zIndex={1300}
                                pointerEvents='auto'
                                bg='rgba(255,255,255,0.95)'
                                borderRadius='lg'
                                borderWidth='1px'
                                borderColor='gray.200'
                                boxShadow='lg'
                                p={4}
                                onPointerDown={stopPropagation}
                                onClick={stopPropagation}
                                onWheel={stopPropagation}
                        >
                                {/* Отдельная зона для перетаскивания, чтобы не блокировать клики внутри */}
                                <Box
                                        position='absolute'
                                        top={0}
					left={0}
					right={0}
					height='14px'
					borderTopRadius='lg'
					cursor='grab'
					onPointerDown={onSidebarPointerDown}
				/>
				<Box data-no-drag>
					<Suspense fallback={<div>Loading...</div>}>
						<DrawerMenu {...menuProps} />
					</Suspense>
				</Box>
			</Box>
		)
	}

	return (
		<Drawer isOpen={drawerIsOpen} placement='right' onClose={onDrawerClose}>
			<DrawerOverlay>
				<DrawerContent
					borderBottomWidth={2}
					borderBottomRadius={6}
					borderBottomColor='black'
					bg='rgba(255, 255, 255, 0.8)'
					backdropFilter='blur(10px)'
				>
					<DrawerCloseButton />
					<DrawerBody pt={10} pr={4} pl={4}>
						<Suspense fallback={<div>Loading...</div>}>
							<DrawerMenu {...menuProps} />
						</Suspense>
					</DrawerBody>
				</DrawerContent>
			</DrawerOverlay>
		</Drawer>
	)
}

export default DrawerMenuContainer
