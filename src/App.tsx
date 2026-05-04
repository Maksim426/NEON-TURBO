/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Trophy, RotateCcw, Pause, Github, Twitter, Info, Zap, Flame, Target } from 'lucide-react';

// --- Constants ---
const ROAD_LANES = 4;
const PLAYER_SIZE = { width: 40, height: 70 };
const ENEMY_BASE_SPEED = 4;
const SPEED_INCREMENT = 0.0001;
const ENEMY_SPAWN_RATE = 0.015;

// --- Types ---
interface Position {
  x: number;
  y: number;
}

interface GameObject {
  id: number;
  x: number;
  y: number;
  lane: number;
  type: 'enemy' | 'collectible';
  color: string;
}

enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  GAMEOVER,
}

// --- Components ---

const GameCanvas: React.FC<{
  gameState: GameState;
  score: number;
  onGameOver: (finalScore: number) => void;
  setScore: React.Dispatch<React.SetStateAction<number>>;
}> = ({ gameState, onGameOver, setScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs (to avoid closures in animation frame)
  const playerPos = useRef<number>(1); // Lane index 0-3
  const playerX = useRef<number>(0);
  const enemies = useRef<GameObject[]>([]);
  const speed = useRef<number>(ENEMY_BASE_SPEED);
  const internalScore = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const dimensions = useRef({ width: 0, height: 0 });

  // Handle Resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        dimensions.current = { width, height };
        // Center player in lane initially
        const laneWidth = width / ROAD_LANES;
        playerX.current = (playerPos.current * laneWidth) + (laneWidth / 2) - (PLAYER_SIZE.width / 2);
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    updateDimensions();

    return () => observer.disconnect();
  }, []);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        playerPos.current = Math.max(0, playerPos.current - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        playerPos.current = Math.min(ROAD_LANES - 1, playerPos.current + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Game Loop
  const animate = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions.current;
    const laneWidth = width / ROAD_LANES;

    // --- Update Logic ---
    frameCount.current++;
    speed.current += SPEED_INCREMENT;
    
    // Smooth player movement
    const targetX = (playerPos.current * laneWidth) + (laneWidth / 2) - (PLAYER_SIZE.width / 2);
    playerX.current += (targetX - playerX.current) * 0.2;

    // Spawn enemies
    if (Math.random() < ENEMY_SPAWN_RATE && frameCount.current % 10 === 0) {
      const lane = Math.floor(Math.random() * ROAD_LANES);
      const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7'];
      enemies.current.push({
        id: Date.now() + Math.random(),
        lane,
        x: (lane * laneWidth) + (laneWidth / 2) - (PLAYER_SIZE.width / 2),
        y: -PLAYER_SIZE.height,
        type: 'enemy',
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    // Move enemies & check collision
    enemies.current = enemies.current.filter(enemy => {
      enemy.y += speed.current;
      
      // Collision Detection (Rect vs Rect)
      const buffer = 5;
      if (
        playerX.current < enemy.x + PLAYER_SIZE.width - buffer &&
        playerX.current + PLAYER_SIZE.width > enemy.x + buffer &&
        height - 100 < enemy.y + PLAYER_SIZE.height - buffer &&
        height - 100 + PLAYER_SIZE.height > enemy.y + buffer
      ) {
        onGameOver(Math.round(internalScore.current));
        return false;
      }

      // Removal & Scoring
      if (enemy.y > height) {
        internalScore.current += 10;
        setScore(Math.round(internalScore.current));
        return false;
      }
      return true;
    });

    // --- Draw Logic ---
    ctx.clearRect(0, 0, width, height);

    // Draw Road
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    for (let i = 1; i < ROAD_LANES; i++) {
      ctx.beginPath();
      ctx.setLineDash([20, 20]);
      ctx.lineDashOffset = -frameCount.current * (speed.current * 0.5);
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw Player
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#22d3ee';
    ctx.fillStyle = '#22d3ee';
    
    // Player Body (Simplified Car Shape)
    const px = playerX.current;
    const py = height - 100;
    
    ctx.beginPath();
    ctx.roundRect(px, py, PLAYER_SIZE.width, PLAYER_SIZE.height, 8);
    ctx.fill();
    
    // Headlights
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.fillRect(px + 5, py, 5, 2);
    ctx.fillRect(px + PLAYER_SIZE.width - 10, py, 5, 2);

    // Draw Enemies
    enemies.current.forEach(enemy => {
      ctx.shadowBlur = 15;
      ctx.shadowColor = enemy.color;
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.roundRect(enemy.x, enemy.y, PLAYER_SIZE.width, PLAYER_SIZE.height, 8);
      ctx.fill();
      
      // Enemy Taillights
      ctx.fillStyle = '#fff';
      ctx.fillRect(enemy.x + 5, enemy.y + PLAYER_SIZE.height - 2, 5, 2);
      ctx.fillRect(enemy.x + PLAYER_SIZE.width - 10, enemy.y + PLAYER_SIZE.height - 2, 5, 2);
    });

    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, onGameOver, setScore]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, animate]);

  // Reset function exposed via effect or logic
  useEffect(() => {
    if (gameState === GameState.PLAYING && internalScore.current === 0) {
      enemies.current = [];
      speed.current = ENEMY_BASE_SPEED;
      frameCount.current = 0;
    }
  }, [gameState]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#050505] overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* HUD Content moved to parent App for better UI control */}
    </div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const startGame = () => {
    setScore(0);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (finalScore: number) => {
    if (finalScore > highScore) setHighScore(finalScore);
    setGameState(GameState.GAMEOVER);
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500 selection:text-white">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_#22d3ee_0%,_transparent_50%)]" />
      </div>

      <main className="relative flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative w-full max-w-lg aspect-[9/16] md:aspect-[3/4] bg-[#111] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <GameCanvas 
            gameState={gameState} 
            score={score} 
            onGameOver={handleGameOver}
            setScore={setScore}
          />

          {/* HUD Overlay */}
          {gameState === GameState.PLAYING && (
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Current Score</p>
                <h2 className="text-3xl font-bold font-mono tracking-tighter text-cyan-400">
                  {score.toString().padStart(6, '0')}
                </h2>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setGameState(GameState.PAUSED); }}
                className="pointer-events-auto p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <Pause size={20} />
              </button>
            </div>
          )}

          {/* Menu Overlay */}
          <AnimatePresence>
            {gameState === GameState.MENU && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#050505]/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
              >
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <div className="flex items-center justify-center gap-2 text-cyan-400 mb-2">
                    <Zap size={16} className="animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-[0.4em]">Speed System Active</span>
                  </div>
                  <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-[0.8] mb-4">
                    Neon<br /><span className="text-cyan-400">Turbo</span>
                  </h1>
                  <p className="text-sm text-white/40 leading-relaxed max-w-[240px] mx-auto">
                    Avoid rival pilots on the digital highway. Survial is the only metric of success.
                  </p>
                </motion.div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="group relative flex items-center gap-4 bg-white text-black px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm"
                >
                  <Play size={18} fill="black" />
                  Initiate Drive
                  <div className="absolute inset-0 rounded-xl bg-cyan-400 -z-10 blur-xl opacity-0 group-hover:opacity-40 transition-opacity" />
                </motion.button>

                <div className="mt-12 flex gap-8">
                  <div className="text-center">
                    <p className="text-[10px] uppercase text-white/40 mb-1">Top Score</p>
                    <p className="font-mono text-xl">{highScore.toString().padStart(6, '0')}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {gameState === GameState.PAUSED && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md flex flex-col items-center justify-center p-8"
              >
                <h2 className="text-4xl font-bold mb-8 italic uppercase text-white/50 tracking-widest">Drive Suspended</h2>
                <div className="flex flex-col gap-4 w-full max-w-[200px]">
                  <button 
                    onClick={() => setGameState(GameState.PLAYING)}
                    className="flex items-center justify-center gap-3 bg-cyan-400 text-black py-4 rounded-xl font-bold uppercase tracking-wider text-xs"
                  >
                    <Play size={16} fill="black" />
                    Resume
                  </button>
                  <button 
                    onClick={() => setGameState(GameState.MENU)}
                    className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 py-4 rounded-xl font-bold uppercase tracking-wider text-xs border border-white/10 transition-colors"
                  >
                    <RotateCcw size={16} />
                    Abort Mission
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === GameState.GAMEOVER && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-950/90 backdrop-blur-lg flex flex-col items-center justify-center p-8 text-center"
              >
                <motion.div
                   initial={{ scale: 0.9, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   className="mb-8"
                >
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/50">
                    <Flame size={32} className="text-red-500" />
                  </div>
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-2">Systems Critical</h2>
                  <p className="text-red-300/60 uppercase text-[10px] tracking-[0.3em]">Vehicle Integrity Lost</p>
                </motion.div>

                <div className="grid grid-cols-2 gap-4 w-full mb-10">
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                    <p className="text-[10px] uppercase text-white/30 mb-1">Final Score</p>
                    <p className="font-mono text-2xl text-red-400">{score.toString().padStart(6, '0')}</p>
                  </div>
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                    <p className="text-[10px] uppercase text-white/30 mb-1">System Record</p>
                    <p className="font-mono text-2xl">{highScore.toString().padStart(6, '0')}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 w-full max-w-[200px]">
                  <button 
                    onClick={startGame}
                    className="flex items-center justify-center gap-3 bg-white text-black py-4 rounded-xl font-bold uppercase tracking-wider text-xs"
                  >
                    <RotateCcw size={16} />
                    Restart Core
                  </button>
                  <button 
                    onClick={() => setGameState(GameState.MENU)}
                    className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 py-4 rounded-xl font-bold uppercase tracking-wider text-xs border border-white/10"
                  >
                    Return to Hub
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Controls Layer (Overlayed only when playing) */}
          {gameState === GameState.PLAYING && (
            <div className="absolute bottom-0 left-0 w-full p-8 grid grid-cols-2 gap-8 pointer-events-none">
              <div 
                className="h-24 bg-white/5 rounded-2xl border border-white/5 pointer-events-auto active:bg-white/10 transition-colors flex items-center justify-center"
                onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))}
              >
                <div className="w-1 h-8 bg-white/20 rounded-full" />
              </div>
              <div 
                className="h-24 bg-white/5 rounded-2xl border border-white/5 pointer-events-auto active:bg-white/10 transition-colors flex items-center justify-center"
                onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))}
              >
                <div className="w-1 h-8 bg-white/20 rounded-full" />
              </div>
            </div>
          )}
        </div>

        {/* Instructions Footer */}
        <div className="mt-8 flex gap-8 items-center text-[10px] uppercase tracking-widest text-white/20 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-white/10 rounded flex items-center justify-center border border-white/10">A</span>
            <span className="w-4 h-4 bg-white/10 rounded flex items-center justify-center border border-white/10">D</span>
            <span>Steer Vehicle</span>
          </div>
          <div className="flex items-center gap-2">
            <Target size={14} className="opacity-50" />
            <span>Avoid Collision</span>
          </div>
        </div>
      </main>

      {/* Decorative Grid */}
      <div className="fixed bottom-0 left-0 w-full h-[30vh] pointer-events-none z-[-1] overflow-hidden">
        <div 
          className="w-full h-full bg-[linear-gradient(rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" 
          style={{ 
            perspective: '500px',
            transform: 'rotateX(60deg) translateY(20%)',
          }} 
        />
      </div>
    </div>
  );
}
