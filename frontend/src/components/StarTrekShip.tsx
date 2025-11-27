import { Box } from '@mantine/core';
import { useEffect, useState } from 'react';

export function StarTrekShip() {
    const [warp, setWarp] = useState(false);
    const [position, setPosition] = useState({ x: 10, y: 10 });

    useEffect(() => {
        // Warp animation loop
        const interval = setInterval(() => {
            if (Math.random() > 0.8) { // 20% chance every 5s
                setWarp(true);
                setTimeout(() => {
                    setWarp(false);
                    // Reset to a random start position on left
                    setPosition({ x: Math.random() * 50, y: 5 + Math.random() * 20 });
                }, 800); 
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Box
            style={{
                position: 'absolute',
                top: `${position.y}px`,
                left: `${position.x}px`,
                width: '120px',
                height: '40px',
                zIndex: 0,
                opacity: 0.6,
                pointerEvents: 'none',
                transition: warp ? 'transform 0.6s cubic-bezier(0.7, 0, 0.84, 0)' : 'transform 4s ease-in-out',
                transform: warp 
                    ? 'translateX(100vw) scaleX(4)' // Stretch and move fast
                    : 'translateX(0) scaleX(1)',    // Idling
                animation: warp ? 'none' : 'float 8s infinite ease-in-out alternate'
            }}
        >
             {/* Silhouette of Enterprise-D style ship */}
             <svg viewBox="0 0 120 50" fill="#22B8CF" style={{ filter: 'drop-shadow(0 0 8px #22B8CF)' }}>
                {/* Saucer Section (Ellipse) */}
                <ellipse cx="35" cy="20" rx="30" ry="8" />
                
                {/* Neck connecting Saucer to Engineering */}
                <path d="M 45 22 L 55 32 L 40 32 L 30 22 Z" />
                
                {/* Engineering Hull (Cylinder-ish) */}
                <rect x="40" y="30" width="40" height="10" />
                <circle cx="80" cy="35" r="5" /> {/* Deflector Dish area */}

                {/* Nacelle Pylons (Swept back) */}
                <path d="M 60 30 L 80 15" stroke="#22B8CF" strokeWidth="4" strokeLinecap="round" />
                
                {/* Nacelles (Top) */}
                <rect x="65" y="10" width="50" height="6" rx="0" />
             </svg>
             <style>{`
                @keyframes float {
                    0% { transform: translateY(0px) rotate(0deg); }
                    33% { transform: translateY(5px) rotate(1deg); }
                    66% { transform: translateY(-5px) rotate(-1deg); }
                    100% { transform: translateY(0px) rotate(0deg); }
                }
             `}</style>
        </Box>
    );
}

