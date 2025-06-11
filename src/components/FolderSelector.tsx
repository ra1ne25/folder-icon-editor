import React from 'react';
import { Box, Button, Text } from '@chakra-ui/react';
import '../types/electron.d.ts';

interface FolderSelectorProps {
  selectedFolder: string | null;
  onFolderSelect: (folder: string | null) => void;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({ selectedFolder, onFolderSelect }) => {
  const handleSelectFolder = async () => {
    try {
      const folder = await window.electron.selectFolder();
      onFolderSelect(folder);
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Text fontSize="lg" mb={2}>Выберите папку</Text>
      <Button colorScheme="blue" onClick={handleSelectFolder}>
        {selectedFolder ? 'Изменить папку' : 'Выбрать папку'}
      </Button>
      {selectedFolder && (
        <Text mt={2} fontSize="sm" color="gray.600">
          Выбрана папка: {selectedFolder}
        </Text>
      )}
    </Box>
  );
}; 