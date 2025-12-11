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
  Button,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, CloseIcon, CheckIcon } from '@chakra-ui/icons';
import { format } from 'date-fns';
import { FaThumbsUp, FaThumbsDown, FaRoute } from 'react-icons/fa';
import { API_CONFIG } from '../utils/config';
import { updateChargingStationStatus } from '../services/chargingStationService';
import {
  baseButtonStyles,
  baseIconButtonStyles,
  subtleButtonStyles,
  subtleIconButtonStyles,
} from '../styles/buttonStyles';

const API_BASE_URL = API_CONFIG.BASE_URL;
const toBoolean = value =>
	value === true || value === 'true' || value === 1 || value === '1';

function StationModal({ isOpen, onClose, station, onEdit, onDelete, isAdmin, userId, onStatusChange }) {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isFullImageOpen, setIsFullImageOpen] = useState(false);
  const [likeStatus, setLikeStatus] = useState({ liked: false, disliked: false, likes: 0, dislikes: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(station?.isOffline || false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const toast = useToast();
  const canToggleOffline = ['charging', 'chargingAuto'].includes(station?.markerType);

  const fetchLikeStatus = useCallback(async () => {
    const stationId = station?._id ?? station?.id;
    if (!stationId || !userId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/charging-stations/${stationId}/like-status/${userId}`);
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

  useEffect(() => {
    if (!station) return;
    setIsOffline(toBoolean(station.isOffline));
  }, [station]);

  const handleLikeAction = async (action) => {
    const stationId = station?._id ?? station?.id;
    if (!stationId || !userId) return;
  
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/charging-stations/${stationId}/${action}/${userId}`, {
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

  const handleToggleOffline = async () => {
    const stationId = station?._id ?? station?.id;
    if (!stationId || !userId || isStatusUpdating) return;
    const nextStatus = !isOffline;
    setIsOffline(nextStatus); // immediate UI feedback
    setIsStatusUpdating(true);
    try {
      const updatedStation = await updateChargingStationStatus(
        station,
        nextStatus,
        userId
      );
      const normalizedStatus =
        typeof updatedStation.isOffline !== 'undefined'
          ? toBoolean(updatedStation.isOffline)
          : nextStatus;
      setIsOffline(normalizedStatus);
      toast({
        title: normalizedStatus ? 'Станция офлайн' : 'Станция активна',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      const updatedStationId =
        updatedStation?._id ?? updatedStation?.id ?? stationId;
      onStatusChange?.(updatedStationId, {
        ...station,
        ...updatedStation,
        _id: updatedStationId,
        isOffline: normalizedStatus,
      });
    } catch (error) {
      console.error('Error updating station status:', error);
      setIsOffline(prev => !prev); // rollback on error
      toast({
        title: 'Ошибка при обновлении статуса станции',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsStatusUpdating(false);
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
  const openConfirmModal = useCallback(() => {
    if (canToggleOffline && !isStatusUpdating) {
      setIsConfirmOpen(true);
    }
  }, [canToggleOffline, isStatusUpdating]);
  const closeConfirmModal = useCallback(() => {
    if (!isStatusUpdating) {
      setIsConfirmOpen(false);
    }
  }, [isStatusUpdating]);
  const handleConfirmToggle = useCallback(async () => {
    await handleToggleOffline();
    setIsConfirmOpen(false);
  }, [handleToggleOffline]);

  if (!station) return null;
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent overflow="auto" margin={2} borderRadius="20px" boxShadow="0 14px 34px rgba(0,0,0,0.24)" px={3} py={2}>
          <ModalHeader p={3}>{getMarkerTypeTitle(station.markerType)}</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={3}>
            <VStack align="stretch" spacing={2}>
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
                  Добавил:{' '}
                  {station.addedBy?.username ||
                    station.addedBy?.name ||
                    'Неизвестно'}
                </Text>
                {station.addedAt && (
                  <Text fontSize="sm">
                    {format(new Date(station.addedAt), 'dd.MM.yyyy HH:mm')}
                  </Text>
                )}
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
                sx={subtleIconButtonStyles}
              />
              <Text>{likeStatus.likes}</Text>
              <IconButton
                icon={<FaThumbsDown color={likeStatus.disliked ? "red" : "gray"} />}
                aria-label={likeStatus.disliked ? "Убрать дизлайк" : "Дизлайкнуть станцию"}
                onClick={() => handleLikeAction('dislike')}
                isLoading={isLoading}
                sx={subtleIconButtonStyles}
              />
              <Text>{likeStatus.dislikes}</Text>
              <Divider orientation='horizontal' />
                <IconButton
                  icon={<FaRoute />}
                  onClick={handleRouteClick}
                  colorScheme="blue"
                  sx={baseIconButtonStyles}
                  />
              {canToggleOffline && (
                <IconButton
                  size="md"
                  icon={isOffline ? <CheckIcon /> : <CloseIcon />}
                  aria-label={isOffline ? 'Включить станцию' : 'Выключить станцию'}
                  onClick={openConfirmModal}
                  isLoading={isStatusUpdating}
                  bg={isOffline ? 'blue.500' : 'red.500'}
                  _hover={{ bg: isOffline ? 'blue.600' : 'red.600' }}
                  color='white'
                  sx={baseIconButtonStyles}
                />
              )}
            </HStack>
            <HStack>
              <IconButton
                icon={<EditIcon />}
                aria-label="Edit station"
                onClick={() => onEdit(station)}
                sx={subtleIconButtonStyles}
              />
              {isAdmin && (
                <IconButton
                  icon={<DeleteIcon />}
                  aria-label="Delete station"
                  colorScheme="red"
                  onClick={() => onDelete(station._id)}
                  sx={subtleIconButtonStyles}
                />
              )}
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      <Modal isOpen={isFullImageOpen} onClose={closeFullImage} size="full">
        <ModalOverlay />
        <ModalContent background="rgba(0, 0, 0, 0.8)" borderRadius="12px" p={3}>
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
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={closeFullImage} sx={baseButtonStyles}>
              Закрыть
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={isConfirmOpen} onClose={closeConfirmModal} isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="16px" px={3} py={2}>
          <ModalHeader>
            {isOffline ? 'Включить станцию?' : 'Отключить станцию?'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              {isOffline
                ? 'Станция будет отмечена как активная. Продолжить?'
                : 'Станция будет помечена как офлайн. Продолжить?'}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={closeConfirmModal} isDisabled={isStatusUpdating} sx={subtleButtonStyles}>
              Нет
            </Button>
            <Button
              colorScheme={isOffline ? 'green' : 'red'}
              onClick={handleConfirmToggle}
              isLoading={isStatusUpdating}
              sx={baseButtonStyles}
            >
              Да
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default StationModal;
