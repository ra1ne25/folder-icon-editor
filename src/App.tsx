import React, { useState, useEffect } from 'react';
import { Box, Button, useToast } from '@chakra-ui/react';
import { FolderSelector } from './components/FolderSelector';
import { IconSelector } from './components/IconSelector';
import { ColorAdjuster } from './components/ColorAdjuster';
import { EmojiSelector } from './components/EmojiSelector';
import { Preview } from './components/Preview';
import { ChakraProvider, VStack, Heading } from '@chakra-ui/react';
import './types/electron.d.ts';

const App: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [selectedEmoji, setSelectedEmoji] = useState<number | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [modifiedImage, setModifiedImage] = useState<string | null>(null);
  const [emojis, setEmojis] = useState<string[]>([]);
  const toast = useToast();

  useEffect(() => {
    const loadEmojis = async () => {
      try {
        const loadedEmojis = await window.electron.loadEmojis();
        setEmojis(loadedEmojis);
      } catch (err) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить эмодзи',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };
    loadEmojis();
  }, [toast]);

  useEffect(() => {
    const updatePreviews = async () => {
      if (selectedIcon) {
        try {
          const previews = await window.electron.getPreviews(
            selectedIcon,
            selectedEmoji,
            hue,
            saturation,
            brightness
          );
          setOriginalImage(previews[0]);
          setModifiedImage(previews[1]);
        } catch (err) {
          toast({
            title: 'Ошибка',
            description: 'Не удалось обновить превью',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
    };
    updatePreviews();
  }, [selectedIcon, hue, saturation, brightness, selectedEmoji, toast]);

  const handleApplyIcon = async () => {
    if (!selectedFolder || !selectedIcon) return;

    try {
      await window.electron.applyIcon(
        selectedFolder,
        selectedIcon,
        selectedEmoji,
        hue,
        saturation,
        brightness
      );
      toast({
        title: 'Успех',
        description: 'Иконка успешно применена',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось применить иконку',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <ChakraProvider>
      <Box p={4}>
        <VStack spacing={4} align="stretch">
          <Heading size="lg">Редактор иконок папок</Heading>
          <FolderSelector
            selectedFolder={selectedFolder}
            onFolderSelect={setSelectedFolder}
          />
          <IconSelector
            selectedIcon={selectedIcon}
            onIconSelect={setSelectedIcon}
          />
          <ColorAdjuster
            hue={hue}
            saturation={saturation}
            brightness={brightness}
            onHueChange={setHue}
            onSaturationChange={setSaturation}
            onBrightnessChange={setBrightness}
          />
          <EmojiSelector
            emojis={emojis}
            selectedEmoji={selectedEmoji}
            onSelect={setSelectedEmoji}
          />
          <Preview
            previews={[originalImage, modifiedImage].filter(Boolean) as string[]}
          />
          <Box display="flex" justifyContent="center" mt={4}>
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleApplyIcon}
              isDisabled={!selectedFolder || !selectedIcon}
            >
              Применить иконку
            </Button>
          </Box>
        </VStack>
      </Box>
    </ChakraProvider>
  );
};

export default App; 