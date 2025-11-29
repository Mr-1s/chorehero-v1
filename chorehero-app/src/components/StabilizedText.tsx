import React from 'react';
import { Text, TextProps } from 'react-native';
import { useDeviceStabilization, responsiveFontSize } from '../utils/deviceStabilization';

interface StabilizedTextProps extends TextProps {
  fontSize?: number;
  preventScaling?: boolean;
}

export const StabilizedText: React.FC<StabilizedTextProps> = ({ 
  fontSize = 14, 
  preventScaling = true,
  style,
  ...props 
}) => {
  const device = useDeviceStabilization();
  
  const stabilizedStyle = {
    fontSize: responsiveFontSize(fontSize, device),
    allowFontScaling: !preventScaling,
    includeFontPadding: false, // Android: remove extra padding
    textAlignVertical: 'center' as const, // Android: center vertically
    ...(Array.isArray(style) ? Object.assign({}, ...style) : style),
  };

  return <Text {...props} style={stabilizedStyle} />;
};

export default StabilizedText;


