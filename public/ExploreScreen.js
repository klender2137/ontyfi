// ExploreScreen.js - Tag Bubble Map Exploration
// Visual tag exploration with expandable bubbles showing semantic similarity groups

if (typeof window !== 'undefined' && window.React) {
  const { useMemo, useState, useEffect, useRef, useCallback } = React;

  // ==========================================
  // TAG SIMILARITY GROUPING ENGINE
  // ==========================================
  const TagSimilarityEngine = {
    semanticGroups: {
      'defi': ['defi', 'dex', 'amm', 'liquidity', 'yield', 'farming', 'staking', 'lending', 'borrowing', 'vaults', 'protocols'],
      'trading': ['trading', 'spot', 'derivatives', 'futures', 'perps', 'margin', 'leverage', 'arbitrage', 'market-making', 'momentum'],
      'technical': ['technical-analysis', 'ta', 'indicators', 'rsi', 'macd', 'bollinger', 'fibonacci', 'support', 'resistance', 'trends'],
      'onchain': ['onchain', 'blockchain', 'nodes', 'validators', 'consensus', 'layer2', 'l2', 'scaling', 'rollup', 'zk'],
      'tokens': ['tokens', 'erc20', 'nfts', 'memecoins', 'altcoins', 'governance', 'utility', 'stablecoins', 'synthetics'],
      'security': ['security', 'audit', 'risk', 'exploit', 'hack', 'scam', 'phishing', 'wallet-security', 'multisig'],
      'economics': ['tokenomics', 'economics', 'supply', 'demand', 'inflation', 'deflation', 'burn', 'mint', 'distribution', 'vesting'],
      'tools': ['tools', 'analytics', 'portfolio', 'tracking', 'dashboards', 'apis', 'bots', 'automation', 'alerts'],
      'bridges': ['bridges', 'cross-chain', 'interoperability', 'atomic-swaps', 'wrapped', 'portals', 'multichain'],
      'mining': ['mining', 'proof-of-work', 'pow', 'hashrate', 'asics', 'gpu', 'validators', 'staking-rewards'],
      'airdrops': ['airdrops', 'faucets', 'rewards', 'incentives', 'campaigns', 'claims', 'retroactive'],
      'wallets': ['wallets', 'metamask', 'ledger', 'hardware', 'software', 'custody', 'self-custody', 'mpc', 'smart-wallets']
    },

    groupColors: {
      'defi': { bg: '#0ea5e9', text: '#ffffff', glow: 'rgba(14, 165, 233, 0.6)' },
      'trading': { bg: '#f59e0b', text: '#ffffff', glow: 'rgba(245, 158, 11, 0.6)' },
      'technical': { bg: '#8b5cf6', text: '#ffffff', glow: 'rgba(139, 92, 246, 0.6)' },
      'onchain': { bg: '#10b981', text: '#ffffff', glow: 'rgba(16, 185, 129, 0.6)' },
      'tokens': { bg: '#ec4899', text: '#ffffff', glow: 'rgba(236, 72, 153, 0.6)' },
      'security': { bg: '#ef4444', text: '#ffffff', glow: 'rgba(239, 68, 68, 0.6)' },
      'economics': { bg: '#f97316', text: '#ffffff', glow: 'rgba(249, 115, 22, 0.6)' },
      'tools': { bg: '#06b6d4', text: '#ffffff', glow: 'rgba(6, 182, 212, 0.6)' },
      'bridges': { bg: '#84cc16', text: '#ffffff', glow: 'rgba(132, 204, 22, 0.6)' },
      'mining': { bg: '#6366f1', text: '#ffffff', glow: 'rgba(99, 102, 241, 0.6)' },
      'airdrops': { bg: '#d946ef', text: '#ffffff', glow: 'rgba(217, 70, 239, 0.6)' },
      'wallets': { bg: '#14b8a6', text: '#ffffff', glow: 'rgba(20, 184, 166, 0.6)' }
    },

    calculateSimilarity(tag1, tag2) {
      const t1 = tag1.toLowerCase().replace(/[-_]/g, '');
      const t2 = tag2.toLowerCase().replace(/[-_]/g, '');
      if (t1 === t2) return 1.0;
      for (const [group, tags] of Object.entries(this.semanticGroups)) {
        const t1InGroup = tags.includes(t1);
        const t2InGroup = tags.includes(t2);
        if (t1InGroup && t2InGroup) return 0.9;
        if ((t1InGroup && t2.includes(group)) || (t2InGroup && t1.includes(group))) return 0.8;
      }
      if (t1.includes(t2) || t2.includes(t1)) return 0.7;
      const distance = this.levenshteinDistance(t1, t2);
      const maxLen = Math.max(t1.length, t2.length);
      if (maxLen === 0) return 1.0;
      const similarity = 1 - (distance / maxLen);
      return similarity > 0.6 ? similarity * 0.6 : 0;
    },

    levenshteinDistance(s1, s2) {
      const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
      for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
      for (let j = 1; j <= s2.length; j++) {
        for (let i = 1; i <= s1.length; i++) {
          const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1,
            matrix[j - 1][i - 1] + indicator
          );
        }
      }
      return matrix[s2.length][s1.length];
    },

    groupTagsBySimilarity(tagEntries, threshold = 0.65) {
      const groups = [];
      const processed = new Set();
      for (const [semanticGroup, semanticTags] of Object.entries(this.semanticGroups)) {
        const groupTags = [];
        const groupNodes = new Map();
        tagEntries.forEach(entry => {
          const tagNorm = entry.tag.toLowerCase().replace(/[-_]/g, '');
          const isMatch = semanticTags.includes(tagNorm) || 
                         semanticTags.some(st => tagNorm.includes(st) || st.includes(tagNorm));
          if (isMatch && !processed.has(entry.tag)) {
            processed.add(entry.tag);
            groupTags.push(entry);
            entry.nodes.forEach(node => {
              if (!groupNodes.has(node.id)) {
                groupNodes.set(node.id, node);
              }
            });
          }
        });
        if (groupTags.length > 0) {
          groups.push({
            id: semanticGroup,
            name: semanticGroup.charAt(0).toUpperCase() + semanticGroup.slice(1),
            tags: groupTags,
            allNodes: Array.from(groupNodes.values()),
            color: this.groupColors[semanticGroup] || { bg: '#6b7280', text: '#ffffff', glow: 'rgba(107, 114, 128, 0.6)' },
            bubbleSize: Math.sqrt(groupTags.length * 20 + groupNodes.size * 30) + 60
          });
        }
      }
      const ungrouped = tagEntries.filter(e => !processed.has(e.tag));
      if (ungrouped.length > 0) {
        const otherNodes = new Map();
        ungrouped.forEach(entry => {
          entry.nodes.forEach(node => {
            if (!otherNodes.has(node.id)) {
              otherNodes.set(node.id, node);
            }
          });
        });
        groups.push({
          id: 'other',
          name: 'Other',
          tags: ungrouped,
          allNodes: Array.from(otherNodes.values()),
          color: { bg: '#6b7280', text: '#ffffff', glow: 'rgba(107, 114, 128, 0.6)' },
          bubbleSize: Math.sqrt(ungrouped.length * 20 + otherNodes.size * 30) + 60
        });
      }
      return groups.sort((a, b) => b.allNodes.length - a.allNodes.length);
    }
  };

  // ==========================================
  // ADVANCED BUBBLE PHYSICS ENGINE
  // ==========================================
  const BubblePhysics = {
    SPACE_MULTIPLIER: 5,
    FRICTION: 0.92,
    ELASTICITY: 0.7,
    REPULSION_FORCE: 0.8,
    
    calculateBubblePositions(groups, containerWidth, containerHeight, padding = 100) {
      const expandedWidth = containerWidth * this.SPACE_MULTIPLIER;
      const expandedHeight = containerHeight * this.SPACE_MULTIPLIER;
      const positions = [];
      const centerX = expandedWidth / 2;
      const centerY = expandedHeight / 2;
      const sortedGroups = [...groups].sort((a, b) => b.bubbleSize - a.bubbleSize);
      
      sortedGroups.forEach((group, index) => {
        let x, y;
        if (index === 0) {
          x = centerX;
          y = centerY;
        } else {
          const goldenAngle = Math.PI * (3 - Math.sqrt(5));
          const radiusStep = Math.max(...sortedGroups.slice(0, index).map(g => g.bubbleSize)) * 0.8;
          const radius = Math.sqrt(index) * radiusStep * 1.5;
          const angle = index * goldenAngle;
          x = centerX + Math.cos(angle) * radius;
          y = centerY + Math.sin(angle) * radius;
          x = Math.max(group.bubbleSize + padding, Math.min(expandedWidth - group.bubbleSize - padding, x));
          y = Math.max(group.bubbleSize + padding, Math.min(expandedHeight - group.bubbleSize - padding, y));
        }
        positions.push({
          group,
          x,
          y,
          targetX: x,
          targetY: y,
          velocityX: 0,
          velocityY: 0,
          isDragging: false,
          mass: group.bubbleSize / 100
        });
      });
      
      for (let iterations = 0; iterations < 100; iterations++) {
        let moved = false;
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const p1 = positions[i];
            const p2 = positions[j];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = p1.group.bubbleSize + p2.group.bubbleSize + 30;
            if (distance < minDistance && distance > 0) {
              const force = (minDistance - distance) / distance * 0.5;
              const moveX = dx * force;
              const moveY = dy * force;
              if (!p1.isDragging) {
                p1.x -= moveX;
                p1.y -= moveY;
              }
              if (!p2.isDragging) {
                p2.x += moveX;
                p2.y += moveY;
              }
              moved = true;
            }
          }
          const p = positions[i];
          p.x = Math.max(p.group.bubbleSize + padding, Math.min(expandedWidth - p.group.bubbleSize - padding, p.x));
          p.y = Math.max(p.group.bubbleSize + padding, Math.min(expandedHeight - p.group.bubbleSize - padding, p.y));
        }
        if (!moved) break;
      }
      return positions;
    },

    resolveCollisions(positions, expandedWidth, expandedHeight) {
      const updated = [...positions];
      for (let i = 0; i < updated.length; i++) {
        for (let j = i + 1; j < updated.length; j++) {
          const p1 = updated[i];
          const p2 = updated[j];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = p1.group.bubbleSize + p2.group.bubbleSize + 20;
          
          if (distance < minDistance && distance > 0) {
            const overlap = minDistance - distance;
            const nx = dx / distance;
            const ny = dy / distance;
            const separationX = nx * overlap * 0.5 * this.REPULSION_FORCE;
            const separationY = ny * overlap * 0.5 * this.REPULSION_FORCE;
            
            if (!p1.isDragging) {
              p1.velocityX -= separationX / p1.mass;
              p1.velocityY -= separationY / p1.mass;
            }
            if (!p2.isDragging) {
              p2.velocityX += separationX / p2.mass;
              p2.velocityY += separationY / p2.mass;
            }
            
            const relativeVelocityX = p2.velocityX - p1.velocityX;
            const relativeVelocityY = p2.velocityY - p1.velocityY;
            const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;
            
            if (velocityAlongNormal < 0) {
              const impulse = -(1 + this.ELASTICITY) * velocityAlongNormal / (1/p1.mass + 1/p2.mass);
              const impulseX = impulse * nx;
              const impulseY = impulse * ny;
              
              if (!p1.isDragging) {
                p1.velocityX -= impulseX / p1.mass;
                p1.velocityY -= impulseY / p1.mass;
              }
              if (!p2.isDragging) {
                p2.velocityX += impulseX / p2.mass;
                p2.velocityY += impulseY / p2.mass;
              }
            }
          }
        }
        
        const p = updated[i];
        const padding = 50;
        if (p.x < p.group.bubbleSize + padding) {
          p.x = p.group.bubbleSize + padding;
          p.velocityX *= -this.ELASTICITY;
        }
        if (p.x > expandedWidth - p.group.bubbleSize - padding) {
          p.x = expandedWidth - p.group.bubbleSize - padding;
          p.velocityX *= -this.ELASTICITY;
        }
        if (p.y < p.group.bubbleSize + padding) {
          p.y = p.group.bubbleSize + padding;
          p.velocityY *= -this.ELASTICITY;
        }
        if (p.y > expandedHeight - p.group.bubbleSize - padding) {
          p.y = expandedHeight - p.group.bubbleSize - padding;
          p.velocityY *= -this.ELASTICITY;
        }
        
        if (!p.isDragging) {
          p.x += p.velocityX;
          p.y += p.velocityY;
          p.velocityX *= this.FRICTION;
          p.velocityY *= this.FRICTION;
        }
      }
      return updated;
    },

    calculateMultiEchelonLayout(nodes, centerX, centerY, echelonIndex = 0) {
      const echelons = [];
      let remainingNodes = [...nodes];
      let currentRadius = 200;
      let currentEchelon = 0;
      
      // Calculate base capacity for first echelon
      const baseCapacity = 18;
      const capacityIncrement = 4;
      
      // Calculate how many tiles will be in the first echelon
      const firstEchelonCapacity = baseCapacity;
      const firstEchelonCount = Math.min(remainingNodes.length, firstEchelonCapacity);
      
      // Dynamic radius expansion based on fill percentage of first echelon
      const fillPercentage = firstEchelonCount / firstEchelonCapacity;
      const fillRatio = Math.min(1, Math.max(0, fillPercentage));
      // Expand radius by up to 60% when approaching 100% capacity
      const radiusExpansionFactor = 1 + (fillRatio * 0.6);
      const expandedBaseRadius = currentRadius * radiusExpansionFactor;
      
      // Adjust subsequent radii to maintain relative spacing
      const radiusStep = 120 * radiusExpansionFactor;
      
      while (remainingNodes.length > 0) {
        const capacity = baseCapacity + (currentEchelon * capacityIncrement);
        const echelonNodes = remainingNodes.slice(0, capacity);
        remainingNodes = remainingNodes.slice(capacity);
        
        // Use expanded radius for first echelon, adjusted for subsequent ones
        const echelonRadius = currentEchelon === 0 
          ? expandedBaseRadius 
          : expandedBaseRadius + (currentEchelon * radiusStep);
        
        const angleStep = (Math.PI * 2) / echelonNodes.length;
        const tiles = echelonNodes.map((node, index) => {
          const angle = index * angleStep - Math.PI / 2;
          return {
            node,
            x: centerX + Math.cos(angle) * echelonRadius,
            y: centerY + Math.sin(angle) * echelonRadius,
            angle,
            index,
            echelon: currentEchelon
          };
        });
        
        echelons.push({
          tiles,
          radius: echelonRadius,
          echelonIndex: currentEchelon,
          nodeCount: echelonNodes.length,
          capacity: capacity,
          fillPercentage: (echelonNodes.length / capacity) * 100
        });
        
        currentRadius += radiusStep;
        currentEchelon++;
      }
      
      return echelons;
    },

    getEchelonCapacity(echelonIndex) {
      return 18 + (echelonIndex * 4);
    },

    getMaxEchelonsForNodeCount(nodeCount) {
      let count = 0;
      let echelon = 0;
      while (count < nodeCount) {
        count += this.getEchelonCapacity(echelon);
        echelon++;
      }
      return echelon;
    }
  };

  // ==========================================
  // BUBBLE COMPONENT
  // ==========================================
  function TagBubble({ 
    bubble, 
    position, 
    isExploded, 
    onExplode, 
    onReinflate, 
    onOpenArticle, 
    containerRef,
    onPositionChange,
    viewportOffset
  }) {
    const [isHovered, setIsHovered] = useState(false);
    const [explosionProgress, setExplosionProgress] = useState(0);
    const [tileEchelons, setTileEchelons] = useState([]);
    const [currentEchelonView, setCurrentEchelonView] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const bubbleRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0, bubbleX: 0, bubbleY: 0, grabOffsetX: 0, grabOffsetY: 0 });
    const animationFrameRef = useRef(null);

    useEffect(() => {
      if (isExploded && explosionProgress < 1) {
        const startTime = Date.now();
        const duration = 600;
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          setExplosionProgress(eased);
          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
      } else if (!isExploded) {
        setExplosionProgress(0);
        setTileEchelons([]);
        setCurrentEchelonView(0);
      }
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [isExploded]);

    useEffect(() => {
      if (isExploded && bubble.allNodes.length > 0) {
        const echelons = BubblePhysics.calculateMultiEchelonLayout(
          bubble.allNodes,
          position.x,
          position.y
        );
        setTileEchelons(echelons);
      }
    }, [isExploded, position.x, position.y, bubble.allNodes.length]);

    const handleMouseDown = useCallback((e) => {
      if (isExploded) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);

      const cursorWorldX = e.clientX - viewportOffset.x;
      const cursorWorldY = e.clientY - viewportOffset.y;
      const grabOffsetX = cursorWorldX - position.x;
      const grabOffsetY = cursorWorldY - position.y;

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        bubbleX: position.x,
        bubbleY: position.y,
        grabOffsetX,
        grabOffsetY
      };
    }, [isExploded, position]);

    const handleMouseMove = useCallback((e) => {
      if (!isDragging) return;
      e.preventDefault();

      const cursorWorldX = e.clientX - viewportOffset.x;
      const cursorWorldY = e.clientY - viewportOffset.y;
      const newX = cursorWorldX - dragStartRef.current.grabOffsetX;
      const newY = cursorWorldY - dragStartRef.current.grabOffsetY;
      onPositionChange(bubble.id, newX, newY, true);
    }, [isDragging, bubble.id, onPositionChange, viewportOffset]);

    const handleMouseUp = useCallback((e) => {
      if (!isDragging) return;
      setIsDragging(false);
      onPositionChange(bubble.id, position.x, position.y, false);
    }, [isDragging, bubble.id, onPositionChange, position]);

    useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleDoubleClick = useCallback(() => {
      if (!isExploded && !isDragging) {
        try {
          if (typeof window !== 'undefined' && window.Gamification && typeof window.Gamification.trackBubbleBounce === 'function') {
            window.Gamification.trackBubbleBounce().catch(() => {});
          }
        } catch (e) {}
        onExplode(bubble.id);
      }
    }, [isExploded, isDragging, bubble.id, onExplode]);

    const totalEchelons = tileEchelons.length;
    const visibleEchelons = totalEchelons <= 3 
      ? tileEchelons 
      : tileEchelons.slice(currentEchelonView, currentEchelonView + 3);

    const bubbleScale = isHovered && !isExploded && !isDragging ? 1.08 : 1;
    const bubbleOpacity = isExploded ? Math.max(0, 1 - explosionProgress * 2) : 1;
    const screenX = position.x + viewportOffset.x;
    const screenY = position.y + viewportOffset.y;
    const bubbleTransform = `translate(${screenX - bubble.bubbleSize / 2}px, ${screenY - bubble.bubbleSize / 2}px) scale(${bubbleScale * (isExploded ? 1 + explosionProgress * 0.3 : 1)})`;

    return React.createElement(React.Fragment, null, [
      !isExploded && React.createElement('div', {
        key: 'bubble',
        ref: bubbleRef,
        className: 'tag-bubble',
        style: {
          position: 'absolute',
          width: `${bubble.bubbleSize}px`,
          height: `${bubble.bubbleSize}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${bubble.color.bg}, ${bubble.color.bg}dd, ${bubble.color.bg}99)`,
          color: bubble.color.text,
          transform: bubbleTransform,
          opacity: bubbleOpacity,
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isHovered || isDragging
            ? `0 20px 60px ${bubble.color.glow}, inset 0 -10px 40px rgba(0,0,0,0.2)`
            : `0 10px 40px ${bubble.color.glow}, inset 0 -5px 30px rgba(0,0,0,0.2)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease, box-shadow 0.3s ease',
          zIndex: isDragging || isHovered ? 100 : 1,
          userSelect: 'none'
        },
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        onMouseDown: handleMouseDown,
        onDoubleClick: handleDoubleClick
      }, [
        React.createElement('div', {
          key: 'name',
          style: {
            fontSize: `${Math.max(14, bubble.bubbleSize / 8)}px`,
            fontWeight: 'bold',
            textAlign: 'center',
            padding: '0 10px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }
        }, bubble.name),
        React.createElement('div', {
          key: 'stats',
          style: {
            fontSize: `${Math.max(10, bubble.bubbleSize / 12)}px`,
            opacity: 0.9,
            marginTop: '4px'
          }
        }, `${bubble.tags.length} tags · ${bubble.allNodes.length} items`),
        React.createElement('div', {
          key: 'hint',
          style: {
            fontSize: '10px',
            opacity: 0.7,
            marginTop: '6px',
            fontStyle: 'italic'
          }
        }, 'Drag to move · Double-click to explore')
      ]),

      isExploded && explosionProgress > 0.3 && React.createElement('div', {
        key: 'exploded-view',
        style: {
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 200
        }
      }, [
        React.createElement('div', {
          key: 'info-card',
          style: {
            position: 'absolute',
            left: `${screenX - 150}px`,
            top: `${screenY - 120}px`,
            width: '300px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderRadius: '16px',
            padding: '20px',
            border: `2px solid ${bubble.color.bg}`,
            boxShadow: `0 0 60px ${bubble.color.glow}`,
            pointerEvents: 'auto',
            opacity: Math.min(1, (explosionProgress - 0.3) * 2),
            transform: `scale(${Math.min(1, (explosionProgress - 0.3) * 1.5)})`,
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            zIndex: 250
          }
        }, [
          React.createElement('div', {
            key: 'header',
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }
          }, [
            React.createElement('h3', {
              key: 'title',
              style: {
                margin: 0,
                color: bubble.color.bg,
                fontSize: '24px'
              }
            }, bubble.name),
            React.createElement('button', {
              key: 'reinflate',
              onClick: onReinflate,
              style: {
                background: bubble.color.bg,
                color: bubble.color.text,
                border: 'none',
                borderRadius: '20px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }
            }, '🎈 Reinflate')
          ]),
          React.createElement('div', {
            key: 'tags-list',
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '12px'
            }
          }, bubble.tags.slice(0, 8).map(t => 
            React.createElement('span', {
              key: t.tag,
              style: {
                background: `${bubble.color.bg}40`,
                color: bubble.color.bg,
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                border: `1px solid ${bubble.color.bg}60`
              }
            }, t.tag)
          )),
          totalEchelons > 1 && React.createElement('div', {
            key: 'echelon-indicator',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#94a3b8'
            }
          }, [
            React.createElement('span', { key: 'label' }, `Echelon ${currentEchelonView + 1}-${Math.min(currentEchelonView + 3, totalEchelons)} of ${totalEchelons}`),
            React.createElement('span', { key: 'dots', style: { display: 'flex', gap: '4px' } },
              Array.from({ length: totalEchelons }).map((_, i) =>
                React.createElement('span', {
                  key: i,
                  style: {
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: i >= currentEchelonView && i < currentEchelonView + 3 ? bubble.color.bg : 'rgba(148, 163, 184, 0.3)'
                  }
                })
              )
            )
          ]),
          totalEchelons > 3 && React.createElement('div', {
            key: 'echelon-controls',
            style: {
              display: 'flex',
              gap: '10px',
              marginTop: '12px'
            }
          }, [
            currentEchelonView > 0 && React.createElement('button', {
              key: 'prev',
              onClick: () => setCurrentEchelonView(Math.max(0, currentEchelonView - 1)),
              style: {
                flex: 1,
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#e5e7eb',
                border: `1px solid ${bubble.color.bg}60`,
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }
            }, '← Previous'),
            currentEchelonView + 3 < totalEchelons && React.createElement('button', {
              key: 'next',
              onClick: () => setCurrentEchelonView(Math.min(totalEchelons - 3, currentEchelonView + 1)),
              style: {
                flex: 1,
                background: bubble.color.bg,
                color: bubble.color.text,
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }
            }, 'Next Echelon →')
          ]),
          React.createElement('div', {
            key: 'items-count',
            style: {
              color: '#94a3b8',
              fontSize: '13px',
              marginTop: '10px',
              borderTop: '1px solid rgba(148, 163, 184, 0.2)',
              paddingTop: '10px'
            }
          }, `${bubble.allNodes.length} items in ${totalEchelons} circle${totalEchelons > 1 ? 's' : ''}`)
        ]),

        visibleEchelons.flatMap((echelon, echelonIdx) => 
          echelon.tiles.map((tilePos, index) => {
            const staggerOffset = echelonIdx * 0.15;
            const tileDelay = index * 0.02;
            const tileProgress = explosionProgress - 0.3 - tileDelay - staggerOffset;
            const tileOpacity = Math.max(0, Math.min(1, tileProgress * 4));
            const tileScale = Math.max(0, Math.min(1, tileProgress * 3));
            if (tileOpacity <= 0.01) return null;
            
            const screenX = tilePos.x + viewportOffset.x;
            const screenY = tilePos.y + viewportOffset.y;
            
            return React.createElement('div', {
              key: `tile-${bubble.id}-${echelon.echelonIndex}-${tilePos.node.id}`,
              className: 'exploded-tile',
              style: {
                position: 'absolute',
                left: `${screenX - 100}px`,
                top: `${screenY - 60}px`,
                width: '200px',
                minHeight: '120px',
                background: 'rgba(30, 41, 59, 0.95)',
                borderRadius: '12px',
                padding: '16px',
                border: `1px solid ${bubble.color.bg}60`,
                boxShadow: `0 8px 32px ${bubble.color.glow}40`,
                cursor: 'pointer',
                pointerEvents: 'auto',
                opacity: tileOpacity,
                transform: `scale(${tileScale})`,
                transition: 'all 0.3s ease',
                zIndex: 201 + index + echelonIdx * 100
              },
              onClick: () => onOpenArticle(tilePos.node),
              onMouseEnter: (e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = `0 16px 48px ${bubble.color.glow}`;
                e.currentTarget.style.zIndex = 500;
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.transform = `scale(${Math.max(0, tileScale)})`;
                e.currentTarget.style.boxShadow = `0 8px 32px ${bubble.color.glow}40`;
                e.currentTarget.style.zIndex = 201 + index + echelonIdx * 100;
              }
            }, [
              React.createElement('div', {
                key: 'name',
                style: {
                  fontWeight: '600',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  marginBottom: '8px',
                  lineHeight: '1.3'
                }
              }, tilePos.node.name),
              tilePos.node.description && React.createElement('div', {
                key: 'desc',
                style: {
                  fontSize: '12px',
                  color: '#94a3b8',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }
              }, tilePos.node.description.length > 80 
                ? tilePos.node.description.substring(0, 80) + '...'
                : tilePos.node.description
              ),
              React.createElement('div', {
                key: 'tags',
                style: {
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  marginTop: '10px'
                }
              }, (tilePos.node.tags || []).slice(0, 3).map(tag => 
                React.createElement('span', {
                  key: tag,
                  style: {
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: `${bubble.color.bg}30`,
                    color: bubble.color.bg,
                    border: `1px solid ${bubble.color.bg}40`
                  }
                }, tag)
              ))
            ]);
          })
        )
      ])
    ]);
  }

  // ==========================================
  // MAIN EXPLORE SCREEN
  // ==========================================
  function ExploreScreen({ tree, onOpenArticle, onGoHome, onGoToTree }) {
    const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
    const [explodedBubbleId, setExplodedBubbleId] = useState(null);
    const [bubblePositions, setBubblePositions] = useState([]);
    const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const touchStartRef = useRef({ distance: 0, zoom: 1 });
    const lastTouchRef = useRef([]);
    const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
    const containerRef = useRef(null);
    const physicsLoopRef = useRef(null);

    const expandedDimensions = useMemo(() => ({
      width: viewportSize.width * BubblePhysics.SPACE_MULTIPLIER,
      height: viewportSize.height * BubblePhysics.SPACE_MULTIPLIER
    }), [viewportSize]);

    const flatNodes = useMemo(() => {
      const flatten = (nodes, path = []) => nodes.reduce((acc, n) => {
        const currentPath = [...path, {id: n.id, name: n.name}];
        const children = [
          ...(n.categories || []),
          ...(n.subcategories || []),
          ...(n.nodes || []),
          ...(n.subnodes || []),
          ...(n.leafnodes || [])
        ];
        return [...acc, { ...n, path: currentPath, children }, ...flatten(children, currentPath)];
      }, []);
      return flatten(tree.fields || []);
    }, [tree]);

    const tagIndex = useMemo(() => {
      const map = new Map();
      flatNodes.forEach(n => {
        (n.tags || []).forEach(t => {
          const norm = t.toLowerCase();
          if (!map.has(norm)) map.set(norm, { tag: t, nodes: [] });
          map.get(norm).nodes.push(n);
        });
      });
      return Array.from(map.values());
    }, [flatNodes]);

    const tagGroups = useMemo(() => {
      return TagSimilarityEngine.groupTagsBySimilarity(tagIndex);
    }, [tagIndex]);

    useEffect(() => {
      const updateDimensions = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setViewportSize({
            width: rect.width,
            height: rect.height
          });
        }
      };
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
      if (tagGroups.length > 0 && viewportSize.width > 0) {
        const positions = BubblePhysics.calculateBubblePositions(
          tagGroups, 
          viewportSize.width, 
          viewportSize.height,
          80
        );
        setBubblePositions(positions);

        // Center the viewport on the "Other" bubble by default (fallback to cluster center)
        const other = positions.find(p => p.group && p.group.id === 'other');
        if (other) {
          setViewportOffset({
            x: (viewportSize.width / 2) - other.x,
            y: (viewportSize.height / 2) - other.y
          });
        } else {
          const centerX = viewportSize.width * BubblePhysics.SPACE_MULTIPLIER / 2;
          const centerY = viewportSize.height * BubblePhysics.SPACE_MULTIPLIER / 2;
          setViewportOffset({
            x: (viewportSize.width / 2) - centerX,
            y: (viewportSize.height / 2) - centerY
          });
        }
        setZoomLevel(1);
      }
    }, [tagGroups, viewportSize]);

    useEffect(() => {
      const animate = () => {
        setBubblePositions(prev => {
          if (prev.length === 0) return prev;
          const updated = BubblePhysics.resolveCollisions(
            prev, 
            expandedDimensions.width, 
            expandedDimensions.height
          );
          return updated;
        });
        physicsLoopRef.current = requestAnimationFrame(animate);
      };
      physicsLoopRef.current = requestAnimationFrame(animate);
      return () => {
        if (physicsLoopRef.current) {
          cancelAnimationFrame(physicsLoopRef.current);
        }
      };
    }, [expandedDimensions]);

    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setZoomLevel(z => Math.min(3, z + 0.25));
        } else if (e.key === '-') {
          e.preventDefault();
          setZoomLevel(z => Math.max(0.5, z - 0.25));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(1);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleTouchStart = useCallback((e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartRef.current = {
          distance: Math.sqrt(dx * dx + dy * dy),
          zoom: zoomLevel
        };
      } else if (e.touches.length === 1) {
        lastTouchRef.current = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }];
        panStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          offsetX: viewportOffset.x,
          offsetY: viewportOffset.y
        };
      }
    }, [zoomLevel, viewportOffset]);

    const handleTouchMove = useCallback((e) => {
      e.preventDefault();
      if (e.touches.length === 2 && touchStartRef.current.distance > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scale = distance / touchStartRef.current.distance;
        setZoomLevel(Math.max(0.5, Math.min(3, touchStartRef.current.zoom * scale)));
      } else if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - panStartRef.current.x;
        const dy = e.touches[0].clientY - panStartRef.current.y;
        setViewportOffset({
          x: panStartRef.current.offsetX + dx,
          y: panStartRef.current.offsetY + dy
        });
      }
    }, []);

    const handleTouchEnd = useCallback(() => {
      touchStartRef.current.distance = 0;
    }, []);

    const handlePanStart = useCallback((e) => {
      if (e.target.closest('.tag-bubble') || e.target.closest('.exploded-tile') || e.target.closest('button')) return;
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: viewportOffset.x,
        offsetY: viewportOffset.y
      };
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grabbing';
      }
    }, [viewportOffset]);

    const handlePanMove = useCallback((e) => {
      if (!isPanning) return;
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewportOffset({
        x: panStartRef.current.offsetX + dx,
        y: panStartRef.current.offsetY + dy
      });
    }, [isPanning]);

    const handlePanEnd = useCallback(() => {
      setIsPanning(false);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    }, []);

    useEffect(() => {
      if (isPanning) {
        document.addEventListener('mousemove', handlePanMove);
        document.addEventListener('mouseup', handlePanEnd);
        return () => {
          document.removeEventListener('mousemove', handlePanMove);
          document.removeEventListener('mouseup', handlePanEnd);
        };
      }
    }, [isPanning, handlePanMove, handlePanEnd]);

    const handleBubblePositionChange = useCallback((bubbleId, newX, newY, isDragging) => {
      setBubblePositions(prev => prev.map(bp => {
        if (bp.group.id !== bubbleId) return bp;
        return {
          ...bp,
          x: newX,
          y: newY,
          isDragging,
          velocityX: isDragging ? 0 : bp.velocityX,
          velocityY: isDragging ? 0 : bp.velocityY
        };
      }));
    }, []);

    const handleExplode = useCallback((bubbleId) => {
      setExplodedBubbleId(bubbleId);
    }, []);

    const handleReinflate = useCallback(() => {
      setExplodedBubbleId(null);
    }, []);

    const handleWheel = useCallback((e) => {
      if (!explodedBubbleId) {
        e.preventDefault();
        setViewportOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    }, [explodedBubbleId]);

    return React.createElement('div', {
      ref: containerRef,
      className: 'screen tag-bubble-explore',
      style: {
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)',
        maxWidth: '100%',
        width: '100%',
        height: '100vh',
        margin: 0,
        padding: 0,
        cursor: isPanning ? 'grabbing' : 'grab'
      },
      onMouseDown: handlePanStart,
      onWheel: handleWheel,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }, [
      React.createElement('div', {
        key: 'viewport-indicator',
        style: {
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 60,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(10px)',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#94a3b8',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          pointerEvents: 'none'
        }
      }, `Drag to pan · Pinch to zoom · ${Math.round(zoomLevel * 100)}%`),

      React.createElement('div', {
        key: 'header',
        style: {
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '100px',
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none'
        }
      }, [
        React.createElement('div', {
          key: 'title-section',
          style: { pointerEvents: 'auto' }
        }, [
          React.createElement('h2', {
            key: 'title',
            style: {
              margin: '0 0 8px 0',
              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }
          }, 'Explore by Tags'),
          React.createElement('div', {
            key: 'subtitle',
            style: {
              color: '#94a3b8',
              fontSize: '14px'
            }
          }, 'Drag bubbles · Double-click to explore · Drag void to pan · Pinch to zoom')
        ]),
        React.createElement('div', {
          key: 'nav-buttons',
          style: {
            display: 'flex',
            gap: '10px',
            pointerEvents: 'auto'
          }
        }, [
          explodedBubbleId && React.createElement('button', {
            key: 'reinflate-btn',
            onClick: handleReinflate,
            style: {
              background: 'linear-gradient(135deg, #f472b6, #db2777)',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(244, 114, 182, 0.4)',
              transition: 'all 0.3s ease'
            },
            onMouseEnter: (e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 30px rgba(244, 114, 182, 0.6)';
            },
            onMouseLeave: (e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(244, 114, 182, 0.4)';
            }
          }, '🎈 Reinflate All'),
          React.createElement('button', {
            key: 'home-btn',
            onClick: onGoHome,
            style: {
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#94a3b8',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s ease'
            }
          }, '← Home'),
          React.createElement('button', {
            key: 'tree-btn',
            onClick: onGoToTree,
            style: {
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#94a3b8',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s ease'
            }
          }, '🌳 Tree')
        ])
      ]),

      React.createElement('div', {
        key: 'stats',
        style: {
          position: 'absolute',
          top: '100px',
          left: '20px',
          zIndex: 40,
          display: 'flex',
          gap: '20px',
          pointerEvents: 'none'
        }
      }, [
        React.createElement('div', {
          key: 'tag-groups',
          style: {
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#cbd5e1'
          }
        }, `${tagGroups.length} Tag Groups`),
        React.createElement('div', {
          key: 'total-tags',
          style: {
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#cbd5e1'
          }
        }, `${tagIndex.length} Unique Tags`),
        React.createElement('div', {
          key: 'total-nodes',
          style: {
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#cbd5e1'
          }
        }, `${flatNodes.length} Items`)
      ]),

      React.createElement('div', {
        key: 'expanded-world',
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${expandedDimensions.width}px`,
          height: `${expandedDimensions.height}px`,
          transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.1s ease-out'
        }
      }, [
        React.createElement('div', {
          key: 'world-boundary',
          style: {
            position: 'absolute',
            left: '50px',
            top: '50px',
            right: '50px',
            bottom: '50px',
            border: '2px dashed rgba(56, 189, 248, 0.15)',
            borderRadius: '40px',
            pointerEvents: 'none'
          }
        }),

        bubblePositions.map(bp => 
          React.createElement(TagBubble, {
            key: bp.group.id,
            bubble: bp.group,
            position: { x: bp.x, y: bp.y },
            isExploded: explodedBubbleId === bp.group.id,
            onExplode: handleExplode,
            onReinflate: handleReinflate,
            onOpenArticle: onOpenArticle,
            containerRef: containerRef,
            onPositionChange: handleBubblePositionChange,
            viewportOffset: viewportOffset
          })
        )
      ]),

      React.createElement('div', {
        key: 'mini-map',
        style: {
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          width: '200px',
          height: '150px',
          background: 'rgba(15, 23, 42, 0.9)',
          borderRadius: '12px',
          border: '2px solid rgba(56, 189, 248, 0.3)',
          zIndex: 100,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }
      }, [
        React.createElement('div', {
          key: 'mini-map-title',
          style: {
            position: 'absolute',
            top: '6px',
            left: '8px',
            fontSize: '10px',
            color: '#94a3b8',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }
        }, 'Radar'),
        React.createElement('div', {
          key: 'mini-map-content',
          style: {
            position: 'absolute',
            top: '20px',
            left: '5px',
            right: '5px',
            bottom: '5px'
          }
        }, [
          // Viewport indicator
          React.createElement('div', {
            key: 'viewport-indicator',
            style: {
              position: 'absolute',
              left: `${50 + ((-viewportOffset.x / expandedDimensions.width) * 100)}%`,
              top: `${50 + ((-viewportOffset.y / expandedDimensions.height) * 100)}%`,
              width: `${(viewportSize.width / expandedDimensions.width) * 100}%`,
              height: `${(viewportSize.height / expandedDimensions.height) * 100}%`,
              border: '2px solid rgba(56, 189, 248, 0.6)',
              background: 'rgba(56, 189, 248, 0.1)',
              borderRadius: '4px',
              transform: 'translate(-50%, -50%)'
            }
          }),
          // Bubble dots
          ...bubblePositions.map(bp => {
            const miniX = (bp.x / expandedDimensions.width) * 100;
            const miniY = (bp.y / expandedDimensions.height) * 100;
            const isExploded = explodedBubbleId === bp.group.id;
            return React.createElement('div', {
              key: `mini-bubble-${bp.group.id}`,
              style: {
                position: 'absolute',
                left: `${miniX}%`,
                top: `${miniY}%`,
                width: isExploded ? '10px' : '6px',
                height: isExploded ? '10px' : '6px',
                borderRadius: '50%',
                background: isExploded ? '#f472b6' : bp.group.color.bg,
                border: isExploded ? '2px solid #fff' : '1px solid rgba(255,255,255,0.5)',
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 8px ${bp.group.color.glow}`
              }
            });
          })
        ])
      ]),

      React.createElement('div', {
        key: 'bg-decoration',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: -1,
          opacity: 0.5,
          background: `
            radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(236, 72, 153, 0.05) 0%, transparent 40%)
          `
        }
      })
    ]);
  }

  window.ExploreScreen = ExploreScreen;
  console.log('✅ ExploreScreen with Enhanced Physics and Multi-Echelon Layout registered');
}
