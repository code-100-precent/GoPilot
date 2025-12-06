import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Download, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FileSystemService } from '@/services/fileSystem';

interface ImagePreviewProps {
  filePath: string;
  fileName: string;
  onClose?: () => void;
  className?: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ filePath, fileName, onClose, className }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    const loadImage = async () => {
      try {
        const base64 = await FileSystemService.readBinaryFile(filePath);
        const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
        const mimeType = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'bmp': 'image/bmp',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'ico': 'image/x-icon',
          'tiff': 'image/tiff',
          'tif': 'image/tiff',
        }[ext] || 'image/png';
        setImageSrc(`data:${mimeType};base64,${base64}`);
      } catch (err) {
        console.error('加载图片失败:', err);
        setError('无法加载图片');
      }
    };
    loadImage();
  }, [filePath, fileName]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleDownload = async () => {
    try {
      if (!imageSrc) return;
      const blob = await fetch(imageSrc).then(r => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  return (
    <div className={cn('h-full flex flex-col bg-gray-50 dark:bg-gray-900', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="旋转"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="重置"
          >
            重置
          </button>
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="下载"
          >
            <Download className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Image Container */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {error ? (
          <div className="text-center text-red-500">
            <p>加载图片失败: {error}</p>
          </div>
        ) : !imageSrc ? (
          <div className="text-center text-gray-500">
            <p>加载中...</p>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={fileName}
            onError={() => setError('无法加载图片')}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            className="shadow-lg"
          />
        )}
      </div>
    </div>
  );
};

export default ImagePreview;

