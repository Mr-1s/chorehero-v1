import React from 'react';
import type { StackNavigationProp } from '@react-navigation/stack';
import VideoUploadScreen from './VideoUploadScreen';

type CameraViewProps = {
  navigation: StackNavigationProp<any>;
  route: any;
};

const CameraView: React.FC<CameraViewProps> = (props) => {
  return <VideoUploadScreen {...props} />;
};

export default CameraView;
