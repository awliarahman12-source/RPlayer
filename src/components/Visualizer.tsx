import { useEffect, useRef } from 'react';
import { usePlayer } from '@/store/player';
import { analyserNode } from '@/lib/audioEngine';

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPlaying = usePlayer((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying || !analyserNode) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext('2d');
    let animationId: number;

    const draw = () => {
      if (!canvas || !canvasCtx || !analyserNode) return;
      animationId = requestAnimationFrame(draw);
      
      analyserNode.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        canvasCtx.fillStyle = `rgba(48, 209, 88, ${barHeight / 100})`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    
    draw();

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30 -z-10 pointer-events-none" />;
}