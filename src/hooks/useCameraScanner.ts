
import { useState, useRef, useCallback } from 'react';
import { Product } from '../types';

interface UseCameraScannerProps {
  products: Product[]; // Needed for simulation fallback
}

export const useCameraScanner = ({ products }: UseCameraScannerProps) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanCallback, setScanCallback] = useState<((code: string) => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setScanCallback(null);
  }, []);

  const startCamera = useCallback(async (callback: (code: string) => void) => {
    setScanCallback(() => callback);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Camera permission denied or not supported. Ensure you are using HTTPS or localhost.");
      setIsCameraOpen(false);
      setScanCallback(null);
    }
  }, []);

  const handleSimulatedScan = useCallback(() => {
    // In a real app with a library like html5-qrcode, this would be the success callback from the library.
    // For this environment, we pick a random valid barcode from the inventory to demonstrate flow.
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    if (randomProduct && scanCallback) {
      const code = randomProduct.barcode || randomProduct.sku;
      scanCallback(code);
      stopCamera();
    } else {
      // Fallback if no valid products
      if (scanCallback) scanCallback("123456");
      stopCamera();
    }
  }, [products, scanCallback, stopCamera]);

  return {
    isCameraOpen,
    startCamera,
    stopCamera,
    handleSimulatedScan,
    videoRef
  };
};
