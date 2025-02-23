import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
} from '@chakra-ui/react';

const WorkshopModal = ({ isOpen, onClose, workshop }) => {
  if (!workshop) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Мастерская: {workshop.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={0}>
            <Text fontSize="sm"><strong>Адрес:</strong> {workshop.address}</Text>
            <Text fontSize="sm"><strong>Описание:</strong> {workshop.description}</Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default WorkshopModal;