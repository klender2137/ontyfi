// TreeScreen Curved Connections Patch
// Replace the connection rendering section in renderRecursive with this:

/*
// Curved connections to children
...(isExpanded ? children.map(child => {
  const childPos = nodePositions[child.id];
  if (childPos) {
    const startX = pos.x + 180; // Right edge of parent
    const startY = pos.y + 50;  // Middle of parent
    const endX = childPos.x;    // Left edge of child
    const endY = childPos.y + 50; // Middle of child
    
    const controlX = (startX + endX) / 2 + 50;
    const controlY = (startY + endY) / 2;
    
    return React.createElement('svg', {
      key: `connection-${node.id}-${child.id}`,
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: level - 1
      }
    }, [
      React.createElement('path', {
        key: 'curve',
        d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
        stroke: 'rgba(148, 163, 184, 0.6)',
        strokeWidth: '2',
        fill: 'none',
        strokeLinecap: 'round'
      })
    ]);
  }
  return null;
}).filter(Boolean) : []),
*/