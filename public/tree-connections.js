// Connection lines between tree tiles
function createConnectionLine(parentPos, childPos, parentId, childId) {
  if (!parentPos || !childPos) return null;
  
  // Calculate connection points on tile edges
  const parentRight = parentPos.x + 180; // Tile width
  const parentBottom = parentPos.y + 100; // Tile height
  const childLeft = childPos.x;
  const childTop = childPos.y;
  
  // Determine best connection points
  let startX, startY, endX, endY;
  
  if (childPos.x > parentPos.x) {
    // Child is to the right
    startX = parentRight;
    startY = parentPos.y + 50; // Middle of parent tile
    endX = childLeft;
    endY = childPos.y + 50; // Middle of child tile
  } else {
    // Child is below or diagonal
    startX = parentPos.x + 90; // Middle of parent tile
    startY = parentBottom;
    endX = childPos.x + 90; // Middle of child tile
    endY = childTop;
  }
  
  return {
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
    key: `line-${parentId}-${childId}`
  };
}

window.createConnectionLine = createConnectionLine;