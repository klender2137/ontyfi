import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useTouchGesture - Comprehensive touch gesture handler
 * 
 * Handles: tap, long-press, swipe, pinch-to-zoom, two-finger pan
 * Uses passive event listeners for performance
 */
export function useTouchGesture({
  onTap,
  onDoubleTap,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinchStart,
  onPinchMove,
  onPinchEnd,
  onPanStart,
  onPanMove,
  onPanEnd,
  longPressDelay = 500,
  swipeThreshold = 50,
  doubleTapDelay = 300
} = {}) {
  const ref = useRef(null);
  const touchState = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    startDistance: 0,
    isMultiTouch: false,
    touchCount: 0,
    longPressTimer: null,
    lastTapTime: 0,
    isDragging: false
  });

  const [gestureState, setGestureState] = useState({
    isPinching: false,
    isPanning: false,
    scale: 1,
    panX: 0,
    panY: 0
  });

  // Get distance between two touch points
  const getTouchDistance = useCallback((touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get center point of touches
  const getTouchCenter = useCallback((touches) => {
    if (touches.length === 0) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (const touch of touches) {
      x += touch.clientX;
      y += touch.clientY;
    }
    return { x: x / touches.length, y: y / touches.length };
  }, []);

  const handleTouchStart = useCallback((e) => {
    const touches = e.touches;
    const now = Date.now();
    touchState.current.touchCount = touches.length;
    touchState.current.startTime = now;

    // Handle double-tap detection
    const timeSinceLastTap = now - touchState.current.lastTapTime;
    if (timeSinceLastTap < doubleTapDelay && touches.length === 1) {
      onDoubleTap?.(e);
      touchState.current.lastTapTime = 0;
      return;
    }
    touchState.current.lastTapTime = now;

    if (touches.length === 1) {
      // Single touch - potential tap or swipe
      touchState.current.startX = touches[0].clientX;
      touchState.current.startY = touches[0].clientY;
      touchState.current.isMultiTouch = false;
      
      // Start long-press timer
      touchState.current.longPressTimer = setTimeout(() => {
        onLongPress?.(e);
        touchState.current.isDragging = true;
      }, longPressDelay);
      
      onPanStart?.({ x: touches[0].clientX, y: touches[0].clientY });
    } else if (touches.length === 2) {
      // Multi-touch - pinch or rotate
      touchState.current.isMultiTouch = true;
      touchState.current.startDistance = getTouchDistance(touches);
      touchState.current.startX = getTouchCenter(touches).x;
      touchState.current.startY = getTouchCenter(touches).y;
      
      // Cancel long-press timer
      if (touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
        touchState.current.longPressTimer = null;
      }
      
      onPinchStart?.({
        scale: 1,
        center: { x: touchState.current.startX, y: touchState.current.startY }
      });
      
      setGestureState(prev => ({ ...prev, isPinching: true }));
    }
  }, [onDoubleTap, onLongPress, onPanStart, onPinchStart, longPressDelay, doubleTapDelay, getTouchDistance, getTouchCenter]);

  const handleTouchMove = useCallback((e) => {
    const touches = e.touches;
    
    if (touches.length === 1 && !touchState.current.isMultiTouch) {
      // Single touch movement - pan or swipe detection
      const dx = touches[0].clientX - touchState.current.startX;
      const dy = touches[0].clientY - touchState.current.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If moved significantly, cancel long-press
      if (distance > 10 && touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
        touchState.current.longPressTimer = null;
        touchState.current.isDragging = true;
      }
      
      onPanMove?.({
        x: touches[0].clientX,
        y: touches[0].clientY,
        dx,
        dy,
        distance
      });
      
      setGestureState(prev => ({ ...prev, isPanning: true }));
    } else if (touches.length === 2) {
      // Pinch zoom
      e.preventDefault(); // Prevent default zoom on mobile browsers
      
      const currentDistance = getTouchDistance(touches);
      const scale = currentDistance / touchState.current.startDistance;
      const center = getTouchCenter(touches);
      
      onPinchMove?.({
        scale,
        center,
        distance: currentDistance
      });
      
      setGestureState(prev => ({ ...prev, scale }));
    }
  }, [onPanMove, onPinchMove, getTouchDistance, getTouchCenter]);

  const handleTouchEnd = useCallback((e) => {
    const now = Date.now();
    const duration = now - touchState.current.startTime;
    const changedTouches = e.changedTouches;
    
    // Cancel long-press timer
    if (touchState.current.longPressTimer) {
      clearTimeout(touchState.current.longPressTimer);
      touchState.current.longPressTimer = null;
    }
    
    if (touchState.current.isMultiTouch) {
      // End of pinch
      onPinchEnd?.({ scale: gestureState.scale });
      touchState.current.isMultiTouch = false;
      setGestureState(prev => ({ ...prev, isPinching: false, scale: 1 }));
    } else if (changedTouches.length === 1 && !touchState.current.isDragging) {
      // Single touch ended - check for tap or swipe
      const dx = changedTouches[0].clientX - touchState.current.startX;
      const dy = changedTouches[0].clientY - touchState.current.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < swipeThreshold && duration < longPressDelay) {
        // This is a tap
        onTap?.(e);
      } else if (distance >= swipeThreshold) {
        // This is a swipe
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        
        if (absX > absY) {
          // Horizontal swipe
          if (dx > 0) {
            onSwipeRight?.(e);
          } else {
            onSwipeLeft?.(e);
          }
        } else {
          // Vertical swipe
          if (dy > 0) {
            onSwipeDown?.(e);
          } else {
            onSwipeUp?.(e);
          }
        }
      }
    }
    
    onPanEnd?.({
      x: changedTouches[0]?.clientX || 0,
      y: changedTouches[0]?.clientY || 0,
      dx: (changedTouches[0]?.clientX || 0) - touchState.current.startX,
      dy: (changedTouches[0]?.clientY || 0) - touchState.current.startY
    });
    
    touchState.current.isDragging = false;
    setGestureState(prev => ({ ...prev, isPanning: false }));
    touchState.current.touchCount = e.touches.length;
  }, [onTap, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onPanEnd, onPinchEnd, gestureState.scale, swipeThreshold, longPressDelay]);

  const handleTouchCancel = useCallback(() => {
    if (touchState.current.longPressTimer) {
      clearTimeout(touchState.current.longPressTimer);
      touchState.current.longPressTimer = null;
    }
    touchState.current.isDragging = false;
    touchState.current.isMultiTouch = false;
    setGestureState({
      isPinching: false,
      isPanning: false,
      scale: 1,
      panX: 0,
      panY: 0
    });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Add passive listeners for better scroll performance
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return { ref, gestureState };
}

/**
 * useLongPress - Dedicated long-press detection hook
 */
export function useLongPress({
  onLongPress,
  onPressStart,
  onPressEnd,
  delay = 500,
  shouldPreventDefault = true
} = {}) {
  const timerRef = useRef(null);
  const isLongPress = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const start = useCallback((e) => {
    const touch = e.touches?.[0] || e;
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isLongPress.current = false;
    
    onPressStart?.(e);
    
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress?.(e);
    }, delay);
  }, [onLongPress, onPressStart, delay]);

  const move = useCallback((e) => {
    if (!timerRef.current) return;
    
    const touch = e.touches?.[0] || e;
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Cancel if moved too far
    if (distance > 10) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback((e) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onPressEnd?.(e, isLongPress.current);
    isLongPress.current = false;
  }, [onPressEnd]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isLongPress.current = false;
  }, []);

  const handlers = {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onTouchCancel: cancel,
    onMouseDown: (e) => {
      if (e.button === 0) start(e);
    },
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: cancel,
    onContextMenu: shouldPreventDefault ? (e) => e.preventDefault() : undefined
  };

  return { handlers, isLongPress: () => isLongPress.current };
}

/**
 * useSwipe - Dedicated swipe detection hook
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  velocityThreshold = 0.3
} = {}) {
  const startPos = useRef({ x: 0, y: 0, time: 0 });

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    startPos.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startPos.current.x;
    const dy = touch.clientY - startPos.current.y;
    const dt = Date.now() - startPos.current.time;
    const velocityX = Math.abs(dx) / dt;
    const velocityY = Math.abs(dy) / dt;

    if (Math.abs(dx) > threshold || velocityX > velocityThreshold) {
      if (dx > 0) {
        onSwipeRight?.({ distance: dx, velocity: velocityX, duration: dt });
      } else {
        onSwipeLeft?.({ distance: Math.abs(dx), velocity: velocityX, duration: dt });
      }
    }

    if (Math.abs(dy) > threshold || velocityY > velocityThreshold) {
      if (dy > 0) {
        onSwipeDown?.({ distance: dy, velocity: velocityY, duration: dt });
      } else {
        onSwipeUp?.({ distance: Math.abs(dy), velocity: velocityY, duration: dt });
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocityThreshold]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd
    }
  };
}

/**
 * usePinchZoom - Pinch-to-zoom gesture handler
 */
export function usePinchZoom({
  onPinchStart,
  onPinchMove,
  onPinchEnd,
  minScale = 0.5,
  maxScale = 3
} = {}) {
  const [scale, setScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const pinchState = useRef({
    startDistance: 0,
    startScale: 1,
    currentScale: 1
  });

  const getDistance = useCallback((touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches);
      pinchState.current.startDistance = distance;
      pinchState.current.startScale = pinchState.current.currentScale;
      setIsPinching(true);
      onPinchStart?.({ scale: pinchState.current.currentScale });
    }
  }, [getDistance, onPinchStart]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getDistance(e.touches);
      const scaleRatio = distance / pinchState.current.startDistance;
      let newScale = pinchState.current.startScale * scaleRatio;
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      
      pinchState.current.currentScale = newScale;
      setScale(newScale);
      
      onPinchMove?.({ scale: newScale, scaleRatio });
    }
  }, [getDistance, onPinchMove, minScale, maxScale]);

  const handleTouchEnd = useCallback(() => {
    if (isPinching) {
      setIsPinching(false);
      onPinchEnd?.({ scale: pinchState.current.currentScale });
    }
  }, [isPinching, onPinchEnd]);

  return {
    scale,
    isPinching,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd
    },
    reset: () => {
      pinchState.current.currentScale = 1;
      setScale(1);
    }
  };
}

export default useTouchGesture;
