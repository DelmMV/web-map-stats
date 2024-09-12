import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  HStack,
  Checkbox,
  Text,
  Box,
  Select,
} from '@chakra-ui/react';

const EditStationModal = ({ isOpen, onClose, onUpdate, station }) => {
  const [is24Hours, setIs24Hours] = useState(station?.is24Hours || false);
  const [stationComment, setStationComment] = useState(station?.comment || '');
  const [stationPhoto, setStationPhoto] = useState(null);
  const [markerType, setMarkerType] = useState(station?.markerType || 'charging');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (station) {
      setIs24Hours(station.is24Hours || false);
      setStationComment(station.comment || '');
      setMarkerType(station.markerType || 'charging');
      setStationPhoto(null); // Reset photo when station changes
    }
  }, [station]);

  const handleUpdate = async () => {
    if (isUpdating) return; // Prevent multiple clicks

    setIsUpdating(true);
    try {
      await onUpdate({
        is24Hours,
        comment: stationComment,
        photo: stationPhoto,
        markerType,
      });
      onClose();
    } catch (error) {
      console.error("Error updating station:", error);
      // Handle error (e.g., show error message to user)
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Редактировать место</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            
            <FormControl>
              <FormLabel>Тип метки</FormLabel>
            <HStack>
              <Select value={markerType} onChange={(e) => setMarkerType(e.target.value)}>
                <option value="charging">Обычная розетка</option>
                <option value="chargingAuto">Автомобильная зарядка</option>
                <option value="danger">Опасное место</option>
                <option value="chat">Разговорчики</option>
              </Select>
                {markerType === 'charging' && (
                    <Checkbox
                      isChecked={is24Hours}
                      onChange={(e) => setIs24Hours(e.target.checked)}
                    >
                      Ночная
                    </Checkbox>
                )}
              </HStack>

            </FormControl>
            <FormControl>
              <FormLabel>Комментарий</FormLabel>
              <Textarea
                value={stationComment}
                onChange={(e) => setStationComment(e.target.value)}
                placeholder="Опишите место"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Фото</FormLabel>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setStationPhoto(e.target.files[0])}
              />
            </FormControl>
            {station && station.photo && (
              <Box>
                <Text>Текущее фото:</Text>
                <img src={station.photo} alt="Current" style={{ maxWidth: '100px', maxHeight: '100px' }} />
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button 
            colorScheme="blue" 
            mr={3} 
            onClick={handleUpdate}
            isLoading={isUpdating}
            loadingText="Обновление..."
            disabled={isUpdating}
          >
            Обновить
          </Button>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditStationModal;