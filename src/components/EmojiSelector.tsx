import React from 'react';
import { Box, Grid, Image, useToast } from '@chakra-ui/react';
import '../types/electron.d.ts';

interface EmojiSelectorProps {
  emojis: string[];
  selectedEmoji: number | null;
  onSelect: (index: number | null) => void;
}

export const EmojiSelector: React.FC<EmojiSelectorProps> = ({
  emojis,
  selectedEmoji,
  onSelect,
}) => {
  const toast = useToast();

  const handleEmojiClick = async (index: number) => {
    try {
      onSelect(index);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить эмодзи',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (!emojis || emojis.length === 0) {
    return null;
  }

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Grid templateColumns="repeat(4, 1fr)" gap={4}>
        {emojis.map((emoji, index) => (
          <Box
            key={index}
            p={2}
            borderWidth="1px"
            borderRadius="md"
            cursor="pointer"
            _hover={{ bg: 'gray.100' }}
            bg={selectedEmoji === index ? 'blue.50' : 'transparent'}
            onClick={() => handleEmojiClick(index)}
          >
            <Image src={emoji} alt={`Emoji ${index}`} />
          </Box>
        ))}
      </Grid>
    </Box>
  );
};