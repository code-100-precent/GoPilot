import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Download, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FileSystemService } from '@/services/fileSystem';

interface AudioPlayerProps {
  filePath: string;
  fileName: string;
  onClose?: () => void;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ filePath, fileName, onClose, className }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isPCM, setIsPCM] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [sourceNode, setSourceNode] = useState<AudioBufferSourceNode | null>(null);
  const [pcmStartTime, setPcmStartTime] = useState<number>(0);
  const [pcmPausedTime, setPcmPausedTime] = useState<number>(0);

  // 加载 PCM 音频
  const loadPCMAudio = async (pcmData: Uint8Array) => {
    try {
      // PCM 默认参数（可以根据需要调整）
      // 常见配置：16-bit, 44.1kHz, 单声道或立体声
      const sampleRate = 44100; // 采样率
      const channels = 1; // 声道数（1=单声道, 2=立体声）
      const bitsPerSample = 16; // 位深度
      
      // 创建 AudioContext
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: sampleRate
      });
      setAudioContext(ctx);
      
      // 将 PCM 数据转换为 Float32Array
      // PCM 16-bit 是小端序，每个样本是 2 字节
      const samples = pcmData.length / (bitsPerSample / 8) / channels;
      const audioBuffer = ctx.createBuffer(channels, samples, sampleRate);
      
      // 转换 PCM 16-bit 到 Float32 (-1.0 到 1.0)
      for (let channel = 0; channel < channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < samples; i++) {
          const byteIndex = (i * channels + channel) * 2;
          if (byteIndex + 1 < pcmData.length) {
            // 读取 16-bit 小端序整数
            const int16 = (pcmData[byteIndex] | (pcmData[byteIndex + 1] << 8));
            // 处理有符号整数
            const sample = int16 > 32767 ? int16 - 65536 : int16;
            // 转换为 -1.0 到 1.0 的浮点数
            channelData[i] = sample / 32768.0;
          }
        }
      }
      
      setAudioBuffer(audioBuffer);
      
      // 计算时长
      const calculatedDuration = audioBuffer.duration;
      setDuration(calculatedDuration);
      
      // 生成波形数据
      const rawData = audioBuffer.getChannelData(0);
      const samplesCount = 100;
      const blockSize = Math.floor(rawData.length / samplesCount);
      const filteredData: number[] = [];
      
      for (let i = 0; i < samplesCount; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }
      
      const max = Math.max(...filteredData);
      const normalized = filteredData.map(n => (n / max) * 100);
      setWaveformData(normalized);
      
      setIsPCM(true);
      setError(null);
    } catch (err: any) {
      console.error('加载 PCM 音频失败:', err);
      setError(err.message || '无法加载 PCM 音频文件');
      setIsPCM(false);
    }
  };

  useEffect(() => {
    const loadAudio = async () => {
      try {
        setError(null);
        setIsLoading(true);
        const base64 = await FileSystemService.readBinaryFile(filePath);
        
        if (!base64 || base64.length === 0) {
          throw new Error('音频文件为空');
        }

        const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
        
        // 检查是否为 PCM 文件
        if (ext === 'pcm') {
          // 将 base64 转换为二进制数据
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await loadPCMAudio(bytes);
          setIsLoading(false);
          return;
        }

        // 其他格式使用标准 HTML5 Audio
        const mimeType = {
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav',
          'wave': 'audio/wav',
          'ogg': 'audio/ogg',
          'flac': 'audio/flac',
          'aac': 'audio/aac',
          'm4a': 'audio/mp4',
          'wma': 'audio/x-ms-wma',
          'opus': 'audio/opus',
        }[ext] || 'audio/mpeg';

        // 将 base64 转换为二进制数据
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // 使用 Blob 和 Blob URL 而不是 data URI（更可靠，特别是对于大文件）
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // 清理之前的 Blob URL
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
        
        setBlobUrl(url);
        setAudioSrc(url);
        setIsPCM(false);
      } catch (err: any) {
        console.error('加载音频失败:', err);
        setError(err.message || '无法加载音频文件');
        // 清理 Blob URL
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          setBlobUrl('');
        }
        setAudioSrc('');
        setIsPCM(false);
      } finally {
        setIsLoading(false);
      }
    };
    loadAudio();

    // 清理函数
    return () => {
      // 清理 AudioContext
      if (audioContext) {
        audioContext.close().catch(console.error);
      }
      // 清理 Blob URL
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [filePath, fileName]);

  // 组件卸载时清理 Blob URL
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // 生成波形数据（仅用于非 PCM 音频）
  useEffect(() => {
    if (isPCM) return; // PCM 音频的波形已在 loadPCMAudio 中生成
    
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const generateWaveform = async () => {
      try {
        const response = await fetch(audioSrc);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 从第一个声道获取音频数据
        const rawData = audioBuffer.getChannelData(0);
        const samples = 100; // 显示的条形数量
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          const blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }
        
        // 标准化数据
        const max = Math.max(...filteredData);
        const normalized = filteredData.map(n => (n / max) * 100);
        setWaveformData(normalized);
      } catch (err) {
        console.error('生成波形失败:', err);
        // 如果生成失败，使用随机数据作为后备
        setWaveformData(Array.from({ length: 100 }, () => Math.random() * 80 + 20));
      }
    };
    
    generateWaveform();
  }, [audioSrc, isPCM]);

  // 更新 PCM 音频进度
  useEffect(() => {
    if (!isPCM || !isPlaying || !audioContext || !audioBuffer) return;
    
    const interval = setInterval(() => {
      if (sourceNode && audioContext) {
        const elapsed = audioContext.currentTime - pcmStartTime;
        if (elapsed >= 0 && elapsed <= audioBuffer.duration) {
          setCurrentTime(elapsed);
        } else if (elapsed > audioBuffer.duration) {
          setIsPlaying(false);
          setCurrentTime(audioBuffer.duration);
          setPcmPausedTime(0);
        }
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPCM, isPlaying, audioContext, audioBuffer, sourceNode, pcmStartTime]);

  useEffect(() => {
    if (isPCM) return; // PCM 音频不使用 HTML5 Audio
    
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      let errorMsg = '无法加载音频文件';
      
      if (audio.error) {
        switch (audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMsg = '音频加载被中止';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = '网络错误，无法加载音频';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMsg = '音频解码失败，可能格式不支持或文件损坏';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = '音频格式不支持，请尝试其他格式（如 MP3、WAV）';
            break;
          default:
            errorMsg = `音频加载错误 (错误代码: ${audio.error.code})`;
        }
        console.error('音频错误详情:', {
          code: audio.error.code,
          message: audio.error.message,
          fileName,
          filePath
        });
      }
      
      setError(errorMsg);
      setIsPlaying(false);
    };
    const handleCanPlay = () => {
      // 音频可以播放时，更新时长
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };
    const handleLoadStart = () => setIsLoading(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // 加载音频
    audio.load();

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioSrc]);

  const togglePlayPause = async () => {
    // PCM 音频使用 Web Audio API
    if (isPCM && audioContext && audioBuffer) {
      try {
        if (isPlaying && sourceNode) {
          // 暂停
          sourceNode.stop();
          sourceNode.disconnect();
          setPcmPausedTime(audioContext.currentTime - pcmStartTime + pcmPausedTime);
          setSourceNode(null);
          setIsPlaying(false);
        } else {
          // 播放
          const ctx = audioContext;
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          
          const startOffset = pcmPausedTime;
          source.start(0, startOffset);
          
          setSourceNode(source);
          setPcmStartTime(ctx.currentTime - startOffset);
          setIsPlaying(true);
          
          // 监听播放结束
          source.onended = () => {
            setIsPlaying(false);
            setPcmPausedTime(0);
            setCurrentTime(0);
            setSourceNode(null);
          };
          
          // 更新进度
          const updateProgress = () => {
            if (isPlaying && sourceNode) {
              const elapsed = ctx.currentTime - pcmStartTime;
              setCurrentTime(Math.min(elapsed, audioBuffer.duration));
              if (elapsed < audioBuffer.duration) {
                requestAnimationFrame(updateProgress);
              }
            }
          };
          updateProgress();
        }
      } catch (err: any) {
        console.error('PCM 播放失败:', err);
        setError(err.message || '无法播放 PCM 音频');
      }
      return;
    }

    // 标准音频使用 HTML5 Audio
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (err: any) {
      console.error('播放失败:', err);
      setError(err.message || '无法播放音频，可能格式不支持');
    }
  };

  const handleWaveformClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const waveform = waveformRef.current;
    if (!waveform || !duration || duration === 0) return;

    const rect = waveform.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    
    // PCM 音频处理
    if (isPCM && audioContext && audioBuffer) {
      setPcmPausedTime(newTime);
      setCurrentTime(newTime);
      
      // 如果正在播放，重新开始
      if (isPlaying && sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
        setSourceNode(null);
      }
      
      // 自动播放
      if (!isPlaying) {
        try {
          const ctx = audioContext;
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          
          source.start(0, newTime);
          setSourceNode(source);
          setPcmStartTime(ctx.currentTime - newTime);
          setIsPlaying(true);
          
          source.onended = () => {
            setIsPlaying(false);
            setPcmPausedTime(0);
            setCurrentTime(0);
            setSourceNode(null);
          };
        } catch (err) {
          console.error('播放失败:', err);
        }
      }
      return;
    }

    // 标准音频处理
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);

    // 如果未播放，自动播放
    if (!isPlaying) {
      try {
        await audio.play();
      } catch (err) {
        console.error('播放失败:', err);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    
    // PCM 音频处理
    if (isPCM && audioContext && audioBuffer) {
      setPcmPausedTime(newTime);
      setCurrentTime(newTime);
      
      // 如果正在播放，重新开始
      if (isPlaying && sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
        setSourceNode(null);
        setIsPlaying(false);
      }
      return;
    }

    // 标准音频处理
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const skip = (seconds: number) => {
    // PCM 音频处理
    if (isPCM && audioBuffer) {
      const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
      setPcmPausedTime(newTime);
      setCurrentTime(newTime);
      
      // 如果正在播放，重新开始
      if (isPlaying && sourceNode && audioContext) {
        sourceNode.stop();
        sourceNode.disconnect();
        setSourceNode(null);
        
        // 从新位置开始播放
        const ctx = audioContext;
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        source.start(0, newTime);
        setSourceNode(source);
        setPcmStartTime(ctx.currentTime - newTime);
        
        source.onended = () => {
          setIsPlaying(false);
          setPcmPausedTime(0);
          setCurrentTime(0);
          setSourceNode(null);
        };
      }
      return;
    }

    // 标准音频处理
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    try {
      if (!audioSrc) return;
      const blob = await fetch(audioSrc).then(r => r.blob());
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Audio Player */}
      <div className="flex-1 flex flex-col p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!audioSrc ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p>加载中...</p>
            </div>
          </div>
        ) : (
          <>
            <audio
              ref={audioRef}
              src={audioSrc}
              preload="auto"
              crossOrigin="anonymous"
              className="hidden"
            />

            {/* Time Display */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{fileName}</h3>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Waveform-style Progress Bar */}
            <div className="flex items-center gap-3 mb-4">
              {/* Play/Pause Button */}
              <button
                onClick={togglePlayPause}
                disabled={isLoading}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-black dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 disabled:bg-gray-400 text-white flex items-center justify-center transition-colors"
                title={isPlaying ? '暂停' : '播放'}
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>

              {/* Waveform */}
              <div
                ref={waveformRef}
                onClick={handleWaveformClick}
                className="flex-1 h-16 relative bg-gray-100 dark:bg-gray-700 rounded cursor-pointer overflow-hidden group"
              >
                {/* Waveform bars */}
                <div className="absolute inset-0 flex items-center justify-around px-1 z-10">
                  {(waveformData.length > 0 ? waveformData : Array.from({ length: 100 }, () => 50)).map((height, i) => {
                    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
                    const isPlayed = (i / 100) * 100 < progress;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "w-0.5 rounded-full transition-colors",
                          isPlayed 
                            ? "bg-black dark:bg-white" 
                            : "bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-400 dark:group-hover:bg-gray-500"
                        )}
                        style={{ height: `${Math.max(20, height)}%` }}
                      />
                    );
                  })}
                </div>

                {/* Progress indicator */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              {/* Skip Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => skip(-10)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="后退 10 秒"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={() => skip(10)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="前进 10 秒"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title={isMuted ? '取消静音' : '静音'}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[35px]">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;

