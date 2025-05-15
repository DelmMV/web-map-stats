import {
	Box,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Text,
	VStack,
} from '@chakra-ui/react'
import React, { memo } from 'react'

const WorkshopModal = ({ isOpen, onClose, workshop }) => {
	if (!workshop) return null

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			size='md'
			motionPreset='slideInBottom'
			blockScrollOnMount={false}
			isCentered
		>
			<ModalOverlay backdropFilter='blur(2px)' />
			<ModalContent>
				<ModalHeader>Мастерская: {workshop.name}</ModalHeader>
				<ModalCloseButton />
				<ModalBody>
					<VStack align='stretch' spacing={2} mb={2}>
						<Box>
							<Text fontSize='sm' fontWeight='bold'>
								Адрес:
							</Text>
							<Text fontSize='sm'>{workshop.address}</Text>
						</Box>
						<Box>
							<Text fontSize='sm' fontWeight='bold'>
								Описание:
							</Text>
							<Text fontSize='sm'>{workshop.description}</Text>
						</Box>
					</VStack>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default memo(WorkshopModal)
