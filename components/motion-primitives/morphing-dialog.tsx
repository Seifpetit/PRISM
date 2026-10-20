"use client";

// Adapted from Motion Primitives' MIT-licensed Morphing Dialog component.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type RefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, MotionConfig, type Transition } from "motion/react";
import { h } from "@/lib/h";
import { useClickOutside } from "@/hooks/use-click-outside";

type DialogContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  uniqueId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog() {
  const value = useContext(DialogContext);
  if (!value) throw new Error("Morphing Dialog components must be used inside MorphingDialog");
  return value;
}

const defaultTransition: Transition = {
  type: "tween",
  duration: 0.34,
  ease: [0.22, 1, 0.36, 1],
};

export function MorphingDialog({
  children,
  transition = defaultTransition,
}: {
  children: ReactNode;
  transition?: Transition;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uniqueId = useId();

  return h(
    DialogContext.Provider,
    { value: { isOpen, setIsOpen, uniqueId, triggerRef } },
    h(MotionConfig, { transition, reducedMotion: "user" }, children),
  );
}

type TriggerProps = ComponentPropsWithoutRef<typeof motion.button> & {
  canOpen?: boolean;
  onActivate?: () => void;
  sharedLayout?: boolean;
};

export const MorphingDialogTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  function MorphingDialogTrigger(
    {
      children,
      canOpen = true,
      onActivate,
      sharedLayout = true,
      onClick,
      onPointerDown,
      onPointerMove,
      ...props
    },
    forwardedRef,
  ) {
    const { setIsOpen, uniqueId, triggerRef } = useDialog();
    const pointerStart = useRef<{ x: number; y: number } | null>(null);
    const dragged = useRef(false);

    const setRef = useCallback(
      (element: HTMLButtonElement | null) => {
        triggerRef.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      },
      [forwardedRef, triggerRef],
    );

    return h(
      motion.button,
      {
        ...props,
        ref: setRef,
        type: "button",
        layoutId: sharedLayout ? `morphing-dialog-${uniqueId}` : undefined,
        "aria-haspopup": "dialog",
        onPointerDown: (event) => {
          pointerStart.current = { x: event.clientX, y: event.clientY };
          dragged.current = false;
          onPointerDown?.(event);
        },
        onPointerMove: (event) => {
          if (pointerStart.current) {
            const distance = Math.hypot(
              event.clientX - pointerStart.current.x,
              event.clientY - pointerStart.current.y,
            );
            if (distance > 5) dragged.current = true;
          }
          onPointerMove?.(event);
        },
        onClick: (event) => {
          onClick?.(event);
          if (event.defaultPrevented || dragged.current) {
            dragged.current = false;
            return;
          }
          onActivate?.();
          if (canOpen) setIsOpen(true);
        },
      },
      children as ReactNode,
    );
  },
);

export function MorphingDialogContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen } = useDialog();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    h(
      AnimatePresence,
      { initial: false },
      isOpen
        ? h(
            "div",
            { className: `fixed inset-0 z-[100] ${className}`, "data-morphing-dialog-layer": "" },
            h(motion.div, {
              className: "absolute inset-0 bg-[#15171A]/25 backdrop-blur-[1px]",
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.2 },
              "aria-hidden": true,
            }),
            h(
              "div",
              { className: "absolute inset-0 flex items-center justify-center p-4 sm:p-8" },
              children,
            ),
          )
        : null,
    ),
    document.body,
  );
}

type MorphingDialogContentProps = ComponentPropsWithoutRef<typeof motion.div> & {
  sharedLayout?: boolean;
};

export const MorphingDialogContent = forwardRef<HTMLDivElement, MorphingDialogContentProps>(
  function MorphingDialogContent(
    { children, className = "", sharedLayout = true, ...props },
    forwardedRef,
  ) {
    const { isOpen, setIsOpen, uniqueId, triggerRef } = useDialog();
    const contentRef = useRef<HTMLDivElement>(null);

    const setRef = useCallback(
      (element: HTMLDivElement | null) => {
        contentRef.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      },
      [forwardedRef],
    );

    useClickOutside(
      contentRef,
      useCallback(() => setIsOpen(false), [setIsOpen]),
    );

    useEffect(() => {
      if (!isOpen) return;
      const previousOverflow = document.body.style.overflow;
      const layer = contentRef.current?.closest<HTMLElement>("[data-morphing-dialog-layer]");
      const background = Array.from(document.body.children).filter(
        (element) => element !== layer,
      ) as HTMLElement[];
      const previous = background.map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));

      document.body.style.overflow = "hidden";
      background.forEach((element) => {
        element.inert = true;
        element.setAttribute("aria-hidden", "true");
      });

      const focusFirst = window.requestAnimationFrame(() => {
        const first = contentRef.current?.querySelector<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        );
        (first ?? contentRef.current)?.focus();
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsOpen(false);
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          contentRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
          ) ?? [],
        );
        if (!focusable.length) {
          event.preventDefault();
          contentRef.current?.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener("keydown", onKeyDown);

      return () => {
        window.cancelAnimationFrame(focusFirst);
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = previousOverflow;
        previous.forEach(({ element, inert, ariaHidden }) => {
          element.inert = inert;
          if (ariaHidden === null) element.removeAttribute("aria-hidden");
          else element.setAttribute("aria-hidden", ariaHidden);
        });
        triggerRef.current?.focus();
      };
    }, [isOpen, setIsOpen, triggerRef]);

    return h(
      motion.div,
      {
        ...props,
        ref: setRef,
        layoutId: sharedLayout ? `morphing-dialog-${uniqueId}` : undefined,
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": `morphing-dialog-title-${uniqueId}`,
        "aria-describedby": `morphing-dialog-description-${uniqueId}`,
        tabIndex: -1,
        className,
      },
      children as ReactNode,
    );
  },
);

export function MorphingDialogClose({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof motion.button>) {
  const { setIsOpen } = useDialog();
  return h(
    motion.button,
    { ...props, type: "button", className, onClick: () => setIsOpen(false) },
    children as ReactNode,
  );
}

export function MorphingDialogTitle({
  children,
  className = "",
  asDialogTitle = true,
  sharedLayout = true,
  ...props
}: ComponentPropsWithoutRef<typeof motion.h2> & {
  asDialogTitle?: boolean;
  sharedLayout?: boolean;
}) {
  const { uniqueId } = useDialog();
  return h(
    motion.h2,
    {
      ...props,
      id: asDialogTitle ? `morphing-dialog-title-${uniqueId}` : undefined,
      layoutId: sharedLayout ? `morphing-dialog-title-${uniqueId}` : undefined,
      className,
    },
    children as ReactNode,
  );
}

export function MorphingDialogDescription({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof motion.div>) {
  const { uniqueId } = useDialog();
  return h(
    motion.div,
    { ...props, id: `morphing-dialog-description-${uniqueId}`, className },
    children as ReactNode,
  );
}
