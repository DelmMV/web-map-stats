import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  Image,
  Divider,
  IconButton,
  Spinner,
  Box,
  HStack,
  useToast,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { format } from 'date-fns';
import { FaThumbsUp, FaThumbsDown, FaRoute } from 'react-icons/fa';

// Предполагается, что URL API задан в переменных окружения
const API_URL = 'https://api.monopiter.ru';

function StationModal({ isOpen, onClose, station, onEdit, onDelete, isAdmin, userId }) {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isFullImageOpen, setIsFullImageOpen] = useState(false);
  const [likeStatus, setLikeStatus] = useState({ liked: false, disliked: false, likes: 0, dislikes: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const fetchLikeStatus = useCallback(async () => {
    if (!station || !userId) return;

    try {
      const response = await fetch(`${API_URL}/api/charging-stations/${station._id}/like-status/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch like status');
      const status = await response.json();
      setLikeStatus(status);
    } catch (error) {
      toast({
        title: "Ошибка при загрузке статуса лайков",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [station, userId, toast]);

  useEffect(() => {
    if (isOpen && station && userId) {
      fetchLikeStatus();
    }
  }, [isOpen, station, userId, fetchLikeStatus]);

  const handleLikeAction = async (action) => {
    if (!station || !userId) return;
  
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/charging-stations/${station._id}/${action}/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      await fetchLikeStatus();
      toast({
        title: action === 'like' ? "Лайк обновлен" : "Дизлайк обновлен",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Error ${action}ing station:`, error);
      toast({
        title: `Ошибка при ${action === 'like' ? 'лайке' : 'дизлайке'} станции`,
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRouteClick = useCallback(() => {
    if (station && station.latitude && station.longitude) {
      const { latitude, longitude } = station;
      
      // Универсальный URL для Яндекс Карт
      const mapUrl = `https://yandex.ru/maps/?rtext=~${latitude},${longitude}&rtt=bc`;

      // Открываем URL в новом окне/вкладке
      window.open(mapUrl, '_blank');

      // Показываем уведомление пользователю
      toast({
        position: "top-right",
        title: "Маршрут построен",
        description: "Яндекс Карта откроется в новом окне",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } else {
      toast({
        position: "top-right",
        title: "Ошибка",
        description: "Не удалось получить координаты станции",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [station, toast]);

  const getMarkerTypeTitle = useCallback((markerType) => {
    switch (markerType) {
      case 'charging':
        return 'Место зарядки';
      case 'chargingAuto':
        return 'Автомобильная зарядка';
      case 'interesting':
        return 'Интересное место';
      case 'danger':
        return 'Опасное место';
      case 'chat':
        return 'Разговорчики';
      default:
        return 'Место зарядки';
    }
  }, []);
  
  const openFullImage = useCallback(() => setIsFullImageOpen(true), []);
  const closeFullImage = useCallback(() => setIsFullImageOpen(false), []);

  if (!station) return null;
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent overflow="auto" margin={2}>
          <ModalHeader p={2}>{getMarkerTypeTitle(station.markerType)}</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={2}>
            <VStack align="stretch" spacing={1}>
              {station.photo && (
                <Box position="relative " width="100%" height="300px" cursor="pointer" onClick={openFullImage}>
                  {isImageLoading && (
                    <Box
                      position="absolute"
                      top="0"
                      left="0"
                      right="0"
                      bottom="0"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Spinner size="xl" />
                    </Box>
                  )}
                  <Image
                    src={station.photo}
                    alt="Station"
                    objectFit="cover"
                    width="100%"
                    height="100%"
                    borderRadius="md"
                    onLoad={() => setIsImageLoading(false)}
                    style={{ display: isImageLoading ? 'none' : 'block' }}
                  />
                </Box>
              )}
              {station.comment && (
                <Text>{station.comment}</Text>
              )}
              <VStack align="start" spacing={1}>
                <Text fontSize="sm">
                  Добавил: {station.addedBy.username || station.addedBy.name}
                </Text>
                <Text fontSize="sm">
                  {format(new Date(station.addedAt), 'dd.MM.yyyy HH:mm')}
                </Text>
              </VStack>
            </VStack>
          </ModalBody>
          <Divider />
          <ModalFooter p={2} display="flex" justifyContent="space-between" width="100%">
            <HStack>
              <IconButton
                icon={<FaThumbsUp color={likeStatus.liked ? "green" : "gray"} />}
                aria-label={likeStatus.liked ? "Убрать лайк" : "Лайкнуть станцию"}
                onClick={() => handleLikeAction('like')}
                isLoading={isLoading}
              />
              <Text>{likeStatus.likes}</Text>
              <IconButton
                icon={<FaThumbsDown color={likeStatus.disliked ? "red" : "gray"} />}
                aria-label={likeStatus.disliked ? "Убрать дизлайк" : "Дизлайкнуть станцию"}
                onClick={() => handleLikeAction('dislike')}
                isLoading={isLoading}
              />
              <Text>{likeStatus.dislikes}</Text>
              <Divider orientation='horizontal' />
                <IconButton
                  icon={<FaRoute />}
                  onClick={handleRouteClick}
                  colorScheme="blue"
                  />
            </HStack>
            <HStack>
              <IconButton
                icon={<EditIcon />}
                aria-label="Edit station"
                onClick={() => onEdit(station)}
              />
              {isAdmin && (
                <IconButton
                  icon={<DeleteIcon />}
                  aria-label="Delete station"
                  colorScheme="red"
                  onClick={() => onDelete(station._id)}
                />
              )}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      <Modal isOpen={isFullImageOpen} onClose={closeFullImage} size="full">
        <ModalOverlay />
        <ModalContent background="rgba(0, 0, 0, 0.8)">
          <ModalCloseButton color="white" />
          <ModalBody display="flex" justifyContent="center" alignItems="center" height="100vh">
            <Image
              src={station.photo}
              alt="Full size station"
              maxH="90vh"
              maxW="90vw"
              objectFit="contain"
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

export default StationModal;
