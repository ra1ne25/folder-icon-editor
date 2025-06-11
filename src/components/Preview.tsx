import React from 'react';
import { Box, Image, Text, VStack } from '@chakra-ui/react';

interface PreviewProps {
  previews: string[];
}

export const Preview: React.FC<PreviewProps> = ({ previews }) => {
  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Text fontSize="lg" mb={4}>Предпросмотр</Text>
      <VStack spacing={4} align="center">
        {previews.map((preview, index) => (
          <Box key={index} p={2} borderWidth="1px" borderRadius="md">
            <Image src={preview} alt={`Preview ${index + 1}`} maxW="200px" />
          </Box>
        ))}
      </VStack>
    </Box>
  );
}; 