import React, { useState } from 'react';
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
  Select,
  Checkbox,
  Text,
} from '@chakra-ui/react';

const AddStationModal = ({ isOpen, onClose, onSave }) => {
  const [markerType, setMarkerType] = useState('charging');
  const [is24Hours, setIs24Hours] = useState(false);
  const [stationComment, setStationComment] = useState('');
  const [stationPhoto, setStationPhoto] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return; // Предотвращаем повторное нажатие

    setIsSaving(true);
    try {
      await onSave({
        markerType,
        is24Hours,
        comment: stationComment,
        photo: stationPhoto,
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error("Ошибка при сохранении:", error);
      // Здесь можно добавить обработку ошибки, например, показать уведомление пользователю
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setMarkerType('charging');
    setIs24Hours(false);
    setStationComment('');
    setStationPhoto(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); resetForm(); }}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Добавить новое место</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={1}>
            <FormControl>
              <FormLabel>Тип метки</FormLabel>
              <HStack>
                <Select value={markerType} onChange={(e) => setMarkerType(e.target.value)}>
                  <option value="charging">Обычная розетка</option>
                  <option value="chargingAuto">Автомобильная зарядка</option>
                  <option value="interesting">Интересное место</option>
                  <option value="danger">Опасное место</option>
                  <option value="chat">Разговорчики</option>
                </Select>
                {markerType === 'charging' && (
                  <Checkbox isChecked={is24Hours} onChange={(e) => setIs24Hours(e.target.checked)}>
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
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button 
            colorScheme="blue" 
            mr={1} 
            onClick={handleSave}
            isLoading={isSaving}
            loadingText="Добавление..."
            disabled={isSaving}
          >
            Добавить
          </Button>
          <Button variant="ghost" onClick={() => { onClose(); resetForm(); }}>Отмена</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddStationModal;