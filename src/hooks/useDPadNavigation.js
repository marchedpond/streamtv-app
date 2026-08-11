import { useState, useEffect, useCallback } from 'react';

/**
 * Custom Spatial D-Pad Navigation Hook for Smart TV / Remote / Keyboard control
 */
export function useDPadNavigation({ activeZone = 'main', onBack = null, isPlayerOpen = false }) {
  const [focusedId, setFocusedId] = useState(null);

  // Focus a specific element by ID or DOM reference
  const focusElement = useCallback((id) => {
    if (!id) return;
    const el = document.querySelector(`[data-dpad-id="${id}"]`);
    if (el) {
      setFocusedId(id);
      document.querySelectorAll('.dpad-focusable').forEach((node) => {
        node.classList.remove('focused');
      });
      el.classList.add('focused');
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, []);

  // Spatial Navigation logic based on 2D bounding boxes
  const moveFocus = useCallback(
    (direction) => {
      // If a modal overlay or video player is active, constrain D-Pad navigation to focusables INSIDE the overlay
      const activeModal = document.querySelector('.fixed.inset-0.z-50');
      let focusables = [];

      if (activeModal) {
        focusables = Array.from(activeModal.querySelectorAll('.dpad-focusable:not([disabled]):not(.hidden)'));
      } else {
        focusables = Array.from(document.querySelectorAll('.dpad-focusable:not([disabled]):not(.hidden)'));
      }

      if (focusables.length === 0) return;

      const currentEl = (activeModal ? activeModal.querySelector('.dpad-focusable.focused') : null) ||
        document.querySelector('.dpad-focusable.focused') ||
        document.activeElement;

      if (!currentEl || !currentEl.classList.contains('dpad-focusable') || (activeModal && !activeModal.contains(currentEl))) {
        // Focus first element in modal or page
        const firstId = focusables[0].getAttribute('data-dpad-id');
        focusElement(firstId);
        return;
      }

      const currentRect = currentEl.getBoundingClientRect();
      const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2,
      };

      let bestCandidate = null;
      let minDistance = Infinity;

      focusables.forEach((candidate) => {
        if (candidate === currentEl) return;
        const rect = candidate.getBoundingClientRect();
        const candidateCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };

        const dx = candidateCenter.x - currentCenter.x;
        const dy = candidateCenter.y - currentCenter.y;

        let isCandidateInDirection = false;

        switch (direction) {
          case 'RIGHT':
            isCandidateInDirection = dx > 5 && Math.abs(dy) < Math.abs(dx) * 2;
            break;
          case 'LEFT':
            isCandidateInDirection = dx < -5 && Math.abs(dy) < Math.abs(dx) * 2;
            break;
          case 'DOWN':
            isCandidateInDirection = dy > 5 && Math.abs(dx) < Math.abs(dy) * 2;
            break;
          case 'UP':
            isCandidateInDirection = dy < -5 && Math.abs(dx) < Math.abs(dy) * 2;
            break;
          default:
            break;
        }

        if (isCandidateInDirection) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < minDistance) {
            minDistance = distance;
            bestCandidate = candidate;
          }
        }
      });

      if (bestCandidate) {
        const candidateId = bestCandidate.getAttribute('data-dpad-id');
        focusElement(candidateId);
      }
    },
    [focusElement, isPlayerOpen]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input element unless Escape is pressed
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && e.key !== 'Escape') {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          if (document.activeElement?.getAttribute('data-dpad-id') === 'player-timeline-slider') {
            return;
          }
          e.preventDefault();
          moveFocus('RIGHT');
          break;
        case 'ArrowLeft':
          if (document.activeElement?.getAttribute('data-dpad-id') === 'player-timeline-slider') {
            return;
          }
          e.preventDefault();
          moveFocus('LEFT');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus('DOWN');
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveFocus('UP');
          break;
        case 'Enter':
        case ' ':
          {
            const currentEl = document.querySelector('.dpad-focusable.focused') || document.activeElement;
            if (currentEl && currentEl.classList.contains('dpad-focusable')) {
              e.preventDefault();
              currentEl.click();
            }
          }
          break;
        case 'Backspace':
        case 'Escape':
          if (onBack) {
            e.preventDefault();
            onBack();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveFocus, onBack]);

  return { focusedId, focusElement, moveFocus };
}
