import { Platform } from 'react-native';
import { IOcrEngine } from './types';

let engineInstance: IOcrEngine;

if (Platform.OS === 'web') {
  const { ocrEngine: webEngine } = require('./ocrEngine.web');
  engineInstance = webEngine;
} else {
  const { ocrEngine: nativeEngine } = require('./ocrEngine.native');
  engineInstance = nativeEngine;
}

export const ocrEngine = engineInstance;
export default ocrEngine;

