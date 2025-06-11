import React from 'react';
import { Box, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Text, VStack } from '@chakra-ui/react';

interface ColorAdjusterProps {
  hue: number;
  saturation: number;
  brightness: number;
  onHueChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onBrightnessChange: (value: number) => void;
}

export const ColorAdjuster: React.FC<ColorAdjusterProps> = ({
  hue,
  saturation,
  brightness,
  onHueChange,
  onSaturationChange,
  onBrightnessChange,
}) => {
  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Text fontSize="lg" mb={4}>Настройка цвета</Text>
      <VStack spacing={4} align="stretch">
        <Box>
          <Text mb={2}>Оттенок: {hue}°</Text>
          <Slider
            value={hue}
            onChange={onHueChange}
            min={0}
            max={360}
            step={1}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>

        <Box>
          <Text mb={2}>Насыщенность: {saturation}%</Text>
          <Slider
            value={saturation}
            onChange={onSaturationChange}
            min={0}
            max={200}
            step={1}
            defaultValue={100}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>

        <Box>
          <Text mb={2}>Яркость: {brightness}%</Text>
          <Slider
            value={brightness}
            onChange={onBrightnessChange}
            min={0}
            max={200}
            step={1}
            defaultValue={100}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>
      </VStack>
    </Box>
  );
}; 