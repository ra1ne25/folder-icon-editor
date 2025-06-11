import React from 'react';
import { Box, Button, Text } from '@chakra-ui/react';
import '../types/electron.d.ts';

interface IconSelectorProps {
  selectedIcon: string | null;
  onIconSelect: (icon: string | null) => void;
}

export const IconSelector: React.FC<IconSelectorProps> = ({ selectedIcon, onIconSelect }) => {
  const handleSelectIcon = async () => {
    try {
      const icon = await window.electron.selectIcon();
      onIconSelect(icon);
    } catch (error) {
      console.error('Error selecting icon:', error);
    }
  };

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Text fontSize="lg" mb={2}>Выберите иконку</Text>
      <Button colorScheme="blue" onClick={handleSelectIcon}>
        {selectedIcon ? 'Изменить иконку' : 'Выбрать иконку'}
      </Button>
      {selectedIcon && (
        <Text mt={2} fontSize="sm" color="gray.600">
          Выбрана иконка: {selectedIcon}
        </Text>
      )}
    </Box>
  );
}; 